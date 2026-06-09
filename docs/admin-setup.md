# Admin Account Setup

This one-time setup activates the seeded `@thia` account for login without committing a real email, password, or setup token.

## Generate a Setup Token

Generate a long random token on your local machine:

```bash
openssl rand -base64 48
```

Do not commit this token. Store it only in the server-only `config/config.php`.

## Enable Temporary Setup

On the server, edit the untracked config file:

```text
public_html/config/config.php
```

Set `security.account_setup_token` to the generated token:

```php
'security' => [
    'cookie_name' => 'thia_session',
    'csrf_secret' => 'your-existing-csrf-secret',
    'account_setup_token' => 'paste-generated-token-here',
    'session_lifetime_seconds' => 2592000,
    'login_rate_limit_attempts' => 8,
    'login_rate_limit_window_seconds' => 900,
    'register_rate_limit_attempts' => 5,
    'register_rate_limit_window_seconds' => 3600,
],
```

Do not put the real token in `config/config.example.php`, docs, commit messages, tickets, or chat.

## Activate `@thia`

Use environment variables so the token and password do not appear in shell history as literal values:

```bash
read -r THIA_SETUP_TOKEN
read -r THIA_ADMIN_EMAIL
read -rs THIA_ADMIN_PASSWORD
export THIA_SETUP_TOKEN THIA_ADMIN_EMAIL THIA_ADMIN_PASSWORD

php -r 'echo json_encode(["email" => getenv("THIA_ADMIN_EMAIL"), "password" => getenv("THIA_ADMIN_PASSWORD")]);' \
  | curl --fail-with-body \
  --request POST \
  --url "https://thia.lol/api/setup/thia" \
  --header "Content-Type: application/json" \
  --header "X-Setup-Token: ${THIA_SETUP_TOKEN}" \
  --data-binary @-

unset THIA_SETUP_TOKEN THIA_ADMIN_EMAIL THIA_ADMIN_PASSWORD
```

Expected response:

```json
{"ok":true,"data":{"activated":true,"handle":"thia"}}
```

## Verify Access

1. Visit `https://thia.lol/login`.
2. Log in with the email and password used in the setup request.
3. Visit `https://thia.lol/admin`.
4. Confirm the account can access the admin queue.

## Disable Setup Immediately

After activation, disable the setup mechanism before leaving the deployment:

1. Remove `account_setup_token` from `public_html/config/config.php`, or set it back to an empty string.
2. Delete `public_html/api/setup.php` from the server if the temporary file was uploaded.
3. On the next API deploy, remove the setup route and handler from the repo.

Leaving setup enabled after account activation is a security risk.
