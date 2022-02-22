#!/bin/bash

set -eo pipefail

cd "${RUNNER_TEMP}"

VSN=${1}
FILE_INPUT="${VSN}.zip"
FILE_OUTPUT=elixir.zip
DIR_FOR_BIN=.setup-beam/elixir

wget -q -O "${FILE_OUTPUT}" "https://repo.hex.pm/builds/elixir/${FILE_INPUT}"
mkdir -p "${DIR_FOR_BIN}"
unzip -q -d "${DIR_FOR_BIN}" "${FILE_OUTPUT}"
echo "Installed Elixir version follows"
${DIR_FOR_BIN}/bin/elixir -v

echo "INSTALL_DIR_FOR_ELIXIR=${RUNNER_TEMP}/${DIR_FOR_BIN}" >> "${GITHUB_ENV}"
