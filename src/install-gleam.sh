#!/bin/bash

set -eo pipefail

cd "${RUNNER_TEMP}"

VSN="$1"
FILE_OUTPUT=gleam.tar.gz
DIR_FOR_BIN=.setup-beam/gleam

version_gt() {
  REFERENCE=$1
  test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$REFERENCE"
}

uses_llvm_triplets() {
  local VERSION="$1"
  test "${VERSION}" = "nightly" || version_gt "${VERSION}" "v0.22.1"
}

if uses_llvm_triplets "$VSN"
then
  FILE_INPUT="gleam-${VSN}-x86_64-unknown-linux-musl.tar.gz"
else
  FILE_INPUT="gleam-${VSN}-linux-amd64.tar.gz"
fi

wget -q -O "${FILE_OUTPUT}" "https://github.com/gleam-lang/gleam/releases/download/${VSN}/${FILE_INPUT}"
mkdir -p "${DIR_FOR_BIN}/bin"
tar zxf "${FILE_OUTPUT}" -C "${DIR_FOR_BIN}/bin"

echo "Installed Gleam version follows"
${DIR_FOR_BIN}/bin/gleam --version

echo "INSTALL_DIR_FOR_GLEAM=${RUNNER_TEMP}/${DIR_FOR_BIN}" >> "${GITHUB_ENV}"
