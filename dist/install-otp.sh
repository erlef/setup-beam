#!/bin/bash

set -eo pipefail

cd "$RUNNER_TEMP"

OS=${1}
VSN=${2}
FILE_INPUT="${VSN}.tar.gz"
FILE_OUTPUT=otp.tar.gz
DIR_FOR_BIN=.setup-beam/otp

rm -f "${FILE_OUTPUT}"
rm -rf "${DIR_FOR_BIN}"
wget -q -O "${FILE_OUTPUT}" "https://repo.hex.pm/builds/otp/${OS}/${FILE_INPUT}"
mkdir -p "${DIR_FOR_BIN}"
tar zxf "${FILE_OUTPUT}" -C "${DIR_FOR_BIN}" --strip-components=1
rm -f "${FILE_OUTPUT}"
"${DIR_FOR_BIN}/Install" -minimal "$(pwd)/${DIR_FOR_BIN}"
echo "$(pwd)/${DIR_FOR_BIN}/bin" >> "$GITHUB_PATH"
echo "Installed Erlang/OTP version follows"
${DIR_FOR_BIN}/bin/erl -version
