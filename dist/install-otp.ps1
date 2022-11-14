param([Parameter(Mandatory=$true)][string]${VSN})

$ErrorActionPreference="Stop"

Set-Location ${Env:RUNNER_TEMP}

$FILE_OUTPUT="otp_win64_${VSN}.exe"
$ERL_ROOT = "${Env:RUNNER_TEMP}\.setup-beam\otp"

$ProgressPreference="SilentlyContinue"
Invoke-WebRequest "https://github.com/erlang/otp/releases/download/OTP-${VSN}/otp_win64_${VSN}.exe" -OutFile "${FILE_OUTPUT}"
$ProgressPreference="Continue"
Start-Process "${FILE_OUTPUT}" "/S /D=${ERL_ROOT}" -Wait
Write-Output "Installed Erlang/OTP version follows"
& "${ERL_ROOT}/bin/erl.exe" "+V" | Write-Output

"INSTALL_DIR_FOR_OTP=${ERL_ROOT}" | Out-File -FilePath ${Env:GITHUB_ENV} -Encoding utf8 -Append
