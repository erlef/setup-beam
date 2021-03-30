const { exec } = require('@actions/exec')
const path = require('path')

/**
 * Install Erlang/OTP.
 *
 * @param {string} osVersion
 * @param {string} otpVersion
 */
async function installOTP(osVersion, otpVersion) {
  await exec(path.join(__dirname, 'install-otp'), [osVersion, otpVersion])
}

/**
 * Install Elixir.
 *
 * @param {string} elixirVersion
 */
async function installElixir(elixirVersion) {
  await exec(path.join(__dirname, 'install-elixir'), [elixirVersion])
}

/**
 * Install rebar3.
 *
 * @param {string} rebar3Version
 */
async function installRebar3(rebar3Version) {
  await exec(path.join(__dirname, 'install-rebar3'), [rebar3Version])
}

function checkPlatform() {
  if (process.platform !== 'linux') {
    throw new Error('@erlef/setup-beam only supports Ubuntu Linux at this time')
  }
}

module.exports = {
  installOTP,
  installElixir,
  installRebar3,
  checkPlatform,
}
