#!/bin/bash

set -eo pipefail

cd "$RUNNER_TEMP"

VSN=${1}
FILE_INPUT=gleam-${VSN}-linux-amd64.tar.gz
FILE_OUTPUT=gleam.tar.gz
DIR_FOR_BIN=.setup-beam/gleam/bin

wget -q -O "${FILE_OUTPUT}" "https://github.com/gleam-lang/gleam/releases/download/${VSN}/${FILE_INPUT}"
mkdir -p "${DIR_FOR_BIN}"
tar zxf "${FILE_OUTPUT}" -C "${DIR_FOR_BIN}"

echo "Installed Gleam version follows"
${DIR_FOR_BIN}/gleam --version
