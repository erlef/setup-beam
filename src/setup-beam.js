const core = require('@actions/core')
const { exec } = require('@actions/exec')
const tc = require('@actions/tool-cache')
const http = require('@actions/http-client')
const path = require('path')
const semver = require('semver')
const fs = require('fs')
const os = require('os')

main().catch((err) => {
  core.setFailed(err.message)
})

async function main() {
  checkPlatform()

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

  const osVersion = getRunnerOSVersion()
  const otpSpec = getInput('otp-version', true, 'erlang', versions)
  const elixirSpec = getInput('elixir-version', false, 'elixir', versions)
  const gleamSpec = getInput('gleam-version', false, 'gleam', versions)
  const rebar3Spec = getInput('rebar3-version', false, 'rebar', versions)

  if (otpSpec !== 'false') {
    await installOTP(otpSpec, osVersion)
    const elixirInstalled = await maybeInstallElixir(elixirSpec, otpSpec)
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
  const setupBeamVersion = '6292fa4'
  core.setOutput('setup-beam-version', setupBeamVersion)
}

async function installOTP(otpSpec, osVersion) {
  const otpVersion = await getOTPVersion(otpSpec, osVersion)
  core.startGroup(`Installing Erlang/OTP ${otpVersion} - built on ${osVersion}`)
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

async function maybeInstallElixir(elixirSpec, otpSpec) {
  let installed = false
  if (elixirSpec) {
    const elixirVersion = await getElixirVersion(elixirSpec, otpSpec)
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

async function getOTPVersion(otpSpec0, osVersion) {
  const otpVersions = await getOTPVersions(osVersion)
  let spec = otpSpec0.replace(/^OTP-/, '')
  const versions = otpVersions
  const otpVersion = getVersionFromSpec(spec, versions)
  if (otpVersion === null) {
    throw new Error(
      `Requested Erlang/OTP version (${otpSpec0}) not found in version list ` +
        "(should you be using option 'version-type': 'strict'?)",
    )
  }

  return otpVersion // from the reference, for download
}

async function getElixirVersion(exSpec0, otpVersion0) {
  const otpVersion = otpVersion0.match(/^([^-]+-)?(.+)$/)[2]
  const otpVersionMajor = otpVersion.match(/^([^.]+).*$/)[1]

  const [otpVersionsForElixirMap, elixirVersions] = await getElixirVersions()
  const spec = exSpec0.replace(/-otp-.*$/, '')
  const versions = elixirVersions
  const elixirVersionFromSpec = getVersionFromSpec(spec, versions)

  if (elixirVersionFromSpec === null) {
    throw new Error(
      `Requested Elixir version (${exSpec0}) not found in version list ` +
        "(should you be using option 'version-type': 'strict'?)",
    )
  }

  const elixirVersionComp = otpVersionsForElixirMap[elixirVersionFromSpec]
  if (
    (elixirVersionComp && elixirVersionComp.includes(otpVersionMajor)) ||
    !isVersion(otpVersionMajor)
  ) {
    core.info(
      `Using Elixir ${elixirVersionFromSpec} (built for Erlang/OTP ${otpVersionMajor})`,
    )
  } else {
    throw new Error(
      `Requested Elixir / Erlang/OTP version (${exSpec0} / ${otpVersion0}) not ` +
        'found in version list (did you check Compatibility between Elixir and Erlang/OTP?).' +
        'Elixir and Erlang/OTP compatibility can be found at: ' +
        'https://hexdocs.pm/elixir/compatibility-and-deprecations.html',
    )
  }

  let elixirVersionForDownload = elixirVersionFromSpec

  if (isVersion(otpVersionMajor)) {
    elixirVersionForDownload = `${elixirVersionFromSpec}-otp-${otpVersionMajor}`
  }

  return maybePrependWithV(elixirVersionForDownload)
}

async function getGleamVersion(gleamSpec0) {
  const gleamVersions = await getGleamVersions()
  const spec = gleamSpec0
  const versions = gleamVersions
  const gleamVersion = getVersionFromSpec(spec, versions)
  if (gleamVersion === null) {
    throw new Error(
      `Requested Gleam version (${gleamSpec0}) not found in version list ` +
        "(should you be using option 'version-type': 'strict'?)",
    )
  }

  return maybePrependWithV(gleamVersion)
}

async function getRebar3Version(r3Spec) {
  const rebar3Versions = await getRebar3Versions()
  const spec = r3Spec
  const versions = rebar3Versions
  const rebar3Version = getVersionFromSpec(spec, versions)
  if (rebar3Version === null) {
    throw new Error(
      `Requested rebar3 version (${r3Spec}) not found in version list ` +
        "(should you be using option 'version-type': 'strict'?)",
    )
  }

  return rebar3Version
}

async function getOTPVersions(osVersion) {
  let otpVersionsListings
  let originListing
  if (process.platform === 'linux') {
    let osArchitecture = getRunnerOSArchitecture()
    if (osArchitecture.length > 0) {
      osArchitecture = `${osArchitecture}/`
    }

    originListing = `/builds/otp/${osArchitecture}${osVersion}/builds.txt`
    otpVersionsListings = await doWithMirrors({
      hexMirrors: hexMirrorsInput(),
      actionTitle: `fetch ${originListing}`,
      action: async (hexMirror) => {
        const l = await get(`${hexMirror}${originListing}`, [null])
        return l
      },
    })
  } else if (process.platform === 'win32') {
    originListing =
      'https://api.github.com/repos/erlang/otp/releases?per_page=100'
    otpVersionsListings = await get(originListing, [1, 2, 3])
  }

  debugLog(`OTP versions listings from ${originListing}`, otpVersionsListings)

  const otpVersions = {}
  if (process.platform === 'linux') {
    otpVersionsListings
      .trim()
      .split('\n')
      .forEach((line) => {
        const otpMatch = line
          .match(/^([^ ]+)?( .+)/)[1]
          .match(/^([^-]+-)?(.+)$/)
        const otpVersion = otpMatch[2]
        const otpVersionOrig = otpMatch[0]
        debugLog('OTP line and parsing', [line, otpVersion, otpMatch])
        otpVersions[otpVersion] = otpVersionOrig // we keep the original for later reference
      })
  } else if (process.platform === 'win32') {
    otpVersionsListings.forEach((otpVersionsListing) => {
      jsonParseAsList(otpVersionsListing)
        .map((x) => x.assets)
        .flat()
        .filter((x) => x.name.match(/^otp_win64_.*.exe$/))
        .forEach((x) => {
          const otpMatch = x.name.match(/^otp_win64_(.*).exe$/)
          const otpVersion = otpMatch[1]
          debugLog('OTP line and parsing', [otpMatch, otpVersion])
          otpVersions[otpVersion] = otpVersion
        })
    })
  }

  debugLog(`OTP versions from ${originListing}`, JSON.stringify(otpVersions))

  return otpVersions
}

async function getElixirVersions() {
  const originListing = '/builds/elixir/builds.txt'
  const elixirVersionsListings = await doWithMirrors({
    hexMirrors: hexMirrorsInput(),
    actionTitle: `fetch ${originListing}`,
    action: async (hexMirror) => {
      const l = await get(`${hexMirror}${originListing}`, [null])
      return l
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

  return [otpVersionsForElixirMap, elixirVersions]
}

async function getGleamVersions() {
  const resultJSONs = await get(
    'https://api.github.com/repos/gleam-lang/gleam/releases?per_page=100',
    [1, 2, 3],
  )
  const gleamVersionsListing = {}
  resultJSONs.forEach((resultJSON) => {
    jsonParseAsList(resultJSON)
      .map((x) => x.tag_name)
      .forEach((ver) => {
        const gleamMatch = ver.match(/^v?([^ ]+)/)
        const gleamVersion = gleamMatch[1]
        gleamVersionsListing[gleamVersion] = gleamVersion
      })
  })

  return gleamVersionsListing
}

async function getRebar3Versions() {
  const resultJSONs = await get(
    'https://api.github.com/repos/erlang/rebar3/releases?per_page=100',
    [1, 2, 3],
  )
  const rebar3VersionsListing = {}
  resultJSONs.forEach((resultJSON) => {
    jsonParseAsList(resultJSON)
      .map((x) => x.tag_name)
      .forEach((ver) => {
        rebar3VersionsListing[ver] = ver
      })
  })

  return rebar3VersionsListing
}

function isStrictVersion() {
  return getInput('version-type', false) === 'strict'
}

function getVersionFromSpec(spec0, versions0) {
  const spec = maybeRemoveVPrefix(spec0)

  const altVersions = {}
  Object.entries(versions0).forEach(([version, altVersion]) => {
    let coerced
    if (isStrictVersion() || isRC(version)) {
      // If `version-type: strict` or version is RC, we just try to remove a potential initial v
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

  if (isStrictVersion() || isRC(spec0) || isKnownBranch(spec0)) {
    if (versions0[spec]) {
      // If `version-type: strict` or version is RC, we obtain it directly
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
  return ['main', 'master', 'maint'].includes(ver)
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

  return ''
}

function getRunnerOSVersion() {
  const ImageOSToContainer = {
    ubuntu18: 'ubuntu-18.04',
    ubuntu20: 'ubuntu-20.04',
    ubuntu22: 'ubuntu-22.04',
    ubuntu24: 'ubuntu-24.04',
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
  async function getPage(pageIdx) {
    const url = new URL(url0)
    const headers = {}
    const GithubToken = getInput('github-token', false)
    if (GithubToken && url.host === 'api.github.com') {
      headers.authorization = `Bearer ${GithubToken}`
    }

    if (pageIdx !== null) {
      url.searchParams.append('page', pageIdx)
    }

    const httpClient = new http.HttpClient('setup-beam', [], {
      allowRetries: true,
      maxRetries: 3,
    })
    const response = await httpClient.get(url, headers)
    if (response.statusCode >= 400 && response.statusCode <= 599) {
      throw new Error(
        `Got ${response.statusCode} from ${url}. Exiting with error`,
      )
    }

    return response.readBody()
  }

  if (pageIdxs[0] === null) {
    return getPage(null)
  }

  return Promise.all(pageIdxs.map(getPage))
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
    `${pref}v?(\\d+)${dd}${dd}${dd}${dd}${dd}(?:-rc\\.?\\d+)?(?:-otp-\\d+)?${suf}`,
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
  versions.split('\n').forEach((line) => {
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

function jsonParseAsList(maybeJson) {
  try {
    const obj = JSON.parse(maybeJson)
    if (!Array.isArray(obj)) {
      throw new Error('expected a list!')
    }

    return obj
  } catch (exc) {
    throw new Error(
      `Got an exception when trying to parse non-JSON list ${maybeJson}: ${exc}`,
    )
  }
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
            `${hexMirror}/builds/otp/${versionSpec}.tar.gz`,
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
          downloadToolURL: () =>
            'https://github.com/erlang/otp/releases/download/' +
            `OTP-${toolVersion}/otp_win64_${toolVersion}.exe`,
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
            fs.mkdirSync(bindir)
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
    const downloadToolURL = platformOpts.downloadToolURL()
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

function checkPlatform() {
  if (process.platform !== 'linux' && process.platform !== 'win32') {
    throw new Error(
      '@erlef/setup-beam only supports Ubuntu and Windows at this time',
    )
  }
}

function debugLoggingEnabled() {
  return !!process.env.RUNNER_DEBUG
}

module.exports = {
  getOTPVersion,
  getElixirVersion,
  getGleamVersion,
  getRebar3Version,
  getVersionFromSpec,
  install,
  parseVersionFile,
}
