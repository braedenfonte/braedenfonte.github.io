#!/usr/bin/env python3
"""Add or remove a file/link in a site folder WITHOUT the site password.

  python3 tools/links.py add FOLDER --title "Name" --url URL [--note "one line"] [--kind artifact|drive|file|link]
  python3 tools/links.py remove FOLDER --url URL

Folders: class folders use the course code (MA376, SS388, EM481, MA486, MA481X);
project folders are proj-tsp, proj-cft, proj-nfl, proj-bot.

Each link is sealed on its own (same public-key scheme as tools/finance.py) to
  data/links/<FOLDER>/<id>.enc        (id = hash of the URL, so re-adding updates it)
and listed in data/links/manifest.json, which holds only folder, id and order.
Titles and URLs are inside the sealed files and show only after the site is unlocked.
"""
import argparse, datetime, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import finance

LINKS = os.path.normpath(os.path.join(HERE, "..", "data", "links"))
MANIFEST = os.path.join(LINKS, "manifest.json")


def load():
    return json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {"updated": "", "items": []}


def save(m):
    m["updated"] = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    os.makedirs(LINKS, exist_ok=True)
    with open(MANIFEST, "w") as f:
        json.dump(m, f, indent=1)


def kind_of(url):
    if "claude.ai/artifact" in url: return "artifact"
    if "drive.google.com/drive/folders" in url: return "folder"
    if "drive.google.com" in url or "docs.google.com" in url: return "drive"
    return "link"


def ident(url):
    return hashlib.sha256(url.strip().encode()).hexdigest()[:12]


def add(a):
    if not re.fullmatch(r"[A-Za-z0-9-]{2,24}", a.folder): sys.exit("bad folder name")
    if not re.match(r"https?://", a.url): sys.exit("url must start with http(s)://")
    i = ident(a.url); rel = f"{a.folder}/{i}.enc"
    os.makedirs(os.path.join(LINKS, a.folder), exist_ok=True)
    now = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    tmp = os.path.join(LINKS, ".tmp-link.json")
    json.dump({"title": a.title, "url": a.url, "note": a.note or "", "kind": a.kind or kind_of(a.url), "added": now}, open(tmp, "w"))
    finance.OUT = os.path.join(LINKS, a.folder, f"{i}.enc")
    try: finance.seal(tmp)
    finally: os.remove(tmp)
    m = load()
    old = next((x for x in m["items"] if x["folder"] == a.folder and x["id"] == i), None)
    if old is None:
        order = 1 + max([x["order"] for x in m["items"] if x["folder"] == a.folder] or [0])
        m["items"].append({"folder": a.folder, "id": i, "file": rel, "order": order})
    m["items"].sort(key=lambda x: (x["folder"], x["order"]))
    save(m)
    print(f"{'updated' if old else 'added'} {a.folder}: {a.title}")


def remove(a):
    i = ident(a.url); m = load()
    keep = [x for x in m["items"] if not (x["folder"] == a.folder and x["id"] == i)]
    if len(keep) == len(m["items"]): sys.exit("not found")
    p = os.path.join(LINKS, a.folder, f"{i}.enc")
    if os.path.exists(p): os.remove(p)
    m["items"] = keep; save(m); print("removed")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd")
    s = sub.add_parser("add"); s.add_argument("folder"); s.add_argument("--title", required=True)
    s.add_argument("--url", required=True); s.add_argument("--note", default=""); s.add_argument("--kind", default="")
    r = sub.add_parser("remove"); r.add_argument("folder"); r.add_argument("--url", required=True)
    a = p.parse_args()
    add(a) if a.cmd == "add" else remove(a) if a.cmd == "remove" else print(__doc__)
