#!/bin/bash

set -eo pipefail

cd "${RUNNER_TEMP}"

VSN="$1"
FILE_OUTPUT=gleam.tar.gz
DIR_FOR_BIN=.setup-beam/gleam

version_gt() {
  test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

uses_llvm_triplets() {
  local version="$1"
  test "$version" = "nightly" || version_gt "$version" "v0.22.1"
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
