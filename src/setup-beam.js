const core = require('@actions/core')
const { exec } = require('@actions/exec')
const path = require('path')
const semver = require('semver')
const https = require('https')
const installer = require('./installer')

main().catch((err) => {
  core.setFailed(err.message)
})

async function main() {
  installer.checkPlatform()

  const osVersion = getRunnerOSVersion()
  const otpSpec = core.getInput('otp-version', { required: true })
  const otpVersion = await installOTP(otpSpec, osVersion)

  const elixirSpec = core.getInput('elixir-version', { required: false })
  const elixirInstalled = await maybeInstallElixir(elixirSpec, otpVersion)
  if (elixirInstalled === true) {
    const shouldMixRebar = core.getInput('install-rebar', {
      required: false,
    })
    await mix(shouldMixRebar, 'rebar')
    const shouldMixHex = core.getInput('install-hex', {
      required: false,
    })
    await mix(shouldMixHex, 'hex')
  }

  const rebar3Spec = core.getInput('rebar3-version', { required: false })
  maybeInstallRebar3(rebar3Spec)
}

async function installOTP(otpSpec, osVersion) {
  const otpVersion = await getOTPVersion(otpSpec, osVersion)
  console.log(
    `##[group]Installing Erlang/OTP ${otpVersion} - built on ${osVersion}`,
  )
  await installer.installOTP(osVersion, otpVersion)
  core.setOutput('otp-version', otpVersion)
  prependToPath(`${process.env.RUNNER_TEMP}/.setup-beam/otp/bin`)
  console.log('##[endgroup]')

  return otpVersion
}

async function maybeInstallElixir(elixirSpec, otpVersion) {
  if (elixirSpec) {
    const elixirVersion = await getElixirVersion(elixirSpec, otpVersion)
    console.log(`##[group]Installing Elixir ${elixirVersion}`)
    await installer.installElixir(elixirVersion)
    core.setOutput('elixir-version', elixirVersion)
    const matchersPath = path.join(__dirname, '..', '.github')
    console.log(
      `##[add-matcher]${path.join(matchersPath, 'elixir-matchers.json')}`,
    )
    prependToPath(`${process.env.RUNNER_TEMP}/.setup-beam/elixir/bin`)
    console.log('##[endgroup]')

    return true
  }

  return false
}

async function mix(shouldMix, what) {
  if (shouldMix) {
    const cmd = 'mix'
    const args = [`local.${what}`, '--force']
    console.log(`##[group]Running ${cmd} ${args}`)
    await exec(cmd, args)
    console.log('##[endgroup]')
  }
}

async function maybeInstallRebar3(rebar3Spec) {
  if (rebar3Spec) {
    const rebar3Version = await getRebar3Version(rebar3Spec)
    console.log(`##[group]Installing rebar3 ${rebar3Version}`)
    await installer.installRebar3(rebar3Version)
    core.setOutput('rebar3-version', rebar3Version)
    prependToPath(`${process.env.RUNNER_TEMP}/.setup-beam/rebar3/bin`)
    console.log('##[endgroup]')

    return true
  }

  return false
}

async function getOTPVersion(otpSpec0, osVersion) {
  const otpVersions = await getOTPVersions(osVersion)
  const otpSpec = otpSpec0.match(/^(OTP-)?([^ ]+)/)
  let otpVersion
  if (otpSpec[1]) {
    throw new Error(
      `Requested Erlang/OTP version (from spec ${otpSpec0}) ` +
        "should not contain 'OTP-'",
    )
  }
  if (otpSpec) {
    otpVersion = getVersionFromSpec(
      otpSpec[2],
      Array.from(otpVersions.keys()).sort(),
    )
  }
  if (otpVersion === null) {
    throw new Error(
      `Requested Erlang/OTP version (from spec ${otpSpec0}) not found in build listing`,
    )
  }

  return otpVersions.get(otpVersion) // from the reference, for download
}

async function getElixirVersion(exSpec0, otpVersion) {
  const elixirVersions = await getElixirVersions()
  const semverVersions = Array.from(elixirVersions.keys()).sort()

  const exSpec = exSpec0.match(/^(.+)(-otp-.+)/) || exSpec0.match(/^(.+)/)
  let elixirVersion
  if (exSpec[2]) {
    throw new Error(
      `Requested Elixir / Erlang/OTP version (from spec ${exSpec0} / ${otpVersion}) ` +
        "should not contain '-otp-...'",
    )
  }
  if (exSpec) {
    elixirVersion = getVersionFromSpec(exSpec[1], semverVersions)
  }
  if (!exSpec || elixirVersion === null) {
    throw new Error(
      `Requested Elixir version (from spec ${exSpec0}) not found in build listing`,
    )
  }
  const otpMatch = otpVersion.match(/^(?:OTP-)?([^.]+)/)
  let elixirVersionWithOTP

  if (elixirVersions.get(elixirVersion)) {
    const otpVersionMajor = otpMatch[1]
    // We try for a version like `v1.4.5-otp-20`...
    if (elixirVersions.get(elixirVersion).includes(otpMatch[1])) {
      // ... and it's available: use it!
      elixirVersionWithOTP = `${elixirVersion}-otp-${otpVersionMajor}`
      core.info(
        `Using Elixir ${elixirVersion} (built for OTP ${otpVersionMajor})`,
      )
    } else {
      // ... and it's not available: fallback to the "generic" version (v1.4.5 only).
      elixirVersionWithOTP = elixirVersion
      core.info(`Using Elixir ${elixirVersion}`)
    }
  } else {
    throw new Error(
      `Requested Elixir / Erlang/OTP version (from spec ${exSpec0} / ${otpVersion}) not ` +
        'found in build listing',
    )
  }

  return elixirVersionWithOTP
}

async function getRebar3Version(r3Spec) {
  const rebar3Versions = await getRebar3Versions()
  const rebar3Version = getVersionFromSpec(r3Spec, rebar3Versions)
  if (rebar3Version === null) {
    throw new Error(
      `Requested rebar3 version (from spec ${r3Spec}) not found in build listing`,
    )
  }

  return rebar3Version
}

async function getOTPVersions(osVersion) {
  const otpVersionsListing = await get(
    `https://repo.hex.pm/builds/otp/${osVersion}/builds.txt`,
  )
  const otpVersions = new Map()

  otpVersionsListing
    .trim()
    .split('\n')
    .forEach((line) => {
      const otpMatch = line.match(/^(OTP-)?([^ ]+)/)

      let otpVersion = otpMatch[2]
      if (semver.validRange(otpVersion)) {
        otpVersion = semver.minVersion(otpVersion).version
      }
      otpVersions.set(otpVersion, otpMatch[0]) // we keep the original for later reference
    })

  return otpVersions
}

async function getElixirVersions() {
  const elixirVersionsListing = await get(
    'https://repo.hex.pm/builds/elixir/builds.txt',
  )
  const otpVersionsForElixirMap = new Map()

  elixirVersionsListing
    .trim()
    .split('\n')
    .forEach((line) => {
      const elixirMatch =
        line.match(/^(.+)-otp-([^ ]+)/) || line.match(/^([^ ]+)/)
      const elixirVersion = elixirMatch[1]
      const otpVersion = elixirMatch[2]
      const otpVersions = otpVersionsForElixirMap.get(elixirVersion) || []
      if (otpVersion) {
        // -otp- present (special case)
        otpVersions.push(otpVersion)
      }
      otpVersionsForElixirMap.set(elixirVersion, otpVersions)
    })

  return otpVersionsForElixirMap
}

async function getRebar3Versions() {
  const resultJSON = await get(
    'https://api.github.com/repos/erlang/rebar3/releases',
  )
  const rebar3VersionsListing = JSON.parse(resultJSON)
    .map((x) => x.tag_name)
    .sort()

  return rebar3VersionsListing
}

function getVersionFromSpec(spec, versions) {
  if (versions.includes(spec)) {
    return spec
  }

  return semver.maxSatisfying(versions, semver.validRange(spec))
}

function getRunnerOSVersion() {
  const mapToUbuntuVersion = {
    ubuntu16: 'ubuntu-16.04',
    ubuntu18: 'ubuntu-18.04',
    ubuntu20: 'ubuntu-20.04',
  }

  return mapToUbuntuVersion[process.env.ImageOS] || 'ubuntu-18.04'
}

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: { 'user-agent': 'setup-beam' },
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () => {
            resolve(data)
          })
        },
      )
      .on('error', (err) => {
        reject(err)
      })
  })
}

function prependToPath(what) {
  process.env.PATH = `${what}:${process.env.PATH}`
}

module.exports = {
  getOTPVersion,
  getElixirVersion,
  getRebar3Version,
}
