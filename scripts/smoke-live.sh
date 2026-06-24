#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://thia.lol}"
BASE_URL="${BASE_URL%/}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

check_http_200() {
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

  echo "OK $path returned HTTP 200"
}

check_json_ok() {
  local path="$1"
  local body_file="$tmp_dir/$(printf '%s' "$path" | tr -c 'A-Za-z0-9' '_')"

  check_http_200 "$path"

  if ! grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$body_file"; then
    echo "Expected JSON containing \"ok\":true for $path" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  echo "OK $path returned JSON ok:true"
}

check_http_200 "/"
check_http_200 "/discover"
check_http_200 "/rooms"
check_http_200 "/@thia"
check_http_200 "/deploy-meta.json"

check_json_ok "/api/health"
check_json_ok "/api/health?db=1"
check_json_ok "/api/profiles/thia"
check_json_ok "/api/rooms"
check_json_ok "/api/rooms/general/members"
check_json_ok "/api/search?q=thia"
check_json_ok "/api/badges"
check_json_ok "/api/posts"
