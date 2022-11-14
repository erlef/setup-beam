#!/bin/bash

set -eo pipefail

cd "${RUNNER_TEMP}"

VSN=${1}
HEX_MIRROR=${2}
FILE_INPUT="${VSN}.zip"
FILE_OUTPUT=elixir.zip
DIR_FOR_BIN=.setup-beam/elixir

wget -q -O "${FILE_OUTPUT}" "${HEX_MIRROR}/builds/elixir/${FILE_INPUT}"
mkdir -p "${DIR_FOR_BIN}"
unzip -q -o -d "${DIR_FOR_BIN}" "${FILE_OUTPUT}"
echo "Installed Elixir version follows"
${DIR_FOR_BIN}/bin/elixir -v

mkdir -p "${HOME}/.mix/escripts"

echo "INSTALL_DIR_FOR_ELIXIR=${RUNNER_TEMP}/${DIR_FOR_BIN}" >> "${GITHUB_ENV}"
