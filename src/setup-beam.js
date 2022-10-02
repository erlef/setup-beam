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
  const elixirSpec = core.getInput('elixir-version', { required: false })
  const gleamSpec = core.getInput('gleam-version', { required: false })
  const rebar3Spec = core.getInput('rebar3-version', { required: false })

  if (otpSpec !== 'false') {
    const otpVersion = await installOTP(otpSpec, osVersion)
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
  } else if (!gleamSpec) {
    throw new Error('otp-version=false is only available when installing Gleam')
  }

  await maybeInstallGleam(gleamSpec)
  await maybeInstallRebar3(rebar3Spec)
}

async function installOTP(otpSpec, osVersion) {
  const otpVersion = await getOTPVersion(otpSpec, osVersion)
  console.log(
    `##[group]Installing Erlang/OTP ${otpVersion} - built on ${osVersion}`,
  )
  await installer.installOTP(osVersion, otpVersion)
  core.setOutput('otp-version', otpVersion)
  core.addPath(`${process.env.RUNNER_TEMP}/.setup-beam/otp/bin`)
  console.log('##[endgroup]')

  return otpVersion
}

async function maybeInstallElixir(elixirSpec, otpVersion) {
  let installed = false

  if (elixirSpec) {
    const elixirVersion = await getElixirVersion(elixirSpec, otpVersion)
    console.log(`##[group]Installing Elixir ${elixirVersion}`)
    await installer.installElixir(elixirVersion)
    core.setOutput('elixir-version', elixirVersion)
    const disableProblemMatchers = core.getInput('disable_problem_matchers', {
      required: false,
    })
    if (disableProblemMatchers === 'false') {
      const matchersPath = path.join(__dirname, '..', '.github')
      console.log(
        `##[add-matcher]${path.join(matchersPath, 'elixir-matchers.json')}`,
      )
    }
    core.addPath(`${process.env.RUNNER_TEMP}/.setup-beam/elixir/bin`)
    console.log('##[endgroup]')

    installed = true
  }

  return installed
}

async function mix(shouldMix, what) {
  if (shouldMix === 'true') {
    const cmd = 'mix'
    const args = [`local.${what}`, '--force']
    console.log(`##[group]Running ${cmd} ${args}`)
    await exec(cmd, args)
    console.log('##[endgroup]')
  }
}

async function maybeInstallGleam(gleamSpec) {
  let installed = false

  if (gleamSpec) {
    const gleamVersion = await getGleamVersion(gleamSpec)
    console.log(`##[group]Installing Gleam ${gleamVersion}`)
    await installer.installGleam(gleamVersion)
    core.setOutput('gleam-version', gleamVersion)
    core.addPath(`${process.env.RUNNER_TEMP}/.setup-beam/gleam/bin`)
    console.log('##[endgroup]')

    installed = true
  }

  return installed
}

async function maybeInstallRebar3(rebar3Spec) {
  let installed = false
  let rebar3Version

  if (rebar3Spec) {
    if (rebar3Spec === 'nightly') {
      rebar3Version = 'nightly'
    } else {
      rebar3Version = await getRebar3Version(rebar3Spec)
    }
    console.log(`##[group]Installing rebar3 ${rebar3Version}`)
    await installer.installRebar3(rebar3Version)
    core.setOutput('rebar3-version', rebar3Version)
    core.addPath(`${process.env.RUNNER_TEMP}/.setup-beam/rebar3/bin`)
    console.log('##[endgroup]')

    installed = true
  }

  return installed
}

async function getOTPVersion(otpSpec0, osVersion) {
  const otpVersions = await getOTPVersions(osVersion)
  const otpSpec = otpSpec0.match(/^(OTP-|maint-)?([^ ]+)/)
  let otpSpecPref = ''
  let otpSpecSuf
  let otpVersion
  if (otpSpec0 === 'latest') {
    otpSpecSuf = 'master'
  } else if (otpSpec[1]) {
    if (!isStrictVersion()) {
      throw new Error(
        `Requested Erlang/OTP version (${otpSpec0}) ` +
          "should not contain 'OTP-, or maint-'",
      )
    } else if (otpSpec[1] !== 'OTP-' && otpSpec[0] !== 'latest') {
      // We try to help by using OTP- as prefix,
      // but not for "maint" (as these should be less common)
      otpSpecPref = 'OTP-'
    } else {
      otpSpecPref = ''
    }

    /* eslint-disable no-extra-semi */
    ;[, , otpSpecSuf] = otpSpec
    /* eslint-enable no-extra-semi */
  }
  if (otpSpec) {
    otpVersion = getVersionFromSpec(
      otpSpecPref + otpSpecSuf,
      Array.from(otpVersions.keys()).sort(),
    )
  }
  if (otpVersion === null) {
    throw new Error(
      `Requested Erlang/OTP version (${otpSpec0}) not found in version list ` +
        "(should you be using option 'version-type': 'strict'?)",
    )
  }

  return otpVersions.get(otpVersion) // from the reference, for download
}

async function getElixirVersion(exSpec0, otpVersion) {
  const elixirVersions = await getElixirVersions()
  const semverVersions = Array.from(elixirVersions.keys()).sort()

  const exSpec = exSpec0.match(/^v?(.+)(-otp-.+)/) || exSpec0.match(/^v?(.+)/)
  let elixirVersion
  if (exSpec[2] && !isStrictVersion()) {
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
      `Requested Elixir version (${exSpec0}) not found in version list ` +
        "(should you be using option 'version-type': 'strict'?)",
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
    } else if (isStrictVersion() && otpVersion === 'latest') {
      elixirVersionWithOTP = `${elixirVersion}`
      core.info(`Using Elixir ${elixirVersion} (with OTP 'master' - strict)`)
    } else {
      // ... and it's not available: exit with exception
      throw new Error(
        `Requested Elixir / Erlang/OTP version (${exSpec0} / ${otpVersion}) not ` +
          'found in version list (did you check Compatibility between Elixir and Erlang/OTP?)',
      )
    }
  } else {
    throw new Error(
      `Requested Elixir / Erlang/OTP version (${exSpec0} / ${otpVersion}) not ` +
        "found in version list (should you be using option 'version-type': 'strict'?)",
    )
  }

  return maybePrependWithV(elixirVersionWithOTP, elixirVersion)
}

async function getGleamVersion(gleamSpec0) {
  const gleamSpec = gleamSpec0.match(/^v?(.+)/)
  const gleamVersions = await getGleamVersions()
  const gleamVersion = getVersionFromSpec(gleamSpec[1], gleamVersions)
  if (gleamVersion === null) {
    throw new Error(
      `Requested Gleam version (${gleamSpec0}) not found in version list ` +
        "(should you be using option 'version-type': 'strict'?)",
    )
  }

  return maybePrependWithV(gleamVersion, gleamVersion)
}

async function getRebar3Version(r3Spec) {
  const rebar3Versions = await getRebar3Versions()
  const rebar3Version = getVersionFromSpec(r3Spec, rebar3Versions)
  if (rebar3Version === null) {
    throw new Error(
      `Requested rebar3 version (${r3Spec}) not found in version list ` +
        "(should you be using option 'version-type': 'strict'?)",
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
        const otpMatch = line.match(/^(OTP-|maint-)?([^ ]+)/)
        const otpVersion = otpMatch[2]
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
          const otpVersion = otpMatch[1]
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
        line.match(/^v?(.+)-otp-([^ ]+)/) || line.match(/^v?([^ ]+)/)
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

async function getGleamVersions() {
  const resultJSONs = await get(
    'https://api.github.com/repos/gleam-lang/gleam/releases?per_page=100',
    [1, 2, 3],
  )
  const gleamVersionsListing = []
  resultJSONs.forEach((resultJSON) => {
    JSON.parse(resultJSON)
      .map((x) => x.tag_name)
      .sort()
      .forEach((v) => gleamVersionsListing.push(v))
  })
  return gleamVersionsListing
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

function isStrictVersion() {
  return core.getInput('version-type', { required: false }) === 'strict'
}

function getVersionFromSpec(spec, versions) {
  let version = null

  if (spec.match(/rc/) || isStrictVersion()) {
    version = spec
  }

  if (version === null) {
    // We keep a map of semver => "spec" in order to use semver ranges to find appropriate versions
    const versionsMap = versions.sort(sortVersions).reduce((acc, v) => {
      if (!v.match(/rc/)) {
        // release candidates are opt-in
        acc[maybeCoerced(v)] = v
      }
      return acc
    }, {})
    const rangeForMax = semver.validRange(spec)
    if (rangeForMax) {
      version =
        versionsMap[semver.maxSatisfying(Object.keys(versionsMap), rangeForMax)]
    } else {
      version = versionsMap[maybeCoerced(spec)]
    }
  }

  return version === null || version === undefined ? null : version
}

function maybeCoerced(v) {
  let ret

  try {
    ret = semver.coerce(v).version
  } catch {
    // some stuff can't be coerced, like 'master'
    ret = v
  }

  return ret
}

function sortVersions(left, right) {
  let ret = 0
  const newL = verAsComparableStr(left)
  const newR = verAsComparableStr(right)

  function verAsComparableStr(ver) {
    const matchGroups = 5
    const verSpec = /([^.]+)?\.?([^.]+)?\.?([^.]+)?\.?([^.]+)?\.?([^.]+)?/
    const matches = ver.match(verSpec).splice(1, matchGroups)
    return matches.reduce((acc, v) => acc + (v || '0').padStart(3, '0'), '')
  }

  if (newL < newR) {
    ret = -1
  } else if (newL > newR) {
    ret = 1
  }

  return ret
}

function getRunnerOSVersion() {
  const ImageOSToContainer = {
    ubuntu18: 'ubuntu-18.04',
    ubuntu20: 'ubuntu-20.04',
    ubuntu22: 'ubuntu-22.04',
    win19: 'windows-2019',
    win22: 'windows-2022',
  }
  const containerFromEnvImageOS = ImageOSToContainer[process.env.ImageOS]

  if (!containerFromEnvImageOS) {
    throw new Error(
      "Tried to map a target OS from env. variable 'ImageOS' (got " +
        `${process.env.ImageOS}` +
        "), but failed. If you're using a " +
        "self-hosted runner, you should set 'env': 'ImageOS': ... to one of the following: " +
        "['" +
        `${Object.keys(ImageOSToContainer).join("', '")}` +
        "']",
    )
  }

  return containerFromEnvImageOS
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

function maybePrependWithV(versionToPrepend, specVersion) {
  const digitStart = /^\d+/
  let v = versionToPrepend
  if (digitStart.test(specVersion)) {
    v = `v${versionToPrepend}`
  }
  return v
}

module.exports = {
  getOTPVersion,
  getElixirVersion,
  getGleamVersion,
  getRebar3Version,
  getVersionFromSpec,
}
