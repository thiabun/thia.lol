#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://thia.lol}"
BASE_URL="${BASE_URL%/}"
COOKIE_HEADER="${COOKIE_HEADER:-}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

check_json_ok() {
  local path="$1"
  local body_file="$tmp_dir/$(printf '%s' "$path" | tr -c 'A-Za-z0-9' '_')"
  local status

  local curl_args=(--location --silent --show-error --output "$body_file" --write-out '%{http_code}' --max-time 20)

  if [[ -n "$COOKIE_HEADER" ]]; then
    curl_args+=(--header "Cookie: $COOKIE_HEADER")
  fi

  status="$(curl "${curl_args[@]}" "$BASE_URL$path")"

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

check_json_status() {
  local path="$1"
  local expected_status="$2"
  local body_file="$tmp_dir/$(printf '%s' "$path-$expected_status" | tr -c 'A-Za-z0-9' '_')"
  local status
  local curl_args=(--location --silent --show-error --output "$body_file" --write-out '%{http_code}' --max-time 20)

  if [[ -n "$COOKIE_HEADER" ]]; then
    curl_args+=(--header "Cookie: $COOKIE_HEADER")
  fi

  status="$(curl "${curl_args[@]}" "$BASE_URL$path")"

  if [[ "$status" != "$expected_status" ]]; then
    echo "Expected HTTP $expected_status for $path, got $status" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  if ! grep -Eq '"ok"[[:space:]]*:[[:space:]]*false' "$body_file"; then
    echo "Expected JSON containing \"ok\":false for $path" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  echo "OK $path returned HTTP $expected_status and JSON ok:false"
}

check_json_status_method() {
  local method="$1"
  local path="$2"
  local expected_status="$3"
  local body_file="$tmp_dir/$(printf '%s' "$method-$path-$expected_status" | tr -c 'A-Za-z0-9' '_')"
  local status
  local curl_args=(--request "$method" --location --silent --show-error --output "$body_file" --write-out '%{http_code}' --max-time 20)

  if [[ -n "$COOKIE_HEADER" ]]; then
    curl_args+=(--header "Cookie: $COOKIE_HEADER")
  fi

  if [[ "$method" == "PATCH" || "$method" == "POST" ]]; then
    curl_args+=(--header "Content-Type: application/json" --data '{}')
  fi

  status="$(curl "${curl_args[@]}" "$BASE_URL$path")"

  if [[ "$status" != "$expected_status" ]]; then
    echo "Expected HTTP $expected_status for $method $path, got $status" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  if ! grep -Eq '"ok"[[:space:]]*:[[:space:]]*false' "$body_file"; then
    echo "Expected JSON containing \"ok\":false for $method $path" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  echo "OK $method $path returned HTTP $expected_status and JSON ok:false"
}

check_json_ok_method() {
  local method="$1"
  local path="$2"
  local body_file="$tmp_dir/$(printf '%s' "$method-$path-ok" | tr -c 'A-Za-z0-9' '_')"
  local status
  local curl_args=(--request "$method" --location --silent --show-error --output "$body_file" --write-out '%{http_code}' --max-time 20)

  if [[ -n "$COOKIE_HEADER" ]]; then
    curl_args+=(--header "Cookie: $COOKIE_HEADER")
  fi

  if [[ "$method" == "DELETE" || "$method" == "PATCH" || "$method" == "POST" ]]; then
    curl_args+=(--header "Content-Type: application/json" --data '{}')
  fi

  status="$(curl "${curl_args[@]}" "$BASE_URL$path")"

  if [[ "$status" != "200" ]]; then
    echo "Expected HTTP 200 for $method $path, got $status" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  if ! grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "$body_file"; then
    echo "Expected JSON containing \"ok\":true for $method $path" >&2
    echo "Response body:" >&2
    sed -n '1,80p' "$body_file" >&2
    exit 1
  fi

  echo "OK $method $path returned HTTP 200 and JSON ok:true"
}

check_json_ok "/api-next/health"
check_json_ok "/api-next/health?db=1"
check_json_ok "/api-next/rooms"
check_json_ok "/api-next/rooms/general"
check_json_ok "/api-next/rooms/general/members"
check_json_ok "/api-next/search?q=thia"
check_json_ok "/api-next/badges"
check_json_ok "/api-next/stats"
check_json_ok "/api-next/profiles/thia"
check_json_ok "/api-next/profiles/thia/rooms"
check_json_ok "/api-next/profiles/thia/modules"
check_json_ok "/api-next/profiles/thia/badges"
check_json_ok "/api-next/profiles/thia/followers"
check_json_ok "/api-next/profiles/thia/following"
check_json_ok "/api-next/posts"
check_json_ok "/api-next/feed/home"
check_json_ok "/api-next/feed/discover"
check_json_ok "/api-next/rooms/general/posts"
check_json_ok "/api-next/profiles/thia/posts"
check_json_ok "/api-next/profiles/thia/replies"
check_json_ok "/api-next/profiles/thia/reblogs"

if [[ -n "$COOKIE_HEADER" ]]; then
  check_json_ok "/api-next/auth/me"
  check_json_ok "/api-next/me/settings"
  check_json_ok "/api-next/me/onboarding"
  check_json_ok "/api-next/me/follow-requests"
  check_json_ok "/api-next/me/posts"
  check_json_ok "/api-next/me/profile/modules"
  check_json_ok "/api-next/me/profile/canvas-draft"
  check_json_ok "/api-next/notifications"
  check_json_status_method "POST" "/api-next/notifications/read" "403"
  check_json_status_method "POST" "/api-next/notifications/read-all" "403"
  check_json_status_method "POST" "/api-next/notifications/1/read" "403"
  check_json_status_method "PATCH" "/api-next/me/onboarding" "403"
  check_json_status_method "PATCH" "/api-next/me/privacy" "403"
  check_json_status_method "PATCH" "/api-next/me/preferences" "403"
  check_json_status_method "PATCH" "/api-next/me/profile" "403"
  check_json_status_method "PATCH" "/api-next/me/profile/featured" "403"
  check_json_status_method "POST" "/api-next/me/profile/modules" "403"
  check_json_status_method "PATCH" "/api-next/me/profile/modules/1" "403"
  check_json_status_method "DELETE" "/api-next/me/profile/modules/1" "403"
  check_json_status_method "POST" "/api-next/me/profile/modules/1/restore" "403"
  check_json_status_method "PATCH" "/api-next/me/profile/module-order" "403"
  check_json_status_method "PATCH" "/api-next/me/profile/canvas" "403"
  check_json_status_method "PATCH" "/api-next/me/profile/canvas-draft" "403"
  check_json_status_method "DELETE" "/api-next/me/profile/canvas-draft" "403"
  check_json_status_method "POST" "/api-next/me/profile/canvas-draft/commit" "403"
  check_json_status_method "PATCH" "/api-next/me/badges/featured" "403"
  check_json_status_method "DELETE" "/api-next/me/posts?kind=posts" "403"
  check_json_status_method "PATCH" "/api-next/me/account/email" "403"
  check_json_status_method "PATCH" "/api-next/me/account/handle" "403"
  check_json_status_method "PATCH" "/api-next/me/account/password" "403"
  check_json_status_method "DELETE" "/api-next/me/account" "403"
  check_json_status_method "DELETE" "/api-next/me/account/deletion" "403"
  check_json_status_method "POST" "/api-next/me/account/deletion/cancel" "403"
  check_json_status_method "POST" "/api-next/auth/login" "422"
  check_json_status_method "POST" "/api-next/auth/register" "422"
  check_json_status_method "POST" "/api-next/auth/2fa/verify" "422"
  check_json_status_method "POST" "/api-next/me/security/2fa/setup" "403"
  check_json_status_method "POST" "/api-next/me/security/2fa/enable" "403"
  check_json_status_method "DELETE" "/api-next/me/security/2fa" "403"
  check_json_status_method "POST" "/api-next/me/security/2fa/recovery-codes" "403"
  check_json_status_method "POST" "/api-next/profiles/thia/follow" "403"
  check_json_status_method "DELETE" "/api-next/profiles/thia/follow" "403"
  check_json_status_method "POST" "/api-next/profiles/thia/block" "403"
  check_json_status_method "DELETE" "/api-next/profiles/thia/block" "403"
  check_json_status_method "POST" "/api-next/profiles/thia/mute" "403"
  check_json_status_method "DELETE" "/api-next/profiles/thia/mute" "403"
  check_json_status_method "POST" "/api-next/profiles/thia/star" "403"
  check_json_status_method "DELETE" "/api-next/profiles/thia/star" "403"
  check_json_status_method "DELETE" "/api-next/profiles/thia/follower" "403"
  check_json_status_method "POST" "/api-next/me/follow-requests/1/approve" "403"
  check_json_status_method "DELETE" "/api-next/me/follow-requests/1" "403"
  check_json_status_method "POST" "/api-next/posts" "403"
  check_json_status_method "POST" "/api-next/posts/99/replies" "403"
  check_json_status_method "PATCH" "/api-next/posts/99" "403"
  check_json_status_method "DELETE" "/api-next/posts/99" "403"
  check_json_status_method "POST" "/api-next/posts/99/like" "403"
  check_json_status_method "DELETE" "/api-next/posts/99/like" "403"
  check_json_status_method "POST" "/api-next/posts/99/reblog" "403"
  check_json_status_method "DELETE" "/api-next/posts/99/reblog" "403"
  check_json_status_method "POST" "/api-next/posts/99/reactions" "403"
  check_json_status_method "DELETE" "/api-next/posts/99/reactions/glow" "403"
  check_json_status_method "POST" "/api-next/posts/pc359fe2da759/shares/messages" "403"
  check_json_status_method "POST" "/api-next/rooms" "403"
  check_json_status_method "PATCH" "/api-next/rooms/general" "403"
  check_json_status_method "DELETE" "/api-next/rooms/general" "403"
  check_json_status_method "POST" "/api-next/rooms/general/join" "403"
  check_json_status_method "DELETE" "/api-next/rooms/general/join" "403"
  check_json_status_method "POST" "/api-next/rooms/general/moderators" "403"
  check_json_status_method "DELETE" "/api-next/rooms/general/moderators" "403"
else
  check_json_status "/api-next/auth/me" "401"
  check_json_status "/api-next/me/settings" "401"
  check_json_status "/api-next/me/onboarding" "401"
  check_json_status "/api-next/me/follow-requests" "401"
  check_json_status "/api-next/me/posts" "401"
  check_json_status "/api-next/me/profile/modules" "401"
  check_json_status "/api-next/me/profile/canvas-draft" "401"
  check_json_status "/api-next/notifications" "401"
  check_json_status_method "POST" "/api-next/notifications/read" "401"
  check_json_status_method "POST" "/api-next/notifications/read-all" "401"
  check_json_status_method "POST" "/api-next/notifications/1/read" "401"
  check_json_status_method "PATCH" "/api-next/me/onboarding" "401"
  check_json_status_method "PATCH" "/api-next/me/privacy" "401"
  check_json_status_method "PATCH" "/api-next/me/preferences" "401"
  check_json_status_method "PATCH" "/api-next/me/profile" "401"
  check_json_status_method "PATCH" "/api-next/me/profile/featured" "401"
  check_json_status_method "POST" "/api-next/me/profile/modules" "401"
  check_json_status_method "PATCH" "/api-next/me/profile/modules/1" "401"
  check_json_status_method "DELETE" "/api-next/me/profile/modules/1" "401"
  check_json_status_method "POST" "/api-next/me/profile/modules/1/restore" "401"
  check_json_status_method "PATCH" "/api-next/me/profile/module-order" "401"
  check_json_status_method "PATCH" "/api-next/me/profile/canvas" "401"
  check_json_status_method "PATCH" "/api-next/me/profile/canvas-draft" "401"
  check_json_status_method "DELETE" "/api-next/me/profile/canvas-draft" "401"
  check_json_status_method "POST" "/api-next/me/profile/canvas-draft/commit" "401"
  check_json_status_method "PATCH" "/api-next/me/badges/featured" "401"
  check_json_status_method "DELETE" "/api-next/me/posts?kind=posts" "401"
  check_json_status_method "PATCH" "/api-next/me/account/email" "401"
  check_json_status_method "PATCH" "/api-next/me/account/handle" "401"
  check_json_status_method "PATCH" "/api-next/me/account/password" "401"
  check_json_status_method "DELETE" "/api-next/me/account" "401"
  check_json_status_method "DELETE" "/api-next/me/account/deletion" "401"
  check_json_status_method "POST" "/api-next/me/account/deletion/cancel" "401"
  check_json_status_method "POST" "/api-next/auth/login" "422"
  check_json_status_method "POST" "/api-next/auth/register" "422"
  check_json_status_method "POST" "/api-next/auth/2fa/verify" "422"
  check_json_ok_method "POST" "/api-next/auth/logout"
  check_json_status_method "POST" "/api-next/me/security/2fa/setup" "401"
  check_json_status_method "POST" "/api-next/me/security/2fa/enable" "401"
  check_json_status_method "DELETE" "/api-next/me/security/2fa" "401"
  check_json_status_method "POST" "/api-next/me/security/2fa/recovery-codes" "401"
  check_json_status_method "POST" "/api-next/profiles/thia/follow" "401"
  check_json_status_method "DELETE" "/api-next/profiles/thia/follow" "401"
  check_json_status_method "POST" "/api-next/profiles/thia/block" "401"
  check_json_status_method "DELETE" "/api-next/profiles/thia/block" "401"
  check_json_status_method "POST" "/api-next/profiles/thia/mute" "401"
  check_json_status_method "DELETE" "/api-next/profiles/thia/mute" "401"
  check_json_status_method "POST" "/api-next/profiles/thia/star" "401"
  check_json_status_method "DELETE" "/api-next/profiles/thia/star" "401"
  check_json_status_method "DELETE" "/api-next/profiles/thia/follower" "401"
  check_json_status_method "POST" "/api-next/me/follow-requests/1/approve" "401"
  check_json_status_method "DELETE" "/api-next/me/follow-requests/1" "401"
  check_json_status_method "POST" "/api-next/posts" "401"
  check_json_status_method "POST" "/api-next/posts/99/replies" "401"
  check_json_status_method "PATCH" "/api-next/posts/99" "401"
  check_json_status_method "DELETE" "/api-next/posts/99" "401"
  check_json_status_method "POST" "/api-next/posts/99/like" "401"
  check_json_status_method "DELETE" "/api-next/posts/99/like" "401"
  check_json_status_method "POST" "/api-next/posts/99/reblog" "401"
  check_json_status_method "DELETE" "/api-next/posts/99/reblog" "401"
  check_json_status_method "POST" "/api-next/posts/99/reactions" "401"
  check_json_status_method "DELETE" "/api-next/posts/99/reactions/glow" "401"
  check_json_status_method "POST" "/api-next/posts/pc359fe2da759/shares/messages" "401"
  check_json_status_method "POST" "/api-next/rooms" "401"
  check_json_status_method "PATCH" "/api-next/rooms/general" "401"
  check_json_status_method "DELETE" "/api-next/rooms/general" "401"
  check_json_status_method "POST" "/api-next/rooms/general/join" "401"
  check_json_status_method "DELETE" "/api-next/rooms/general/join" "401"
  check_json_status_method "POST" "/api-next/rooms/general/moderators" "401"
  check_json_status_method "DELETE" "/api-next/rooms/general/moderators" "401"
fi
