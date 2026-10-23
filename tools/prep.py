#!/usr/bin/env python3
"""Archive a class prep sheet on the site WITHOUT the site password.

  python3 tools/prep.py add COURSE SHEET.html --lesson N --date YYYY-MM-DD --title "Lesson title" [--day "Day 1"] [--url ARTIFACT_URL]

Each sheet is sealed on its own (same public-key scheme as tools/finance.py) to
  data/prep/<COURSE>/<YYYY-MM-DD>-L<N>.enc
and listed in data/prep/manifest.json. The manifest holds only course, lesson
number, date and file name; the title and the page itself are inside the sealed
file, so they show only after the site is unlocked (Courses -> Prep sheets).

Adding the same course + date again replaces that entry (so a re-run updates it).
SHEET.html can be the artifact source file or the full page from an Artifact read.
"""
import argparse, datetime, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import finance

ROOT = os.path.normpath(os.path.join(HERE, ".."))
PREP = os.path.join(ROOT, "data", "prep")
MANIFEST = os.path.join(PREP, "manifest.json")


def add(a):
    course = a.course.upper().strip()
    if not re.fullmatch(r"[A-Z]{2}\d{3}X?", course):
        sys.exit("course must look like MA376 or MA481X")
    datetime.date.fromisoformat(a.date)  # raises on a bad date
    html = open(a.sheet, encoding="utf-8").read()
    if len(html) < 200:
        sys.exit("sheet looks empty")

    name = f"{a.date}-L{a.lesson}.enc"
    rel = f"{course}/{name}"
    os.makedirs(os.path.join(PREP, course), exist_ok=True)

    now = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    payload = {"course": course, "lesson": a.lesson, "date": a.date, "day": a.day or "",
               "title": a.title, "url": a.url or "", "added": now, "html": html}
    tmp = os.path.join(PREP, ".tmp-sheet.json")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    finance.OUT = os.path.join(PREP, course, name)
    try:
        finance.seal(tmp)
    finally:
        os.remove(tmp)

    m = {"updated": now, "sheets": []}
    if os.path.exists(MANIFEST):
        m = json.load(open(MANIFEST))
    old = [s for s in m["sheets"] if s["course"] == course and s["date"] == a.date]
    for s in old:  # same class day re-run: drop the old file if its name changed
        if s["file"] != rel:
            p = os.path.join(PREP, s["file"])
            if os.path.exists(p):
                os.remove(p)
    m["sheets"] = [s for s in m["sheets"] if not (s["course"] == course and s["date"] == a.date)]
    m["sheets"].append({"course": course, "lesson": a.lesson, "date": a.date, "file": rel})
    m["sheets"].sort(key=lambda s: (s["course"], s["date"]))
    m["updated"] = now
    with open(MANIFEST, "w") as f:
        json.dump(m, f, indent=1)
    print(f"archived {course} L{a.lesson} ({a.date}) -> data/prep/{rel}")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd")
    s = sub.add_parser("add")
    s.add_argument("course"); s.add_argument("sheet")
    s.add_argument("--lesson", type=int, required=True)
    s.add_argument("--date", required=True)
    s.add_argument("--title", required=True)
    s.add_argument("--day", default="")
    s.add_argument("--url", default="")
    a = p.parse_args()
    if a.cmd == "add":
        add(a)
    else:
        print(__doc__)
