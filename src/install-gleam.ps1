param([Parameter(Mandatory=$true)][string]$VSN)

$ErrorActionPreference="Stop"

Set-Location $Env:RUNNER_TEMP

$FILE_INPUT="gleam-${VSN}-windows-64bit.zip"
$FILE_OUTPUT="gleam.zip"
$DIR_FOR_BIN=".setup-beam/gleam/bin"

$ProgressPreference="SilentlyContinue"
Invoke-WebRequest "https://github.com/gleam-lang/gleam/releases/download/${VSN}/${FILE_INPUT}" -OutFile "$FILE_OUTPUT"
$ProgressPreference="Continue"
New-Item "$DIR_FOR_BIN" -ItemType Directory | Out-Null
$ProgressPreference="SilentlyContinue"
Expand-Archive -DestinationPath "${DIR_FOR_BIN}" -Path "${FILE_OUTPUT}"
$ProgressPreference="Continue"
Write-Output "Installed Gleam version follows"
& "$DIR_FOR_BIN/gleam" "--version" | Write-Output
