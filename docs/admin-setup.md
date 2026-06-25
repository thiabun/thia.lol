# Admin Account Setup

> **Status: Operational reference.** Use this only for one-time seeded admin
> activation and setup-token handling. Do not commit real setup tokens,
> passwords, emails, or server config.

This one-time setup activates the seeded `@thia` account for login without
committing a real email, password, or setup token.

## Generate a Setup Token

Generate a long random token on your local machine:

```bash
openssl rand -base64 48
```

Do not commit this token. Store it only in the server-only Node API environment:

```text
/srv/thia.lol/config/node-api.env
```

## Enable Temporary Setup

On the server, set:

```text
THIA_ACCOUNT_SETUP_TOKEN=<paste-generated-token-here>
```

Restart the Node API after editing the environment file:

```bash
sudo systemctl restart thia-node-api.service
systemctl is-active thia-node-api.service
```

Do not put the real token in examples, docs, commit messages, tickets, or chat.

## Activate `@thia`

Use environment variables so the token and password do not appear in shell
history as literal values:

```bash
read -r THIA_SETUP_TOKEN
read -r THIA_ADMIN_EMAIL
read -rs THIA_ADMIN_PASSWORD
export THIA_SETUP_TOKEN THIA_ADMIN_EMAIL THIA_ADMIN_PASSWORD

node -e 'process.stdout.write(JSON.stringify({ email: process.env.THIA_ADMIN_EMAIL, password: process.env.THIA_ADMIN_PASSWORD }))' \
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

1. Remove `THIA_ACCOUNT_SETUP_TOKEN` from `/srv/thia.lol/config/node-api.env`, or set it back to an empty value.
2. Restart `thia-node-api.service`.
3. Confirm `POST /api/setup/thia` returns `404` or `403` without the token.

Leaving setup enabled after account activation is a security risk.
