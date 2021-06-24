param([Parameter(Mandatory=$true)][string]$VSN)

$ErrorActionPreference="Stop"

Set-Location $Env:RUNNER_TEMP

$FILE_OUTPUT="otp.exe"
$DIR_FOR_BIN=".setup-beam/otp"

Remove-Item -Recurse -Force "$DIR_FOR_BIN" -ErrorAction SilentlyContinue
$ProgressPreference="SilentlyContinue"
Invoke-WebRequest "https://github.com/erlang/otp/releases/download/OTP-$VSN/otp_win64_$VSN.exe" -OutFile "$FILE_OUTPUT"
$ProgressPreference="Continue"
New-Item "$DIR_FOR_BIN" -ItemType Directory | Out-Null
Move-Item "$FILE_OUTPUT" "$DIR_FOR_BIN"
Start-Process "./$DIR_FOR_BIN/$FILE_OUTPUT" /S -Wait
Write-Output "C:/Program Files/erl-$VSN/bin" | Out-File -FilePath $Env:GITHUB_PATH -Encoding utf8 -Append
Write-Output "Installed Erlang/OTP version follows"
& "C:/Program Files/erl-$VSN/bin/erl.exe" "+V" | Write-Output
