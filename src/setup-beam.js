const core = require('@actions/core')
const { exec } = require('@actions/exec')
const path = require('path')
const semver = require('semver')
const https = require('https')
const fs = require('fs')
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
  await maybeInstallRebar3(rebar3Spec)
}

async function installOTP(otpSpec, osVersion) {
  const otpVersion = await getOTPVersion(otpSpec, osVersion)
  console.log(
    `##[group]Installing Erlang/OTP ${otpVersion} - built on ${osVersion}`,
  )
  await installer.installOTP(osVersion, otpVersion)
  core.setOutput('otp-version', otpVersion)
  if (process.platform === 'linux') {
    core.addPath(`${process.env.RUNNER_TEMP}/.setup-beam/otp/bin`)
  } else if (process.platform === 'win32') {
    const otpPath = fs.readFileSync(`${process.env.RUNNER_TEMP}/otp_path.txt`, {
      encoding: 'utf8',
      flag: 'r',
    })
    core.addPath(otpPath)
  }
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
    core.addPath(`${process.env.RUNNER_TEMP}/.setup-beam/elixir/bin`)
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
    core.addPath(`${process.env.RUNNER_TEMP}/.setup-beam/rebar3/bin`)
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
      `Requested Erlang/OTP version (${otpSpec0}) ` +
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
      `Requested Erlang/OTP version (${otpSpec0}) not found in version list`,
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
      `Requested Elixir / Erlang/OTP version (${exSpec0} / ${otpVersion}) ` +
        "should not contain '-otp-...'",
    )
  }
  if (exSpec) {
    elixirVersion = getVersionFromSpec(exSpec[1], semverVersions)
  }
  if (!exSpec || elixirVersion === null) {
    throw new Error(
      `Requested Elixir version (${exSpec0}) not found in version list`,
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
      // ... and it's not available: fallback to the 'generic' version (v1.4.5 only).
      elixirVersionWithOTP = elixirVersion
      core.info(`Using Elixir ${elixirVersion}`)
    }
  } else {
    throw new Error(
      `Requested Elixir / Erlang/OTP version (${exSpec0} / ${otpVersion}) not ` +
        'found in version list',
    )
  }

  return elixirVersionWithOTP
}

async function getRebar3Version(r3Spec) {
  const rebar3Versions = await getRebar3Versions()
  const rebar3Version = getVersionFromSpec(r3Spec, rebar3Versions)
  if (rebar3Version === null) {
    throw new Error(
      `Requested rebar3 version (${r3Spec}) not found in version list`,
    )
  }

  return rebar3Version
}

async function getOTPVersions(osVersion) {
  let originListing
  let pageIdxs
  if (process.platform === 'linux') {
    originListing = `https://repo.hex.pm/builds/otp/${osVersion}/builds.txt`
    pageIdxs = [null]
  } else if (process.platform === 'win32') {
    originListing =
      'https://api.github.com/repos/erlang/otp/releases?per_page=100'
    pageIdxs = [1, 2, 3]
  }

  const otpVersionsListings = await get(originListing, pageIdxs)
  const otpVersions = new Map()

  if (process.platform === 'linux') {
    otpVersionsListings
      .trim()
      .split('\n')
      .forEach((line) => {
        const otpMatch = line.match(/^(OTP-)?([^ ]+)/)

        let otpVersion = otpMatch[2]
        if (semver.validRange(otpVersion) && hasPatch(otpVersion)) {
          otpVersion = semver.minVersion(otpVersion).version
        }
        otpVersions.set(otpVersion, otpMatch[0]) // we keep the original for later reference
      })
  } else if (process.platform === 'win32') {
    otpVersionsListings.forEach((otpVersionsListing) => {
      JSON.parse(otpVersionsListing)
        .map((x) => x.assets)
        .flat()
        .filter((x) => x.name.match(/^otp_win64_.*.exe$/))
        .forEach((x) => {
          const otpMatch = x.name.match(/^otp_win64_(.*).exe$/)
          let otpVersion = otpMatch[1]
          if (semver.validRange(otpVersion) && hasPatch(otpVersion)) {
            otpVersion = semver.minVersion(otpVersion).version
          }
          otpVersions.set(otpVersion, otpVersion)
        })
    })
  }

  return otpVersions
}

async function getElixirVersions() {
  const elixirVersionsListings = await get(
    'https://repo.hex.pm/builds/elixir/builds.txt',
    [null],
  )
  const otpVersionsForElixirMap = new Map()

  elixirVersionsListings
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
  const resultJSONs = await get(
    'https://api.github.com/repos/erlang/rebar3/releases?per_page=100',
    [1, 2, 3],
  )
  const rebar3VersionsListing = []
  resultJSONs.forEach((resultJSON) => {
    JSON.parse(resultJSON)
      .map((x) => x.tag_name)
      .sort()
      .forEach((v) => rebar3VersionsListing.push(v))
  })
  return rebar3VersionsListing
}

function getVersionFromSpec(spec, versions) {
  if (versions.includes(spec)) {
    return spec
  }

  return semver.maxSatisfying(versions, semver.validRange(spec))
}

function getRunnerOSVersion() {
  const ImageOSToContainer = {
    ubuntu16: 'ubuntu-16.04',
    ubuntu18: 'ubuntu-18.04',
    ubuntu20: 'ubuntu-20.04',
    win16: 'windows-2016',
    win19: 'windows-2019',
  }

  return ImageOSToContainer[process.env.ImageOS]
}

async function get(url0, pageIdxs) {
  function getPage(pageIdx) {
    return new Promise((resolve, reject) => {
      const url = new URL(url0)
      if (pageIdx !== null) {
        url.searchParams.append('page', pageIdx)
      }
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
              if (res.statusCode >= 400 && res.statusCode <= 599) {
                reject(
                  new Error(
                    `Got ${res.statusCode} from ${url}. Exiting with error`,
                  ),
                )
              } else {
                resolve(data)
              }
            })
          },
        )
        .on('error', (err) => {
          reject(err)
        })
    })
  }
  let ret
  if (pageIdxs[0] === null) {
    ret = getPage(null)
  } else {
    ret = Promise.all(pageIdxs.map((pageIdx) => getPage(pageIdx)))
  }
  return ret
}

function hasPatch(v) {
  try {
    semver.patch(v)
  } catch {
    return false
  }

  return true
}
module.exports = {
  getOTPVersion,
  getElixirVersion,
  getRebar3Version,
}
