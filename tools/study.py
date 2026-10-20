#!/usr/bin/env python3
"""Seal today's study decks for the site WITHOUT the site password.

  python3 tools/study.py seal study.json     encrypt study.json -> data/study.enc

Same public-key scheme as tools/finance.py (only the password-locked private key opens it).
study.json shape:
  {"updated": "<ISO timestamp>", "courses": {"MA376": {
      "short": "Stats", "term": "AY27-1", "title": "<lesson title>",
      "lesson": "Lesson 18", "lessonDate": "YYYY-MM-DD",
      "cards": [["question", "answer"], ...],          # KaTeX: \\( \\) inline, \\[ \\] display
      "problems": [{"q": "...", "a": "..."}, ...],
      "recap": ["what the last lesson covered", ...],
      "prep": ["what to know / do before this lesson", ...],
      "sources": ["Canvas: Lesson 18 notes", ...]}, ...}}
Courses listed here replace that course's deck from the locked data; others are kept.
Never commit the plain study.json (it is in .gitignore).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import finance

if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "seal":
        finance.OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "study.enc")
        finance.seal(sys.argv[2])
    else:
        print(__doc__)
