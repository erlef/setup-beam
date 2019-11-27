const core = require('@actions/core')
const {exec} = require('@actions/exec')
const {installElixir, installOTP} = require('./installer')
const {readFile} = require('fs').promises
const path = require('path')
const semver = require('semver')

main().catch(err => {
  core.setFailed(err.message)
})

async function main() {
  checkPlatform()

  const otpSpec = core.getInput('otp-version', {required: true})
  const elixirSpec = core.getInput('elixir-version', {required: true})
  const otpVersion = await getVersion(
    otpSpec,
    path.join(__dirname, 'erlang-versions.txt')
  )
  const elixirVersion = await getVersion(
    elixirSpec,
    path.join(__dirname, 'elixir-versions.txt')
  )

  let installHex = core.getInput('install-hex')
  installHex = installHex == null ? true : installHex
  let installRebar = core.getInput('install-rebar')
  installRebar = installRebar == null ? true : installRebar

  console.log(`##[group]Installing OTP ${otpVersion}`)
  await installOTP(otpVersion)
  console.log(`##[endgroup]`)

  console.log(`##[group]Installing Elixir ${elixirVersion}`)
  await installElixir(elixirVersion)
  console.log(`##[endgroup]`)

  if (installRebar) await exec('mix local.rebar --force')
  if (installHex) await exec('mix local.hex --force')

  const matchersPath = path.join(__dirname, '..', '.github');
  console.log(`##[add-matcher]${path.join(matchersPath, 'elixir.json')}`);
}

function checkPlatform() {
  if (process.platform !== 'linux')
    throw new Error(
      '@actions/setup-elixir only supports Ubuntu Linux at this time'
    )
}

async function getVersion(spec, versionFile) {
  const range = semver.validRange(spec)
  const versions = (await readFile(versionFile)).toString().split('\n')
  const version = semver.maxSatisfying(versions, range)
  return version || spec
}
