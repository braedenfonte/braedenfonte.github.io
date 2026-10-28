"""
canvas.py - read Canvas from the cloud, no browser needed.

The Canvas key is NOT in this file or anywhere in the repo. It lives in the
"Routines" cloud environment as a network secret, and is added to every request
to westpoint.instructure.com automatically. So this script only works inside
that environment.

Commands (run from the repo root):
  python3 tools/canvas.py check                    -> says OK, or why Canvas can't be reached
  python3 tools/canvas.py courses                  -> your current courses (id, code, name)
  python3 tools/canvas.py get /courses/12755/modules?include[]=items
                                                   -> any Canvas API path, printed as JSON
  python3 tools/canvas.py download <file_id> <out> -> saves a Canvas file (PDF, xlsx, pptx...)

Exit code 0 = worked. Exit code 2 = the Canvas key is missing or expired.
"""
import json
import sys
import requests

BASE = "https://westpoint.instructure.com/api/v1"


def fail(msg, code=1):
    print(f"CANVAS ERROR: {msg}")
    sys.exit(code)


def get(path):
    """GET a Canvas API path and follow 'next page' links so you get everything."""
    url = path if path.startswith("http") else BASE + (path if path.startswith("/") else "/" + path)
    sep = "&" if "?" in url else "?"
    url += f"{sep}per_page=100"
    out = []
    while url:
        try:
            r = requests.get(url, timeout=60)
        except requests.RequestException as e:
            fail(f"can't reach Canvas ({type(e).__name__}). Is this running in the 'Routines' environment?")
        if r.status_code == 401:
            fail("the Canvas key is missing or expired. Make a new one (Canvas > Account > Settings > "
                 "New Access Token) and replace the 'Canvas' network secret in the Routines environment.", 2)
        if r.status_code == 403 and "inscloudgate" not in url:
            fail(f"Canvas said 'forbidden' for {path} (403).")
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, list):
            return data
        out += data
        url = r.links.get("next", {}).get("url")
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd = sys.argv[1]
    if cmd == "check":
        me = get("/users/self")
        print(f"OK: signed in to Canvas as {me.get('name')}")
    elif cmd == "courses":
        for c in get("/courses?enrollment_state=active"):
            if c.get("name"):
                print(f"{c['id']}\t{c.get('course_code', '')}\t{c['name']}")
    elif cmd == "get":
        print(json.dumps(get(sys.argv[2]), indent=1))
    elif cmd == "download":
        info = get(f"/files/{sys.argv[2]}")
        r = requests.get(info["url"], timeout=120)  # this link carries its own one-time pass
        if r.status_code in (401, 403):
            fail(f"Canvas file host blocked the download ({r.status_code}). Add the host from "
                 f"{info['url'].split('/')[2]} to the Routines environment's Allowed domains.")
        r.raise_for_status()
        open(sys.argv[3], "wb").write(r.content)
        print(f"saved {sys.argv[3]} ({len(r.content)//1024} KB): {info.get('display_name')}")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
