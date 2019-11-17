const core = require('@actions/core')
const {exec} = require('@actions/exec')
const {installElixir, installOTP} = require('./installer')
const path = require('path')
const semver = require('semver')
const https = require('https')

main().catch(err => {
  core.setFailed(err.message)
})

async function main() {
  checkPlatform()

  const otpSpec = core.getInput('otp-version', {required: true})
  const elixirSpec = core.getInput('elixir-version', {required: true})
  const otpVersion = getVersionFromSpec(otpSpec, await getOtpVersions())
  const [elixirVersion, otpMajor] = getElixirVersion(elixirSpec, await getElixirVersions(), otpVersion)

  let installHex = core.getInput('install-hex')
  installHex = installHex == null ? true : installHex
  let installRebar = core.getInput('install-rebar')
  installRebar = installRebar == null ? true : installRebar

  console.log(`##[group]Installing OTP ${otpVersion}`)
  await installOTP(otpVersion)
  console.log(`##[endgroup]`)

  console.log(`##[group]Installing Elixir ${elixirVersion}`)
  await installElixir(elixirVersion, otpMajor)
  console.log(`##[endgroup]`)

  process.env.PATH = `${process.cwd()}/.setup-elixir/elixir/bin:${process.env.PATH}`
  if (installRebar) await exec('mix local.rebar --force')
  if (installHex) await exec('mix local.hex --force')
}

function checkPlatform() {
  if (process.platform !== 'linux')
    throw new Error(
      '@actions/setup-elixir only supports Ubuntu Linux at this time'
    )
}

function getElixirVersion(spec, versions, otpVersion) {
  const version = getVersionFromSpec(spec, Array.from(versions.keys()))
  const [otpMajor] = otpVersion.match(/^\d+/)

  if (versions.get(version).includes(otpMajor)) {
    return [version, otpMajor]
  } else {
    throw new Error(
      `Elixir ${version} and OTP ${otpVersion} are incompatible`
    )
  }
}

function getVersionFromSpec(spec, versions) {
  const range = semver.validRange(spec)
  const version = semver.maxSatisfying(versions, range)
  return version || spec
}

async function getOtpVersions() {
  const result = await get("https://raw.githubusercontent.com/erlang/otp/master/otp_versions.table")

  return result.trim().split('\n').map(line => {
    const [_, version] = line.match(/^OTP-([\.\d]+)/)
    return version
  })
}

async function getElixirVersions() {
  const result = await get("https://repo.hex.pm/builds/elixir/builds.txt")
  const map = new Map()

  result.trim().split('\n').forEach(line => {
    const match = line.match(/^v(\d+\.\d+\.\d+)-otp-(\d+)/)

    if (match) {
      const [_, version, otp] = match
      const array = (map.get(version) || [])
      array.push(otp)
      map.set(version, array)
    }
  })

  return map
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url)

    req.on('response', res => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => { resolve(data) })
    })

    req.on('error', err => { reject(err) })
  })
}
