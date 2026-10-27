#!/usr/bin/env python3
"""Post the morning brief to the site WITHOUT the site password.

  python3 tools/brief.py post BRIEF.html --date YYYY-MM-DD

Seals {"date", "posted", "html"} to data/brief.enc with the same public key as
tools/finance.py, so the page shows only after the site is unlocked (Morning brief tab).
Posting again replaces it.
"""
import argparse, datetime, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import finance

def post(a):
    datetime.date.fromisoformat(a.date)
    html = open(a.brief, encoding="utf-8").read()
    if len(html) < 200: sys.exit("brief looks empty")
    out = os.path.join(HERE, "..", "data", "brief.enc")
    tmp = out + ".tmp.json"
    json.dump({"date": a.date, "posted": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "html": html}, open(tmp, "w", encoding="utf-8"))
    finance.OUT = out
    try: finance.seal(tmp)
    finally: os.remove(tmp)

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    s = p.add_subparsers(dest="cmd", required=True)
    q = s.add_parser("post"); q.add_argument("brief"); q.add_argument("--date", required=True)
    a = p.parse_args(); post(a)
