#!/usr/bin/env bash
set -euo pipefail

CAP_URL="${1:?usage: cap-site-key.sh <cap url> <admin key> [name]}"
ADMIN_KEY="${2:?usage: cap-site-key.sh <cap url> <admin key> [name]}"
NAME="${3:-shionlib}"
CAP_URL="${CAP_URL%/}"

login="$(curl -fsS -X POST "$CAP_URL/auth/login" \
  -H 'Content-Type: application/json' \
  --data "$(ADMIN_KEY="$ADMIN_KEY" python3 -c 'import json, os; print(json.dumps({"admin_key": os.environ["ADMIN_KEY"]}))')")"

bearer="$(LOGIN="$login" python3 -c '
import base64, json, os
session = json.loads(os.environ["LOGIN"])
print(base64.b64encode(json.dumps({"token": session["session_token"], "hash": session["hashed_token"]}).encode()).decode())
')"

created="$(curl -fsS -X POST "$CAP_URL/server/keys" \
  -H "Authorization: Bearer $bearer" \
  -H 'Content-Type: application/json' \
  --data "$(NAME="$NAME" python3 -c '
import json, os
print(json.dumps({
    "name": os.environ["NAME"],
    "instrumentation": os.environ.get("CAP_INSTRUMENTATION", "true") == "true",
    "blockAutomatedBrowsers": os.environ.get("CAP_BLOCK_AUTOMATED", "true") == "true",
    "protocol": os.environ.get("CAP_PROTOCOL", "hashwx"),
    "hashwxDifficulty": int(os.environ.get("CAP_HASHWX_DIFFICULTY", "1000000")),
}))')")"

CREATED="$created" python3 -c '
import json, os
key = json.loads(os.environ["CREATED"])
print("CAP_SITE_KEY=" + key["siteKey"])
print("CAP_SECRET=" + key["secretKey"])
'
