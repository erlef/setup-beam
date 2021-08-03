const { exec } = require('@actions/exec')
const path = require('path')

/**
 * Install Erlang/OTP.
 *
 * @param {string} osVersion
 * @param {string} otpVersion
 */
async function installOTP(osVersion, otpVersion) {
  const OS = process.platform
  if (OS === 'linux') {
    await exec(path.join(__dirname, 'install-otp.sh'), [osVersion, otpVersion])
  } else if (OS === 'win32') {
    const script = path.join(__dirname, 'install-otp.ps1')
    await exec(`pwsh.exe ${script} -VSN:${otpVersion}`)
  }
}

/**
 * Install Elixir.
 *
 * @param {string} elixirVersion
 */
async function installElixir(elixirVersion) {
  const OS = process.platform
  if (OS === 'linux') {
    await exec(path.join(__dirname, 'install-elixir.sh'), [elixirVersion])
  } else if (OS === 'win32') {
    const script = path.join(__dirname, 'install-elixir.ps1')
    await exec(`pwsh.exe ${script} -VSN:${elixirVersion}`)
  }
}

/**
 * Install Gleam.
 *
 * @param {string} gleamVersion
 */
async function installGleam(gleamVersion) {
  const OS = process.platform
  if (OS === 'linux') {
    await exec(path.join(__dirname, 'install-gleam.sh'), [gleamVersion])
  } else if (OS === 'win32') {
    const script = path.join(__dirname, 'install-gleam.ps1')
    await exec(`pwsh.exe ${script} -VSN:${gleamVersion}`)
  }
}

/**
 * Install rebar3.
 *
 * @param {string} rebar3Version
 */
async function installRebar3(rebar3Version) {
  const OS = process.platform
  if (OS === 'linux') {
    await exec(path.join(__dirname, 'install-rebar3.sh'), [rebar3Version])
  } else if (OS === 'win32') {
    const script = path.join(__dirname, 'install-rebar3.ps1')
    await exec(`pwsh.exe ${script} -VSN:${rebar3Version}`)
  }
}

function checkPlatform() {
  if (process.platform !== 'linux' && process.platform !== 'win32') {
    throw new Error(
      '@erlef/setup-beam only supports Ubuntu and Windows at this time',
    )
  }
}

module.exports = {
  installOTP,
  installElixir,
  installGleam,
  installRebar3,
  checkPlatform,
}
