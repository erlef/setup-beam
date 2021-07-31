param([Parameter(Mandatory=$true)][string]$VSN)

$ErrorActionPreference="Stop"

Set-Location $Env:RUNNER_TEMP

$FILE_INPUT="${VSN}.zip"
$FILE_OUTPUT="elixir.zip"
$DIR_FOR_BIN=".setup-beam/elixir"

$ProgressPreference="SilentlyContinue"
Invoke-WebRequest "https://repo.hex.pm/builds/elixir/${FILE_INPUT}" -OutFile "$FILE_OUTPUT"
$ProgressPreference="Continue"
New-Item "$DIR_FOR_BIN" -ItemType Directory | Out-Null
$ProgressPreference="SilentlyContinue"
Expand-Archive -DestinationPath "${DIR_FOR_BIN}" -Path "${FILE_OUTPUT}"
$ProgressPreference="Continue"
Write-Output "Installed Elixir version follows"
& "$DIR_FOR_BIN/bin/iex" "-v" | Write-Output
