const {exec} = require('@actions/exec')
const path = require('path')
const semver = require('semver')

module.exports = {installElixir, installOTP}

/**
 * Install Elixir.
 *
 * @param {string} version
 * @param {string} otpMajor
 */
async function installElixir(version, otpMajor) {
  if (process.platform === 'linux') {
    const otpString = otpMajor ? `-otp-${otpMajor}` : ''
    await exec(path.join(__dirname, 'install-elixir'), [version, otpString])
  }
}

/**
 * Install OTP.
 *
 * @param {string} version
 */
async function installOTP(version, osVersion) {
  if (process.platform === 'linux') {
    await exec(path.join(__dirname, 'install-otp'), [version, osVersion])
    return
  }

  throw new Error(
    '@actions/setup-elixir only supports Ubuntu Linux at this time'
  )
}
