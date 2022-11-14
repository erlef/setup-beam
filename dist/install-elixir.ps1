param([Parameter(Mandatory=$true)][string]${VSN}, [Parameter(Mandatory=$true)][string]${HEX_MIRROR})

$ErrorActionPreference="Stop"

Set-Location ${Env:RUNNER_TEMP}

$FILE_INPUT="${VSN}.zip"
$FILE_OUTPUT="elixir.zip"
$DIR_FOR_BIN=".setup-beam/elixir"

$ProgressPreference="SilentlyContinue"
Invoke-WebRequest "${HEX_MIRROR}/builds/elixir/${FILE_INPUT}" -OutFile "${FILE_OUTPUT}"
$ProgressPreference="Continue"
New-Item "${DIR_FOR_BIN}" -ItemType Directory | Out-Null
$ProgressPreference="SilentlyContinue"
Expand-Archive -DestinationPath "${DIR_FOR_BIN}" -Path "${FILE_OUTPUT}"
$ProgressPreference="Continue"
Write-Output "Installed Elixir version follows"
& "${DIR_FOR_BIN}/bin/elixir" "-v" | Write-Output

$ProgressPreference="Continue"
New-Item "%UserProfile%/.mix/escripts" -ItemType Directory | Out-Null

"INSTALL_DIR_FOR_ELIXIR=${Env:RUNNER_TEMP}/${DIR_FOR_BIN}" | Out-File -FilePath ${Env:GITHUB_ENV} -Encoding utf8 -Append
