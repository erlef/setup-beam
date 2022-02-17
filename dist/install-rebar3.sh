#!/bin/bash

set -eo pipefail

cd "$RUNNER_TEMP"

VSN=${1}
FILE_INPUT=rebar3
FILE_OUTPUT=rebar3
DIR_FOR_BIN=.setup-beam/rebar3

REBAR3_TARGET="https://github.com/erlang/rebar3/releases/download/${VSN}/${FILE_INPUT}"
REBAR3_NIGHTLY=""
if [ "${VSN}" == "nightly" ]; then
    REBAR3_TARGET="https://s3.amazonaws.com/rebar3-nightly/rebar3"
    REBAR3_NIGHTLY=" (from nightly build)"
fi
wget -q -O "${FILE_OUTPUT}" "${REBAR3_TARGET}"
mkdir -p "${DIR_FOR_BIN}/bin"
chmod +x "${FILE_OUTPUT}"
mv "${FILE_OUTPUT}" "${DIR_FOR_BIN}/bin"
echo "Installed rebar3 version$REBAR3_NIGHTLY follows"
${DIR_FOR_BIN}/bin/rebar3 version

echo "INSTALL_DIR_FOR_REBAR3=${RUNNER_TEMP}/${DIR_FOR_BIN}" >> "${GITHUB_ENV}"
