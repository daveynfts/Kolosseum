#!/bin/sh
set -eu
umask 077
mkdir -p /home/pay/.config/pay
# Sandbox CLI chooses a named ephemeral gateway account before reading provider
# signer configuration. Seed it from Railway secrets so restarts keep its identity.
test -n "${PAY_SANDBOX_ACCOUNTS_JSON:-}"
printf '%s' "$PAY_SANDBOX_ACCOUNTS_JSON" > /home/pay/.config/pay/accounts.yml
unset PAY_SANDBOX_ACCOUNTS_JSON
exec pay "$@"
