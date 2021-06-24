param([Parameter(Mandatory=$true)][string]$VSN)

$ErrorActionPreference="Stop"

Set-Location $Env:RUNNER_TEMP

$FILE_OUTPUT="otp.exe"
$DIR_FOR_BIN=".setup-beam/otp"

$ProgressPreference="SilentlyContinue"
Invoke-WebRequest "https://github.com/erlang/otp/releases/download/OTP-$VSN/otp_win64_$VSN.exe" -OutFile "$FILE_OUTPUT"
$ProgressPreference="Continue"
New-Item "$DIR_FOR_BIN" -ItemType Directory | Out-Null
Move-Item "$FILE_OUTPUT" "$DIR_FOR_BIN"
Start-Process "./$DIR_FOR_BIN/$FILE_OUTPUT" /S -Wait
$ErlExec = Get-ChildItem -Path "C:/Program Files/" -Recurse -Depth 2 -Filter 'erl.exe' -Name | ForEach-Object { Write-Output "C:/Program Files/$_" }
$ErlPath = Split-Path -Path "$ErlExec"
Write-Output "$ErlPath" | Out-File -FilePath otp_path.txt -Encoding utf8 -NoNewline
Write-Output "Installed Erlang/OTP version follows"
& "$ErlPath/erl.exe" "+V" | Write-Output
