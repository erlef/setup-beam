const {exec} = require('@actions/exec')
const path = require('path')
const semver = require('semver')

module.exports = {installElixir, installOTP}

/**
 * Install Elixir.
 *
 * @param {string} version
 * @param {string} arch
 */
async function installElixir(version) {
  let arch = 'all'
  if (semver.gt('1.9.0', version)) arch = 'amd64'

  if (process.platform === 'linux') {
    await exec(path.join(__dirname, 'install-elixir-ubuntu'), [version, arch])
  }
}

/**
 * Install OTP.
 *
 * @param {string} version
 */
async function installOTP(version) {
  if (process.platform === 'linux') {
    await exec(path.join(__dirname, 'install-otp-ubuntu'), [version])
    return
  }

  throw new Error(
    '@actions/setup-elixir only supports Ubuntu Linux at this time'
  )
}
