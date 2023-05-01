const core = require('@actions/core')
const { exec } = require('@actions/exec')
const tc = require('@actions/tool-cache')
const path = require('path')
const fs = require('fs');
const os = require('os');

/**
 * Install Erlang/OTP.
 *
 * @param {string} osVersion
 * @param {string} otpVersion
 * @param {string[]} hexMirrors
 */
async function installOTP(osVersion, otpVersion, hexMirrors) {
  const OS = process.platform
  if (OS === 'linux') {
    if (hexMirrors.length === 0) {
      throw new Error(
        `Could not install Erlang/OTP ${otpVersion} from any hex.pm mirror`,
      )
    }
    const [hexMirror, ...hexMirrorsT] = hexMirrors
    try {
      await exec(path.join(__dirname, 'install-otp.sh'), [
        osVersion,
        otpVersion,
        hexMirror,
      ])
      return
    } catch (err) {
      core.info(`install-otp.sh failed for mirror ${hexMirror}`)
    }
    await installOTP(osVersion, otpVersion, hexMirrorsT)
  } else if (OS === 'win32') {
    const script = path.join(__dirname, 'install-otp.ps1')
    await exec(`pwsh.exe ${script} -VSN:${otpVersion}`)
  }
}

/**
 * Install Elixir.
 *
 * @param {string} elixirVersion
 * @param {string[]} hexMirrors
 */
async function installElixir(elixirVersion, hexMirrors) {
  if (hexMirrors.length === 0) {
    throw new Error(
      `Could not install Elixir ${elixirVersion} from any hex.pm mirror`,
    )
  }
  const [hexMirror, ...hexMirrorsT] = hexMirrors

  try {
    let cachedPath = tc.find('elixir', elixirVersion)

    if (!cachedPath) {
      const zipPath = await tc.downloadTool(
        `${hexMirror}/builds/elixir/${elixirVersion}.zip`,
      )
      const extractPath = await tc.extractZip(zipPath)
      cachedPath = await tc.cacheDir(extractPath, 'elixir', elixirVersion)
    }

    const elixirPath = path.join(cachedPath, 'bin')
    const escriptsPath = path.join(os.homedir(), '.mix', 'escripts')

    core.addPath(elixirPath)
    core.addPath(escriptsPath)
    core.exportVariable('INSTALL_DIR_FOR_ELIXIR', cachedPath)

    core.info('Installed Elixir version')
    await exec(path.join(elixirPath, 'elixir'), ['-v'])

    await fs.promises.mkdir(escriptsPath, { recursive: true })
  } catch (err) {
    core.info(`Elixir install failed for mirror ${hexMirror}`)
    await installElixir(elixirVersion, hexMirrorsT)
  }
}

/**
 * Install Gleam.
 *
 * @param {string} gleamVersion
 */
async function installGleam(gleamVersion) {
  const OS = process.platform
  if (OS === 'linux') {
    await exec(path.join(__dirname, 'install-gleam.sh'), [gleamVersion])
  } else if (OS === 'win32') {
    const script = path.join(__dirname, 'install-gleam.ps1')
    await exec(`pwsh.exe ${script} -VSN:${gleamVersion}`)
  }
}

/**
 * Install rebar3.
 *
 * @param {string} rebar3Version
 */
async function installRebar3(rebar3Version) {
  const OS = process.platform
  if (OS === 'linux') {
    await exec(path.join(__dirname, 'install-rebar3.sh'), [rebar3Version])
  } else if (OS === 'win32') {
    const script = path.join(__dirname, 'install-rebar3.ps1')
    await exec(`pwsh.exe ${script} -VSN:${rebar3Version}`)
  }
}

function checkPlatform() {
  if (process.platform !== 'linux' && process.platform !== 'win32') {
    throw new Error(
      '@erlef/setup-beam only supports Ubuntu and Windows at this time',
    )
  }
}

module.exports = {
  installOTP,
  installElixir,
  installGleam,
  installRebar3,
  checkPlatform,
}
