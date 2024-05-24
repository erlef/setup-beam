#!/usr/bin/env bash

set -eux

git config user.name "GitHub Actions"
git config user.email "actions@user.noreply.github.com"

BRANCH=feature/3rd-party-licenses-update

if git branch -a | grep "$BRANCH" > /dev/null; then
    # already exists
    exit
fi

git fetch origin
git checkout -b "$BRANCH"
npm run licenses

if ! git diff --exit-code 1> /dev/null ; then
    # there's stuff to push
    git add 3RD_PARTY_LICENSES
    git commit -m "Update 3rd party licenses"
    git push origin "$BRANCH"

    gh pr create --fill \
        --title "Update 3rd party licenses (automation)" \
        --body "This is an automated action to update the action's 3rd party licenses"
fi
