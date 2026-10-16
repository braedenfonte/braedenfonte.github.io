#!/usr/bin/env python3
"""Seal finance data for the site WITHOUT the site password.

  python3 tools/finance.py seal finance.json     encrypt finance.json -> data/finance.enc

Uses the public key in tools/finance_pub.json (RSA-OAEP-256 wraps a random
AES-256-GCM key). Only the private key, which lives inside the password-locked
data/private.enc, can open it, so the website shows the numbers only after unlock.
Never commit the plain finance.json (it is in .gitignore).
Needs: pip install cryptography
"""
import base64, json, os, sys
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "finance_pub.json")
OUT = os.path.join(HERE, "..", "data", "finance.enc")
b64 = lambda b: base64.b64encode(b).decode()
ub = lambda s: int.from_bytes(base64.urlsafe_b64decode(s + "=" * (-len(s) % 4)), "big")

def seal(src):
    data = open(src, "rb").read(); json.loads(data)
    jwk = json.load(open(PUB))
    pub = rsa.RSAPublicNumbers(ub(jwk["e"]), ub(jwk["n"])).public_key()
    key, iv = AESGCM.generate_key(256), os.urandom(12)
    wrapped = pub.encrypt(key, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
    blob = {"v": 1, "k": b64(wrapped), "iv": b64(iv), "ct": b64(AESGCM(key).encrypt(iv, data, None))}
    json.dump(blob, open(OUT, "w"), separators=(",", ":"))
    print("sealed ->", os.path.normpath(OUT))

if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "seal": seal(sys.argv[2])
    else: print(__doc__)
