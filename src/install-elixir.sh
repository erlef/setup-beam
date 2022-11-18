#!/bin/bash

set -eo pipefail

cd "${RUNNER_TEMP}"

VSN=${1}
HEX_MIRROR=${2}
CACHEDIR="${RUNNER_TEMP}/.setup-beam/cache"
FILE_INPUT="${VSN}.zip"
FILE_OUTPUT="${CACHEDIR}/elixir.zip"
DIR_FOR_BIN=.setup-beam/elixir

mkdir -p "${CACHEDIR}"
[ -e "${FILE_OUTPUT}" ] || curl -sfL -o "${FILE_OUTPUT}" "${HEX_MIRROR}/builds/elixir/${FILE_INPUT}"
mkdir -p "${DIR_FOR_BIN}"
unzip -q -o -d "${DIR_FOR_BIN}" "${FILE_OUTPUT}" || {
    rm "${FILE_OUTPUT}"
    exit 1
}
echo "Installed Elixir version follows"
${DIR_FOR_BIN}/bin/elixir -v

echo "INSTALL_DIR_FOR_ELIXIR=${RUNNER_TEMP}/${DIR_FOR_BIN}" >> "${GITHUB_ENV}"
