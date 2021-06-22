param([Parameter(Mandatory=$true)][string]$VSN)

$ErrorActionPreference="Stop"

Set-Location $Env:RUNNER_TEMP

$FILE_INPUT="rebar3"
$FILE_OUTPUT="rebar3"
$FILE_OUTPUT_PS1="rebar3.ps1"
$DIR_FOR_BIN=".setup-beam/rebar3"

Remove-Item -Force "$FILE_OUTPUT" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$DIR_FOR_BIN" -ErrorAction SilentlyContinue
$ProgressPreference="SilentlyContinue"
Invoke-WebRequest "https://github.com/erlang/rebar3/releases/download/${VSN}/${FILE_INPUT}" -OutFile "$FILE_OUTPUT"
$ProgressPreference="Continue"
New-Item "$DIR_FOR_BIN/bin" -ItemType Directory | Out-Null
Move-Item "$FILE_OUTPUT" "$DIR_FOR_BIN/bin"
Write-Output "& escript.exe $PWD/$DIR_FOR_BIN/bin/$FILE_OUTPUT `$args" | Out-File -FilePath "$FILE_OUTPUT_PS1" -Encoding utf8 -Append
type $FILE_OUTPUT_PS1
Move-Item "$FILE_OUTPUT_PS1" "$DIR_FOR_BIN/bin"
Write-Output "$PWD/$DIR_FOR_BIN/bin" | Out-File -FilePath $Env:GITHUB_PATH -Encoding utf8 -Append
Write-Output "Installed rebar3 version follows"
& "$DIR_FOR_BIN/bin/rebar3" "version" | Write-Output
