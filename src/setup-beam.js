const core = require('@actions/core')
const {exec} = require('@actions/exec')
const {installElixir, installOTP} = require('./installer')
const path = require('path')
const semver = require('semver')
const https = require('https')
const {
  fstat,
  promises: {readFile},
} = require('fs')

main().catch(err => {
  core.setFailed(err.message)
})

async function main() {
  checkPlatform()

  const osVersion = getRunnerOSVersion()
  const otpSpec = core.getInput('otp-version', {required: true})
  const elixirSpec = core.getInput('elixir-version', {required: true})
  const otpVersion = await getOtpVersion(otpSpec, osVersion)
  const [elixirVersion, otpMajor] = await getElixirVersion(
    elixirSpec,
    otpVersion
  )

  let installHex = core.getInput('install-hex')
  installHex = installHex == null ? 'true' : installHex

  let installRebar = core.getInput('install-rebar')
  installRebar = installRebar == null ? 'true' : installRebar

  console.log(`##[group]Installing OTP ${otpVersion} - built on ${osVersion}`)
  await installOTP(otpVersion, osVersion)
  console.log(`##[endgroup]`)

  console.log(`##[group]Installing Elixir ${elixirVersion}`)
  await installElixir(elixirVersion, otpMajor)
  console.log(`##[endgroup]`)

  process.env.PATH = `${process.env.RUNNER_TEMP}/.setup-beam/elixir/bin:${process.env.RUNNER_TEMP}/.setup-beam/otp/bin:${process.env.PATH}`

  if (installRebar === 'true') await exec('mix local.rebar --force')
  if (installHex === 'true') await exec('mix local.hex --force')

  const matchersPath = path.join(__dirname, '..', '.github')
  console.log(`##[add-matcher]${path.join(matchersPath, 'elixir.json')}`)
  core.setOutput('otp-version', otpVersion)
  core.setOutput('elixir-version', elixirVersion)
  core.setOutput('osVersion', osVersion)
}

function checkPlatform() {
  if (process.platform !== 'linux')
    throw new Error('@erlef/setup-beam only supports Ubuntu Linux at this time')
}

async function getOtpVersion(spec, osVersion) {
  const version = getVersionFromSpec(spec, await getOtpVersions(osVersion))
  return version ? `OTP-${version}` : spec
}

function getRunnerOSVersion() {
  const mapToUbuntuVersion = {
    ubuntu16: 'ubuntu-16.04',
    ubuntu18: 'ubuntu-18.04',
    ubuntu20: 'ubuntu-20.04',
  }

  return mapToUbuntuVersion[process.env.ImageOS] || 'ubuntu-18.04'
}

exports.getElixirVersion = getElixirVersion

async function getElixirVersion(spec, otpVersion) {
  const versions = await getElixirVersions()
  const semverRegex = /^v(\d+\.\d+\.\d+(?:-.+)?)/

  const semverVersions = Array.from(versions.keys())
    .filter(str => str.match(semverRegex))
    .map(str => str.match(semverRegex)[1])

  const version = getVersionFromSpec(spec, semverVersions)
  const gitRef = version ? `v${version}` : spec
  const otpMatch = otpVersion.match(/^OTP-([\.\d]+)/)

  if (otpMatch != null && versions.get(gitRef).includes(otpMatch[0])) {
    return [gitRef, otpMatch[0]]
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

async function getOtpVersions(osVersion) {
  const result = await get(
    `https://repo.hex.pm/builds/otp/${osVersion}/builds.txt`
  )

  return result
    .trim()
    .split('\n')
    .map(line => {
      const match = line.match(/^OTP-([\.\d]+)/)

      if (match) {
        const [_, version] = match
        return version
      } else {
        return line
      }
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
        line.match(/^(v\d+\.\d+\.\d+(?:-.+)?)-otp-(\d+)/) ||
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
  if (process.env.NODE_ENV === 'test') {
    return readFile(
      path.join(__dirname, '..', '__tests__', 'builds.txt')
    ).then(buf => buf.toString())
  }

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
