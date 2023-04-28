param([Parameter(Mandatory=$true)][string]${VSN})

$ErrorActionPreference="Stop"

Set-Location ${Env:RUNNER_TEMP}
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned

$FILE_INPUT="otp_win64_${VSN}.exe"
$FILE_OUTPUT="otp.exe"
$DIR_FOR_BIN="${Env:RUNNER_TEMP}\.setup-beam\otp"

$ProgressPreference="SilentlyContinue"
Invoke-WebRequest "https://github.com/erlang/otp/releases/download/OTP-${VSN}/${FILE_INPUT}" -OutFile "${FILE_OUTPUT}"
$ProgressPreference="Continue"
New-Item "${DIR_FOR_BIN}" -ItemType Directory | Out-Null
$ProgressPreference="SilentlyContinue"
Start-Process "${FILE_OUTPUT}" "/S /D=${DIR_FOR_BIN}" -Wait
Write-Output "Installed Erlang/OTP version follows"
& "${DIR_FOR_BIN}/bin/erl.exe" "+V" | Write-Output

"INSTALL_DIR_FOR_OTP=${DIR_FOR_BIN}" | Out-File -FilePath ${Env:GITHUB_ENV} -Encoding utf8 -Append
