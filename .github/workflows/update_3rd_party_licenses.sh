#!/usr/bin/env bash

set -eux

git config user.name "GitHub Actions"
git config user.email "actions@user.noreply.github.com"
git checkout main

npm run licenses

git add 3RD_PARTY_LICENSES
git commit -m "Update 3rd party licenses" || true
git push origin
