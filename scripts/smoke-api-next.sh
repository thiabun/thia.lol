#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://thia.lol}"
BASE_URL="${BASE_URL%/}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

check_json_ok() {
  local path="$1"
  local body_file="$tmp_dir/$(printf '%s' "$path" | tr -c 'A-Za-z0-9' '_')"
  local status

  status="$(curl --location --silent --show-error --output "$body_file" --write-out '%{http_code}' --max-time 20 "$BASE_URL$path")"

  if [[ "$status" != "200" ]]; then
    echo "Expected HTTP 200 for $path, got $status" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  if ! grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$body_file"; then
    echo "Expected JSON containing \"ok\":true for $path" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  echo "OK $path returned HTTP 200 and JSON ok:true"
}

check_json_ok "/api-next/health"
check_json_ok "/api-next/health?db=1"
check_json_ok "/api-next/rooms"
check_json_ok "/api-next/rooms/general"
check_json_ok "/api-next/stats"
check_json_ok "/api-next/profiles/thia"
