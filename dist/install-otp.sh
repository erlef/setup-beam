#!/bin/bash

set -eo pipefail

cd "${RUNNER_TEMP}"

OS=${1}
VSN=${2}
HEX_MIRROR=${3}
FILE_INPUT="${VSN}.tar.gz"
FILE_OUTPUT=otp.tar.gz
DIR_FOR_BIN=.setup-beam/otp

wget -q -O "${FILE_OUTPUT}" "${HEX_MIRROR}/builds/otp/${OS}/${FILE_INPUT}"
mkdir -p "${DIR_FOR_BIN}"
tar zxf "${FILE_OUTPUT}" -C "${DIR_FOR_BIN}" --strip-components=1
"${DIR_FOR_BIN}/Install" -minimal "$(pwd)/${DIR_FOR_BIN}"
echo "Installed Erlang/OTP version follows"
${DIR_FOR_BIN}/bin/erl -version

echo "INSTALL_DIR_FOR_OTP=${RUNNER_TEMP}/${DIR_FOR_BIN}" >> "${GITHUB_ENV}"
