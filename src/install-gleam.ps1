param([Parameter(Mandatory=$true)][string]${VSN})

$ErrorActionPreference="Stop"

Set-Location ${Env:RUNNER_TEMP}

$FILE_INPUT="gleam-${VSN}-windows-64bit.zip"
$FILE_OUTPUT="gleam.zip"
$DIR_FOR_BIN=".setup-beam/gleam"

$ProgressPreference="SilentlyContinue"
Invoke-WebRequest "https://github.com/gleam-lang/gleam/releases/download/${VSN}/${FILE_INPUT}" -OutFile "${FILE_OUTPUT}"
$ProgressPreference="Continue"
New-Item "${DIR_FOR_BIN}/bin" -ItemType Directory | Out-Null
$ProgressPreference="SilentlyContinue"
Expand-Archive -DestinationPath "${DIR_FOR_BIN}/bin" -Path "${FILE_OUTPUT}"
$ProgressPreference="Continue"
Write-Output "Installed Gleam version follows"
& "${DIR_FOR_BIN}/bin/gleam" "--version" | Write-Output

"INSTALL_DIR_FOR_GLEAM=${Env:RUNNER_TEMP}/${DIR_FOR_BIN}" | Out-File -FilePath ${Env:GITHUB_ENV} -Encoding utf8 -Append
