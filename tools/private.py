#!/usr/bin/env python3
"""Seal / open the encrypted private data for the site (data/private.enc).

  python3 tools/private.py open  [out.json]   decrypt data/private.enc -> out.json (default: private.json)
  python3 tools/private.py seal  [in.json]    encrypt in.json (default: private.json) -> data/private.enc

The password comes from the SITE_PW environment variable, or a prompt.
The plain private.json must never be committed (it is in .gitignore).
Needs: pip install cryptography
"""
import base64, getpass, hashlib, json, os, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ITER = 600_000
ENC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "private.enc")

def password():
    return os.environ.get("SITE_PW") or getpass.getpass("Site password: ")

def derive(pw, salt, iters):
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, iters, 32)

def seal(src):
    data = open(src, "rb").read()
    json.loads(data)  # must be valid JSON
    salt, iv = os.urandom(16), os.urandom(12)
    ct = AESGCM(derive(password(), salt, ITER)).encrypt(iv, data, None)
    blob = {"v": 1, "iter": ITER, "salt": base64.b64encode(salt).decode(),
            "iv": base64.b64encode(iv).decode(), "ct": base64.b64encode(ct).decode()}
    json.dump(blob, open(ENC, "w"), separators=(",", ":"))
    print("sealed ->", os.path.normpath(ENC), len(blob["ct"]), "bytes (base64)")

def open_(dst):
    blob = json.load(open(ENC))
    key = derive(password(), base64.b64decode(blob["salt"]), blob["iter"])
    pt = AESGCM(key).decrypt(base64.b64decode(blob["iv"]), base64.b64decode(blob["ct"]), None)
    open(dst, "wb").write(pt)
    print("decrypted ->", dst)

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    arg = sys.argv[2] if len(sys.argv) > 2 else "private.json"
    if cmd == "seal": seal(arg)
    elif cmd == "open": open_(arg)
    else: print(__doc__)
