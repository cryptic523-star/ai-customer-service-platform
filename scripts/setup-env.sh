#!/bin/bash
# Asks for your Supabase values one at a time and saves them into .env.
# Secret values are typed hidden and are never printed.
set -e
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env

clean() { printf '%s' "$1" | tr -d " \t\r\n\"'"; }

set_var() {
  grep -v "^$1=" .env > .env.tmp || true
  echo "$1=$2" >> .env.tmp
  mv .env.tmp .env
  chmod 600 .env
}

echo ""
read -rp "1/3  Paste your Supabase Project URL, then press Enter: " URL
URL=$(clean "$URL")
URL="${URL%/}"
if ! [[ "$URL" =~ ^https://[a-z0-9]+\.supabase\.co$ ]]; then
  echo "That doesn't look like a Supabase URL (expected https://xxxx.supabase.co). Nothing was saved."
  exit 1
fi

echo ""
echo "The next two are secret. Nothing will appear on screen as you paste. That is normal."
read -rsp "2/3  Paste your SECRET (service_role) key, then press Enter: " SERVICE
echo ""
SERVICE=$(clean "$SERVICE")

read -rsp "3/3  Paste your PUBLISHABLE (anon) key, then press Enter: " ANON
echo ""
ANON=$(clean "$ANON")

if [ ${#SERVICE} -lt 20 ] || [ ${#ANON} -lt 20 ]; then
  echo "One of the keys looks too short or empty. Nothing was saved."
  exit 1
fi
if [ "$SERVICE" = "$ANON" ]; then
  echo "The secret key and the publishable key are identical. They must be different. Nothing was saved."
  exit 1
fi

set_var SUPABASE_URL "$URL"
set_var SUPABASE_SERVICE_ROLE_KEY "$SERVICE"
set_var SUPABASE_ANON_KEY "$ANON"

echo ""
echo "Saved to .env:"
echo "  SUPABASE_URL                = $URL"
echo "  SUPABASE_SERVICE_ROLE_KEY   = (hidden, ${#SERVICE} characters)"
echo "  SUPABASE_ANON_KEY           = (hidden, ${#ANON} characters)"
