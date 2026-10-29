#!/usr/bin/env python3
"""Seal any JSON file for the site WITHOUT the site password (same public key as tools/finance.py).

  python3 tools/sealjson.py trip  /tmp/trip.json    -> data/trip.enc   (San Juan return tracker)
  python3 tools/sealjson.py sched /tmp/sched.json   -> data/sched.enc  (schedule fixes on top of the locked schedule)

sched.json shape: {"remove":[{"re":"EM481","date":"YYYY-MM-DD"}],
                   "set":[{"re":"MA486","and":"HW ?3","cat":"due","to":{"start":"...","time":"2359","end":null},"add":{...event if none match}}],
                   "add":[{"start":"YYYY-MM-DD","t":"title","cat":"personal"}], "days":{"YYYY-MM-DD":"2-27"}}
Never commit the plain JSON.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import finance
NAMES = {"trip": "trip.enc", "sched": "sched.enc"}
if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] in NAMES:
        finance.OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", NAMES[sys.argv[1]])
        finance.seal(sys.argv[2])
    else:
        print(__doc__)
