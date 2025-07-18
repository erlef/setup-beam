const core = require('@actions/core')
const { exec } = require('@actions/exec')
const tc = require('@actions/tool-cache')
const path = require('path')
const semver = require('semver')
const fs = require('fs')
const os = require('os')
const csv = require('csv-parse/sync')
const _ = require('lodash')

const MAX_HTTP_RETRIES = 3

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    core.setFailed(err.message)
  })
}

async function main() {
  checkOtpArchitecture()

  const versionFilePath = getInput('version-file', false)
  let versions
  if (versionFilePath) {
    if (!isStrictVersion()) {
      throw new Error(
        "you have to set version-type=strict if you're using version-file",
      )
    }
    versions = parseVersionFile(versionFilePath)
  }

  const otpSpec = getInput('otp-version', true, 'erlang', versions)
  const elixirSpec = getInput('elixir-version', false, 'elixir', versions)
  const gleamSpec = getInput('gleam-version', false, 'gleam', versions)
  const rebar3Spec = getInput('rebar3-version', false, 'rebar', versions)

  if (otpSpec !== 'false') {
    await installOTP(otpSpec)
    const elixirInstalled = await maybeInstallElixir(elixirSpec)
    if (elixirInstalled === true) {
      const shouldMixRebar = getInput('install-rebar', false)
      await mix(shouldMixRebar, 'rebar')

      const shouldMixHex = getInput('install-hex', false)
      await mix(shouldMixHex, 'hex')
    }
  } else if (!gleamSpec) {
    throw new Error('otp-version=false is only available when installing Gleam')
  }

  await maybeInstallGleam(gleamSpec)
  await maybeInstallRebar3(rebar3Spec)

  // undefined is replaced by a function, post- main branch merge
  const setupBeamVersion = '8c38699'
  core.setOutput('setup-beam-version', setupBeamVersion)
}

async function installOTP(otpSpec) {
  const osVersion = getRunnerOSVersion()
  const otpVersion = await getOTPVersion(otpSpec, osVersion)
  core.startGroup(
    `Installing Erlang/OTP ${otpVersion} - built on ${getRunnerOSArchitecture()}/${osVersion}`,
  )
  await doWithMirrors({
    hexMirrors: hexMirrorsInput(),
    actionTitle: `install Erlang/OTP ${otpVersion}`,
    action: async (hexMirror) => {
      await install('otp', {
        osVersion,
        toolVersion: otpVersion,
        hexMirror,
      })
    },
  })
  core.setOutput('otp-version', otpVersion)
  core.endGroup()

  return otpVersion
}

async function maybeInstallElixir(elixirSpec) {
  let installed = false
  if (elixirSpec) {
    const elixirVersion = await getElixirVersion(elixirSpec)
    core.startGroup(`Installing Elixir ${elixirVersion}`)
    await doWithMirrors({
      hexMirrors: hexMirrorsInput(),
      actionTitle: `install Elixir ${elixirVersion}`,
      action: async (hexMirror) => {
        await install('elixir', {
          toolVersion: elixirVersion,
          hexMirror,
        })
      },
    })
    core.setOutput('elixir-version', elixirVersion)
    maybeEnableElixirProblemMatchers()
    core.endGroup()

    installed = true
  }

  return installed
}

function maybeEnableElixirProblemMatchers() {
  const disableProblemMatchers = getInput('disable_problem_matchers', false)
  if (disableProblemMatchers === 'false') {
    const elixirMatchers = path.join(
      __dirname,
      '..',
      'matchers',
      'elixir-matchers.json',
    )
    core.info(`##[add-matcher]${elixirMatchers}`)
  }
}

async function mix(shouldMix, what) {
  if (shouldMix === 'true') {
    const cmd = 'mix'
    const args = [`local.${what}`, '--force']
    core.startGroup(`Running ${cmd} ${args}`)
    await doWithMirrors({
      hexMirrors: hexMirrorsInput(),
      actionTitle: `mix ${what}`,
      action: async (hexMirror) => {
        process.env.HEX_MIRROR = hexMirror
        await exec(cmd, args)
      },
    })
    core.endGroup()
  }
}

async function maybeInstallGleam(gleamSpec) {
  let installed = false
  if (gleamSpec) {
    const gleamVersion = await getGleamVersion(gleamSpec)
    core.startGroup(`Installing Gleam ${gleamVersion}`)
    await install('gleam', { toolVersion: gleamVersion })
    core.setOutput('gleam-version', gleamVersion)
    core.endGroup()

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
    core.startGroup(`Installing rebar3 ${rebar3Version}`)
    await install('rebar3', { toolVersion: rebar3Version })
    core.setOutput('rebar3-version', rebar3Version)
    core.endGroup()

    installed = true
  }

  return installed
}

function maybeRemoveOTPPrefix(otpSpec) {
  return otpSpec.replace(/^OTP-/, '')
}

async function getOTPVersion(otpSpec0, osVersion) {
  const [otpVersions, originListing, hexMirrors] =
    await getOTPVersions(osVersion)
  let spec = maybeRemoveOTPPrefix(otpSpec0)
  const versions = otpVersions
  const otpVersion = getVersionFromSpec(spec, versions)

  if (otpVersion === null) {
    throw new Error(
      requestedVersionFor('Erlang/OTP', otpSpec0, originListing, hexMirrors),
    )
  }

  return otpVersion // from the reference, for download
}

function requestedVersionFor(tool, version, originListing, mirrors) {
  return (
    `Requested ${tool} version (${version}) not found in version list, ` +
    `at ${originListing}${mirrors ? `, with mirrors ${mirrors}` : ''}; ` +
    "should you be using option 'version-type': 'strict'?"
  )
}

const knownBranches = ['main', 'master', 'maint']
const nonSpecificVersions = ['nightly', 'latest']

async function getElixirVersion(exSpec0) {
  const otpSuffix = /-otp-(\d+)/
  const userSuppliedOtp = exSpec0.match(otpSuffix)?.[1] ?? null
  let otpVersionMajor = ''

  if (userSuppliedOtp && isVersion(userSuppliedOtp)) {
    otpVersionMajor = userSuppliedOtp
  } else {
    let cmd = 'erl'
    if (process.platform === 'win32') {
      cmd = 'erl.exe'
    }
    const args = [
      '-noshell',
      '-eval',
      'io:format(erlang:system_info(otp_release)), halt().',
    ]
    await exec(cmd, args, {
      listeners: {
        stdout: (data) => {
          otpVersionMajor = data.toString()
        },
      },
    })
  }

  const [otpVersionsForElixirMap, elixirVersions, originListing, hexMirrors] =
    await getElixirVersions()
  const spec = exSpec0.replace(otpSuffix, '')
  const versions = elixirVersions
  const elixirVersionFromSpec = getVersionFromSpec(spec, versions)

  if (elixirVersionFromSpec === null) {
    throw new Error(
      requestedVersionFor('Elixir', exSpec0, originListing, hexMirrors),
    )
  }

  let foundCombo = false
  let otpVersionMajorIter = parseInt(otpVersionMajor)
  let otpVersionsMajor = []
  while (otpVersionMajorIter > otpVersionMajor - 3) {
    otpVersionMajorIter += ''
    otpVersionsMajor.push(otpVersionMajorIter)
    const elixirVersionComp = otpVersionsForElixirMap[elixirVersionFromSpec]
    if (
      (elixirVersionComp && elixirVersionComp.includes(otpVersionMajorIter)) ||
      !isVersion(otpVersionMajorIter)
    ) {
      core.info(
        `Using Elixir ${elixirVersionFromSpec} (built for Erlang/OTP ${otpVersionMajorIter})`,
      )
      foundCombo = true
      break
    }
    otpVersionMajorIter = parseInt(otpVersionMajorIter) - 1
  }

  if (!foundCombo) {
    throw new Error(
      `Requested Elixir / Erlang/OTP version (${exSpec0} / tried ${otpVersionsMajor}) not ` +
        'found in version list (did you check Compatibility between Elixir and Erlang/OTP?).' +
        'Elixir and Erlang/OTP compatibility can be found at: ' +
        'https://hexdocs.pm/elixir/compatibility-and-deprecations.html',
    )
  }

  let elixirVersionForDownload = elixirVersionFromSpec

  if (isVersion(otpVersionMajorIter)) {
    elixirVersionForDownload = `${elixirVersionFromSpec}-otp-${otpVersionMajorIter}`
  }

  return maybePrependWithV(elixirVersionForDownload)
}

async function getGleamVersion(gleamSpec0) {
  const [gleamVersions, originListing] = await getGleamVersions()
  const spec = gleamSpec0
  const versions = gleamVersions
  const gleamVersion = getVersionFromSpec(spec, versions)

  if (gleamVersion === null) {
    throw new Error(requestedVersionFor('Gleam', gleamSpec0, originListing))
  }

  return maybePrependWithV(gleamVersion)
}

async function getRebar3Version(r3Spec) {
  const [rebar3Versions, originListing] = await getRebar3Versions()
  const spec = r3Spec
  const versions = rebar3Versions
  const rebar3Version = getVersionFromSpec(spec, versions)

  if (rebar3Version === null) {
    throw new Error(requestedVersionFor('rebar3', r3Spec, originListing))
  }

  return rebar3Version
}

function otpArchitecture() {
  return getInput('otp-architecture', false)
}

async function getOTPVersions(osVersion) {
  let otpVersionsListings
  let originListing
  let hexMirrors = null
  if (process.platform === 'linux') {
    originListing = `/builds/otp/${getRunnerOSArchitecture()}/${osVersion}/builds.txt`
    hexMirrors = hexMirrorsInput()
    otpVersionsListings = await doWithMirrors({
      hexMirrors,
      actionTitle: `fetch ${originListing}`,
      action: async (hexMirror) => {
        return get(`${hexMirror}${originListing}`)
      },
    })
  } else if (process.platform === 'win32') {
    originListing =
      'https://api.github.com/repos/erlang/otp/releases?per_page=100'
    otpVersionsListings = await get(originListing, [1, 2, 3])
  } else if (process.platform === 'darwin') {
    const arch = getRunnerOSArchitecture()
    let targetArch
    switch (arch) {
      case 'amd64':
        targetArch = 'x86_64'
        break
      case 'arm64':
        targetArch = 'aarch64'
        break
    }
    originListing =
      `https://raw.githubusercontent.com/erlef/otp_builds/refs/heads/main` +
      `/builds/${targetArch}-apple-darwin.csv`
    otpVersionsListings = await get(originListing)
  }

  debugLog(
    `OTP versions listings from ${originListing}, mirrors ${hexMirrors}`,
    otpVersionsListings,
  )

  const otpVersions = {}
  if (process.platform === 'linux') {
    otpVersionsListings
      .trim()
      .split('\n')
      .forEach((line) => {
        const otpVersionOrig = line.match(/^([^ ]+)?( .+)/)[1]
        const otpVersion = maybeRemoveOTPPrefix(otpVersionOrig)
        debugLog('OTP line and parsing', [line, otpVersion, otpVersionOrig])
        otpVersions[otpVersion] = otpVersionOrig // we keep the original for later reference
      })
  } else if (process.platform === 'win32') {
    const otpArch = otpArchitecture()
    const file_regex = new RegExp(
      `^otp_win${_.escapeRegExp(otpArch)}_(.*).exe$`,
    )
    otpVersionsListings.forEach((otpVersionsListing) => {
      otpVersionsListing
        .map((x) => x.assets)
        .flat()
        .filter((x) => x.name.match(file_regex))
        .forEach((x) => {
          const otpVersionOrig = x.name.match(file_regex)[1]
          const otpVersion = otpVersionOrig
          debugLog('OTP line and parsing', [x.name, otpVersion, otpVersionOrig])
          otpVersions[otpVersion] = otpVersionOrig
        })
    })
  } else if (process.platform === 'darwin') {
    csv
      .parse(otpVersionsListings, {
        columns: true,
      })
      .forEach((line) => {
        const otpVersionOrig = line.ref_name
        const otpVersion = maybeRemoveOTPPrefix(otpVersionOrig)
        debugLog('OTP line and parsing', [line, otpVersion, otpVersionOrig])
        otpVersions[otpVersion] = otpVersionOrig // we keep the original for later reference
      })
  }

  debugLog(
    `OTP versions from ${originListing}, mirrors ${hexMirrors}`,
    JSON.stringify(otpVersions),
  )

  return [otpVersions, originListing, hexMirrors]
}

async function getElixirVersions() {
  const originListing = '/builds/elixir/builds.txt'
  const hexMirrors = hexMirrorsInput()
  const elixirVersionsListings = await doWithMirrors({
    hexMirrors,
    actionTitle: `fetch ${originListing}`,
    action: async (hexMirror) => {
      return get(`${hexMirror}${originListing}`)
    },
  })
  const otpVersionsForElixirMap = {}
  const elixirVersions = {}

  elixirVersionsListings
    .trim()
    .split('\n')
    .forEach((line) => {
      const elixirMatch =
        line.match(/^v?(.+)-otp-([^ ]+)/) || line.match(/^v?([^ ]+)/)
      const elixirVersion = elixirMatch[1]
      const otpVersion = elixirMatch[2]
      const otpVersions = otpVersionsForElixirMap[elixirVersion] || []
      if (otpVersion) {
        // -otp- present (special case)
        otpVersions.push(otpVersion)
      }
      otpVersionsForElixirMap[elixirVersion] = otpVersions
      elixirVersions[elixirVersion] = elixirVersion
    })

  return [otpVersionsForElixirMap, elixirVersions, originListing, hexMirrors]
}

async function getGleamVersions() {
  const originListing =
    'https://api.github.com/repos/gleam-lang/gleam/releases?per_page=100'
  const resultJSONs = await get(originListing, [1, 2, 3])
  const gleamVersionsListing = {}
  resultJSONs.forEach((resultJSON) => {
    resultJSON
      .map((x) => x.tag_name)
      .forEach((ver) => {
        const gleamMatch = ver.match(/^v?([^ ]+)/)
        const gleamVersion = gleamMatch[1]
        gleamVersionsListing[gleamVersion] = gleamVersion
      })
  })

  return [gleamVersionsListing, originListing]
}

async function getRebar3Versions() {
  const originListing =
    'https://api.github.com/repos/erlang/rebar3/releases?per_page=100'
  const resultJSONs = await get(originListing, [1, 2, 3])
  const rebar3VersionsListing = {}
  resultJSONs.forEach((resultJSON) => {
    resultJSON
      .map((x) => x.tag_name)
      .forEach((ver) => {
        rebar3VersionsListing[ver] = ver
      })
  })

  return [rebar3VersionsListing, originListing]
}

function isStrictVersion() {
  return getInput('version-type', false) === 'strict'
}

function gt(left, right) {
  return semver.gt(parseVersion(left), parseVersion(right))
}

function validVersion(v) {
  return (
    v.match(
      new RegExp(`${knownBranches.join('|')}|${nonSpecificVersions.join('|')}`),
    ) == null &&
    // these ones are for rebar3, which has alpha and beta releases
    !v.startsWith('a') &&
    !v.startsWith('b')
  )
}

function parseVersion(v) {
  v = v.includes('rc') ? v : v.split('.')
  if (v instanceof Array) {
    v = `${[v.shift(), v.shift(), v.shift()].join('.')}+${v.join('.')}`
  }
  return semver.coerce(v, { includePrerelease: true, loose: true })
}

function getVersionFromSpec(spec0, versions0) {
  let latest
  Object.keys(versions0).forEach((v) => {
    if (validVersion(v)) {
      latest = latest && gt(latest, v) ? latest : v
    }
  })
  versions0.latest = latest
  const spec = maybeRemoveVPrefix(spec0)

  const altVersions = {}
  Object.entries(versions0).forEach(([version, altVersion]) => {
    let coerced
    if (
      isStrictVersion() ||
      isRC(version) ||
      isKnownBranch(version) ||
      isKnownVerBranch(version)
    ) {
      // If `version-type: strict`, version is an RC, or version is "a branch"
      // we just try to remove a potential initial v
      coerced = maybeRemoveVPrefix(version)
    } else {
      // Otherwise, we place the version into a version bucket
      coerced = maybeCoerced(version)
    }
    const alt = (altVersions[coerced] || []).concat(altVersion)
    alt.sort(sortVersions)
    altVersions[coerced] = alt
  })

  let versions = Object.keys(altVersions)

  const rangeForMax = semver.validRange(spec0) || maybeCoerced(spec)
  const rangeMax = semver.maxSatisfying(versions, rangeForMax)
  let version = null

  if (spec0 === 'latest') {
    version = versions0[versions0.latest]
  } else if (
    isStrictVersion() ||
    isRC(spec0) ||
    isKnownBranch(spec0) ||
    isKnownVerBranch(spec0) ||
    spec0 === 'nightly'
  ) {
    if (versions0[spec]) {
      // We obtain it directly
      version = versions0[spec]
    }
  } else if (rangeMax !== null) {
    // Otherwise, we compare alt. versions' semver ranges to this version, from highest to lowest
    const thatVersion = spec
    const thatVersionAbc = versionAbc(thatVersion)
    const thatVersionAbcRange = semver.validRange(thatVersionAbc)

    versions = altVersions[rangeMax]
    for (let i = versions.length - 1; i >= 0; i -= 1) {
      const thisVersion = versions[i]
      const thisVersionAbc = versionAbc(thisVersion)
      const thisVersionAbcRange = semver.validRange(thisVersionAbc)

      if (
        thatVersionAbcRange &&
        semver.intersects(thatVersionAbcRange, thisVersionAbcRange)
      ) {
        version = thisVersion
        break
      }
    }
  }

  return version || null
}

function maybeCoerced(v) {
  let ret = null
  try {
    if (!isRC(v)) {
      ret = semver.coerce(v).version
    } else {
      ret = maybeRemoveVPrefix(v)
    }
  } catch {
    // some stuff can't be coerced, like 'main'
    core.debug(`Was not able to coerce ${v} with semver`)
    ret = v
  }

  return ret
}

function sortVersions(left, right) {
  let ret = 0
  const newL = verAsComparableStr(left)
  const newR = verAsComparableStr(right)
  function verAsComparableStr(ver) {
    const matchGroups = 6
    const verSpec = xyzAbcVersion('', '')
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

function isRC(ver) {
  return ver.match(xyzAbcVersion('^', '(?:-rc\\.?\\d+)'))
}

function isKnownBranch(ver) {
  return knownBranches.includes(ver)
}

function isKnownVerBranch(ver) {
  return knownBranches.some((b) => ver.match(b))
}

function githubARMRunnerArchs() {
  return ['ARM', 'ARM64']
}

function githubAMDRunnerArchs() {
  return ['X86', 'X64']
}

function getRunnerOSArchitecture() {
  // These options come from:
  // https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
  if (githubARMRunnerArchs().includes(process.env.RUNNER_ARCH)) {
    return 'arm64'
  }

  if (githubAMDRunnerArchs().includes(process.env.RUNNER_ARCH)) {
    return 'amd64'
  }

  throw new Error(
    'Invalid Github runner architecture, expected one of ' +
      `${githubAMDRunnerArchs().concat(githubARMRunnerArchs()).join(', ')} ` +
      `but got process.env.RUNNER_ARCH = ${process.env.RUNNER_ARCH}`,
  )
}

function getRunnerOSVersion() {
  // List from https://github.com/actions/runner-images?tab=readme-ov-file#available-images
  const ImageOSToContainer = {
    ubuntu22: 'ubuntu-22.04',
    ubuntu24: 'ubuntu-24.04',
    win19: 'windows-2019',
    win22: 'windows-2022',
    macos13: 'macOS-13',
    macos14: 'macOS-14',
    macos15: 'macOS-15',
  }
  const deprecatedImageOSToContainer = {
    ubuntu18: 'ubuntu-18.04',
    ubuntu20: 'ubuntu-20.04',
  }
  const containerFromEnvImageOS = ImageOSToContainer[process.env.ImageOS]
  if (!containerFromEnvImageOS) {
    const deprecatedContainerFromEnvImageOS =
      deprecatedImageOSToContainer[process.env.ImageOS]
    if (deprecatedContainerFromEnvImageOS) {
      core.warning(
        `You are using deprecated ImageOS ${deprecatedContainerFromEnvImageOS}. ` +
          'Support for maintenance is very limited. Consider a non-deprecated version as ' +
          'mentioned in the README.md.',
      )

      return deprecatedContainerFromEnvImageOS
    } else {
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
  }

  return containerFromEnvImageOS
}

async function getUrlResponse(url, headers, attempt = 1) {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    })
    const contentType = response.headers.get('content-type') || ''

    if (!response.ok) {
      throw new Error(response.statusText)
    }

    if (contentType.indexOf('application/json') !== -1) {
      return response.json()
    } else {
      return response.text()
    }
  } catch (err) {
    core.debug(`Error fetching from ${url}: ${err}`)

    if (attempt <= MAX_HTTP_RETRIES) {
      const delay = attempt * 2 * 1000
      core.debug(`Error during fetch. Retrying in ${delay}ms`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return getUrlResponse(url, headers, attempt + 1)
    } else {
      throw err
    }
  }
}

async function get(url0, pageIdxs) {
  const url = new URL(url0)
  const headers = {}
  const GithubToken = getInput('github-token', false)
  if (GithubToken && url.host === 'api.github.com') {
    headers.authorization = `Bearer ${GithubToken}`
  }

  if ((pageIdxs || []).length === 0) {
    return getUrlResponse(url, headers)
  } else {
    return Promise.all(
      pageIdxs.map((page) => {
        const urlWithPage = new URL(url)
        urlWithPage.searchParams.append('page', page)
        return getUrlResponse(urlWithPage, headers)
      }),
    )
  }
}

function maybePrependWithV(v) {
  if (isVersion(v)) {
    return `v${v.replace('v', '')}`
  }

  return v
}

function maybeRemoveVPrefix(ver) {
  let ret = ver
  if (isVersion(ver)) {
    ret = ver.replace('v', '')
  }

  return ret
}

function xyzAbcVersion(pref, suf) {
  // This accounts for stuff like 6.0.2.0.1.0, as proposed by Erlang's
  // https://www.erlang.org/doc/system_principles/versions.html
  const dd = '\\.?(\\d+)?'
  return new RegExp(
    `${pref}(?:OTP-)?v?(\\d+)${dd}${dd}${dd}${dd}${dd}(?:-rc\\.?\\d+)?(?:-otp-\\d+)?${suf}`,
  )
}

function versionAbc(ver) {
  // For a version like 6.0.2.0.1.0, return 0.1.0
  return ver.match(/\d+(?:\.[^.]+)?(?:\.[^.]+)?(?:\.)?(.*)/)[1]
}

function isVersion(v) {
  return v.match(xyzAbcVersion('^', '$')) !== null
}

function getInput(inputName, required, alternativeName, alternatives) {
  const alternativeValue = (alternatives || new Map()).get(alternativeName)
  let input = core.getInput(inputName, {
    required: alternativeValue ? false : required,
  })
  // We can't have both input and alternativeValue set
  if (input && alternativeValue) {
    throw new Error(
      `Found input ${inputName}=${input} (from the YML) \
alongside ${alternativeName}=${alternativeValue} \
(from the version file). You must choose one or the other.`,
    )
  } else if (!input) {
    input = alternativeValue
  }

  return input
}

function parseVersionFile(versionFilePath0) {
  const versionFilePath = path.resolve(
    process.env.GITHUB_WORKSPACE,
    versionFilePath0,
  )
  if (!fs.existsSync(versionFilePath)) {
    throw new Error(
      `The specified version file, ${versionFilePath0}, does not exist`,
    )
  }

  core.startGroup(`Parsing version file at ${versionFilePath0}`)
  const appVersions = new Map()
  const versions = fs.readFileSync(versionFilePath, 'utf8')
  // For the time being we parse .tool-versions
  // If we ever start parsing something else, this should
  // become default in a new option named e.g. version-file-type
  versions.split(/\r?\n/).forEach((line) => {
    const appVersion = line.match(/^([^ ]+)[ ]+(ref:v?)?([^ #]+)/)
    if (appVersion) {
      const app = appVersion[1]
      if (['erlang', 'elixir', 'gleam', 'rebar'].includes(app)) {
        const [, , , version] = appVersion
        core.info(`Consuming ${app} at version ${version}`)
        appVersions.set(app, version)
      }
    }
  })
  if (!appVersions.size) {
    core.info('There was apparently nothing to consume')
  } else {
    core.info('... done!')
  }
  core.endGroup()

  return appVersions
}

function debugLog(groupName, message) {
  const group = `Debugging for ${groupName}`
  core.debug(
    '┌──────────────────────────────────────────────────────────────────────────',
  )
  core.debug(`│ ${group} - start`)
  core.debug(message)
  core.debug(`│ ${group} - stop`)
  core.debug(
    '└──────────────────────────────────────────────────────────────────────────',
  )
}

function hexMirrorsInput() {
  return core.getMultilineInput('hexpm-mirrors', {
    required: false,
  })
}

async function doWithMirrors(opts) {
  const { hexMirrors, actionTitle, action } = opts
  let actionRes

  if (hexMirrors.length === 0) {
    throw new Error(`Could not ${actionTitle} from any hex.pm mirror`)
  }

  const [hexMirror, ...hexMirrorsT] = hexMirrors
  try {
    actionRes = await action(hexMirror)
  } catch (err) {
    core.info(
      `Action ${actionTitle} failed for mirror ${hexMirror}, with ${err}`,
    )
    core.debug(`Stacktrace: ${err.stack}`)
    actionRes = await doWithMirrors({
      hexMirrors: hexMirrorsT,
      actionTitle,
      action,
    })
  }

  return actionRes
}

async function install(toolName, opts) {
  const { osVersion, toolVersion, hexMirror } = opts
  const versionSpec =
    osVersion !== undefined ? `${osVersion}/${toolVersion}` : toolVersion
  let installOpts

  // The installOpts object is composed of supported processPlatform keys
  // (e.g. 'linux', 'win32', or 'all' - in case there's no distinction between platforms)
  // In each of these keys there's an object with keys:
  // * downloadToolURL
  //     - where to fetch the downloadable from
  // * extract
  //     - if the downloadable is compressed: how to extract it
  //       - return ['dir', targetDir]
  //     - if the downloadable is not compressed: a filename.ext you want to cache it under
  //       - return ['file', filenameWithExt]
  // * postExtract
  //     - stuff to execute outside the cache scope (just after it's created)
  // * reportVersion
  ///    - configuration elements on how to output the tool version, post-install

  switch (toolName) {
    case 'otp':
      installOpts = {
        tool: 'Erlang/OTP',
        linux: {
          downloadToolURL: () =>
            `${hexMirror}/builds/otp/${getRunnerOSArchitecture()}/${versionSpec}.tar.gz`,
          extract: async (file) => {
            const dest = undefined
            const flags = ['zx', '--strip-components=1']
            const targetDir = await tc.extractTar(file, dest, flags)

            return ['dir', targetDir]
          },
          postExtract: async (cachePath) => {
            const cmd = path.join(cachePath, 'Install')
            const args = ['-minimal', cachePath]
            await exec(cmd, args)
          },
          reportVersion: () => {
            const cmd = 'erl'
            const args = ['-version']
            const env = {}

            return [cmd, args, env]
          },
        },
        win32: {
          downloadToolURL: () => {
            const otpArch = otpArchitecture()
            return (
              'https://github.com/erlang/otp/releases/download/' +
              `OTP-${toolVersion}/otp_win${_.escapeRegExp(otpArch)}_${toolVersion}.exe`
            )
          },
          extract: async () => ['file', 'otp.exe'],
          postExtract: async (cachePath) => {
            const cmd = path.join(cachePath, 'otp.exe')
            const args = ['/S', `/D=${cachePath}`]
            await exec(cmd, args)
          },
          reportVersion: () => {
            const cmd = 'erl.exe'
            const args = ['+V']
            const env = {}

            return [cmd, args, env]
          },
        },
        darwin: {
          downloadToolURL: (versionSpec) => {
            let suffix = ''
            if (isKnownVerBranch(versionSpec)) {
              // for these otp_builds adds `-latest` in the folder path
              suffix = '-latest'
            }
            return (
              `https://github.com/erlef/otp_builds/releases/download/` +
              `${toolVersion}${suffix}/${toolVersion}-macos-${getRunnerOSArchitecture()}.tar.gz`
            )
          },
          extract: async (file) => {
            const dest = undefined
            const flags = ['zx']
            const targetDir = await tc.extractTar(file, dest, flags)

            return ['dir', targetDir]
          },
          postExtract: async (/*cachePath*/) => {
            // nothing to do
          },
          reportVersion: () => {
            const cmd = 'erl'
            const args = ['-version']
            const env = {}

            return [cmd, args, env]
          },
        },
      }
      break
    case 'elixir':
      installOpts = {
        tool: 'Elixir',
        all: {
          downloadToolURL: () =>
            `${hexMirror}/builds/elixir/${versionSpec}.zip`,
          extract: async (file) => {
            const targetDir = await tc.extractZip(file)

            return ['dir', targetDir]
          },
          postExtract: async () => {
            const escriptsPath = path.join(os.homedir(), '.mix', 'escripts')
            fs.mkdirSync(escriptsPath, { recursive: true })
            core.addPath(escriptsPath)

            if (debugLoggingEnabled()) {
              core.exportVariable('ELIXIR_CLI_ECHO', 'true')
            }
          },
          reportVersion: () => {
            const cmd = 'elixir'
            const args = ['-v']
            const env = {}

            return [cmd, args, env]
          },
        },
      }
      break
    case 'gleam':
      installOpts = {
        tool: 'Gleam',
        linux: {
          downloadToolURL: () => {
            let gz
            if (
              versionSpec === 'nightly' ||
              semver.gt(versionSpec, 'v0.22.1')
            ) {
              gz = `gleam-${versionSpec}-x86_64-unknown-linux-musl.tar.gz`
            } else {
              gz = `gleam-${versionSpec}-linux-amd64.tar.gz`
            }

            return `https://github.com/gleam-lang/gleam/releases/download/${versionSpec}/${gz}`
          },
          extract: async (file) => {
            const dest = undefined
            const flags = ['zx']
            const targetDir = await tc.extractTar(file, dest, flags)

            return ['dir', targetDir]
          },
          postExtract: async (cachePath) => {
            const bindir = path.join(cachePath, 'bin')
            const oldPath = path.join(cachePath, 'gleam')
            const newPath = path.join(bindir, 'gleam')
            fs.mkdirSync(bindir)
            fs.renameSync(oldPath, newPath)
          },
          reportVersion: () => {
            const cmd = 'gleam'
            const args = ['--version']
            const env = {}

            return [cmd, args, env]
          },
        },
        win32: {
          downloadToolURL: () => {
            let zip
            if (
              versionSpec === 'nightly' ||
              semver.gt(versionSpec, 'v0.22.1')
            ) {
              zip = `gleam-${versionSpec}-x86_64-pc-windows-msvc.zip`
            } else {
              zip = `gleam-${versionSpec}-windows-64bit.zip`
            }

            return `https://github.com/gleam-lang/gleam/releases/download/${versionSpec}/${zip}`
          },
          extract: async (file) => {
            const targetDir = await tc.extractZip(file)

            return ['dir', targetDir]
          },
          postExtract: async (cachePath) => {
            const bindir = path.join(cachePath, 'bin')
            const oldPath = path.join(cachePath, 'gleam.exe')
            const newPath = path.join(bindir, 'gleam.exe')
            fs.mkdirSync(bindir)
            fs.renameSync(oldPath, newPath)
          },
          reportVersion: () => {
            const cmd = 'gleam.exe'
            const args = ['--version']
            const env = {}

            return [cmd, args, env]
          },
        },
      }
      installOpts.darwin = installOpts.linux
      break
    case 'rebar3':
      installOpts = {
        tool: 'Rebar3',
        linux: {
          downloadToolURL: () => {
            let url
            if (versionSpec === 'nightly') {
              url = 'https://s3.amazonaws.com/rebar3-nightly/rebar3'
            } else {
              url = `https://github.com/erlang/rebar3/releases/download/${versionSpec}/rebar3`
            }

            return url
          },
          extract: async () => ['file', 'rebar3'],
          postExtract: async (cachePath) => {
            const bindir = path.join(cachePath, 'bin')
            const oldPath = path.join(cachePath, 'rebar3')
            const newPath = path.join(bindir, 'rebar3')
            fs.mkdirSync(bindir, { recursive: true })
            fs.renameSync(oldPath, newPath)
            fs.chmodSync(newPath, 0o755)
          },
          reportVersion: () => {
            const cmd = 'rebar3'
            const args = ['version']
            const env = {
              REBAR_GLOBAL_CONFIG_DIR: '/fake-dir',
              REBAR_CONFIG: 'fake.config',
            }

            return [cmd, args, env]
          },
        },
        win32: {
          downloadToolURL: () => {
            let url
            if (versionSpec === 'nightly') {
              url = 'https://s3.amazonaws.com/rebar3-nightly/rebar3'
            } else {
              url = `https://github.com/erlang/rebar3/releases/download/${versionSpec}/rebar3`
            }

            return url
          },
          extract: async () => ['file', 'rebar3'],
          postExtract: async (cachePath) => {
            const bindir = path.join(cachePath, 'bin')
            const oldPath = path.join(cachePath, 'rebar3')
            const newPath = path.join(bindir, 'rebar3')
            fs.mkdirSync(bindir)
            fs.renameSync(oldPath, newPath)
            fs.chmodSync(newPath, 0o755)

            const ps1Filename = path.join(bindir, 'rebar3.ps1')
            fs.writeFileSync(ps1Filename, `& escript.exe ${newPath} \${args}`)

            const cmdFilename = path.join(bindir, 'rebar3.cmd')
            fs.writeFileSync(
              cmdFilename,
              `@echo off\r\nescript.exe ${newPath} %*`,
            )
          },
          reportVersion: () => {
            const cmd = 'rebar3.cmd'
            const args = ['version']
            const env = {}

            return [cmd, args, env]
          },
        },
      }
      installOpts.darwin = installOpts.linux
      break
    default:
      throw new Error(`no installer for ${toolName}`)
  }

  await installTool({ toolName, versionSpec, installOpts })
}

async function installTool(opts) {
  const { toolName, versionSpec, installOpts } = opts
  const platformOpts = installOpts[process.platform] || installOpts.all
  let cachePath = tc.find(toolName, versionSpec)

  core.debug(`Checking if ${installOpts.tool} is already cached...`)
  if (cachePath === '') {
    core.debug("  ... it isn't!")
    const downloadToolURL = platformOpts.downloadToolURL(versionSpec)
    const file = await tc.downloadTool(downloadToolURL)
    const [targetElemType, targetElem] = await platformOpts.extract(file)

    if (targetElemType === 'dir') {
      cachePath = await tc.cacheDir(targetElem, toolName, versionSpec)
    } else if (targetElemType === 'file') {
      cachePath = await tc.cacheFile(file, targetElem, toolName, versionSpec)
    }
  } else {
    core.debug(`  ... it is, at ${cachePath}`)
  }

  // This makes sure we run, e.g. in Windows, the installer in the runner
  // We're not caching the install, just the downloaded tool
  const runnerToolPath = path.join(
    process.env.RUNNER_TEMP,
    '.setup-beam',
    toolName,
  )
  fs.cpSync(cachePath, runnerToolPath, { recursive: true })

  core.debug('Performing post extract operations...')
  await platformOpts.postExtract(runnerToolPath)

  core.debug(`Adding ${runnerToolPath}' bin to system path`)
  const runnerToolPathBin = path.join(runnerToolPath, 'bin')
  core.addPath(runnerToolPathBin)

  const installDirForVarName = `INSTALL_DIR_FOR_${toolName}`.toUpperCase()
  core.debug(`Exporting ${installDirForVarName} as ${runnerToolPath}`)
  core.exportVariable(installDirForVarName, runnerToolPath)

  core.info(`Installed ${installOpts.tool} version`)
  const [cmd, args, env] = platformOpts.reportVersion()
  await exec(cmd, args, { env: { ...process.env, ...env } })
}

function checkOtpArchitecture() {
  const otpArch = otpArchitecture()

  if (process.platform !== 'win32' && otpArch == '32') {
    throw new Error(
      '@erlef/setup-beam only supports otp-architecture=32 on Windows',
    )
  }

  if (!['32', '64'].includes(otpArch)) {
    throw new Error('otp-architecture must be 32 or 64')
  }
}

function debugLoggingEnabled() {
  return !!process.env.RUNNER_DEBUG
}

module.exports = {
  get,
  getElixirVersion,
  getGleamVersion,
  getOTPVersion,
  getRebar3Version,
  getVersionFromSpec,
  githubAMDRunnerArchs,
  githubARMRunnerArchs,
  install,
  installOTP,
  maybeInstallElixir,
  maybeInstallGleam,
  maybeInstallRebar3,
  parseVersionFile,
}
