param([Parameter(Mandatory=$true)][string]$VSN)

$ErrorActionPreference="Stop"

Set-Location $Env:RUNNER_TEMP

$FILE_INPUT="rebar3"
$FILE_OUTPUT="rebar3"
$FILE_OUTPUT_PS1="rebar3.ps1"
$DIR_FOR_BIN=".setup-beam/rebar3"

$ProgressPreference="SilentlyContinue"
$REBAR3_TARGET="https://github.com/erlang/rebar3/releases/download/${VSN}/${FILE_INPUT}"
$REBAR3_NIGHTLY=""
If ( $VSN -eq "nightly" )
{
    $REBAR3_TARGET="https://s3.amazonaws.com/rebar3-nightly/rebar3"
    $REBAR3_NIGHTLY=" (from nightly build)"
}
Invoke-WebRequest "$REBAR3_TARGET" -OutFile "$FILE_OUTPUT"
$ProgressPreference="Continue"
New-Item "$DIR_FOR_BIN/bin" -ItemType Directory | Out-Null
Move-Item "$FILE_OUTPUT" "$DIR_FOR_BIN/bin"
Write-Output "& escript.exe $PWD/$DIR_FOR_BIN/bin/$FILE_OUTPUT `$args" | Out-File -FilePath "$FILE_OUTPUT_PS1" -Encoding utf8 -Append
type $FILE_OUTPUT_PS1
Move-Item "$FILE_OUTPUT_PS1" "$DIR_FOR_BIN/bin"
Write-Output "Installed rebar3 version$REBAR3_NIGHTLY follows"
& "$DIR_FOR_BIN/bin/rebar3" "version" | Write-Output

"INSTALL_DIR_FOR_REBAR3=${Env:RUNNER_TEMP}/${DIR_FOR_BIN}" | Out-File -FilePath ${Env:GITHUB_ENV} -Encoding utf8 -Append
