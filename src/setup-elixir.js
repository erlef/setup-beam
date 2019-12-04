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
  const otpVersion = await getOtpVersion(otpSpec)
  const [elixirVersion, otpMajor] = await getElixirVersion(
    elixirSpec,
    otpVersion
  )

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

  process.env.PATH = `/tmp/.setup-elixir/elixir/bin:${process.env.PATH}`

  if (installRebar) await exec('mix local.rebar --force')
  if (installHex) await exec('mix local.hex --force')

  const matchersPath = path.join(__dirname, '..', '.github')
  console.log(`##[add-matcher]${path.join(matchersPath, 'elixir.json')}`)
}

function checkPlatform() {
  if (process.platform !== 'linux')
    throw new Error(
      '@actions/setup-elixir only supports Ubuntu Linux at this time'
    )
}

async function getOtpVersion(spec) {
  return getVersionFromSpec(spec, await getOtpVersions()) || spec
}

async function getElixirVersion(spec, otpVersion) {
  const versions = await getElixirVersions()
  const semverRegex = /^v(\d+\.\d+\.\d+)/

  const semverVersions = Array.from(versions.keys())
    .filter(str => str.match(semverRegex))
    .map(str => str.match(semverRegex)[1])

  const version = getVersionFromSpec(spec, semverVersions)
  const gitRef = version ? `v${version}` : spec
  const [otpMajor] = otpVersion.match(/^\d+/)

  if (versions.get(gitRef).includes(otpMajor)) {
    return [gitRef, otpMajor]
  } else {
    return [gitRef, null]
  }
}

function getVersionFromSpec(spec, versions) {
  if (versions.includes(spec)) {
    return spec
  } else {
    const range = semver.validRange(spec)
    return semver.maxSatisfying(versions, range)
  }
}

async function getOtpVersions() {
  const result = await get(
    'https://raw.githubusercontent.com/erlang/otp/master/otp_versions.table'
  )

  return result
    .trim()
    .split('\n')
    .map(line => {
      const [_, version] = line.match(/^OTP-([\.\d]+)/)
      return version
    })
}

async function getElixirVersions() {
  const result = await get('https://repo.hex.pm/builds/elixir/builds.txt')
  const map = new Map()

  result
    .trim()
    .split('\n')
    .forEach(line => {
      const match =
        line.match(/^(v\d+\.\d+\.\d+)-otp-(\d+)/) ||
        line.match(/^([^-]+)-otp-(\d+)/)

      if (match) {
        const [_, version, otp] = match
        const array = map.get(version) || []
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
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', () => {
        resolve(data)
      })
    })

    req.on('error', err => {
      reject(err)
    })
  })
}
