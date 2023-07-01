const core = require('@actions/core')
const { exec } = require('@actions/exec')
const tc = require('@actions/tool-cache')
const path = require('path')
const fs = require('fs')
const os = require('os')

/**
 * Install Erlang/OTP.
 *
 * @param {string} osVersion
 * @param {string} otpVersion
 */
async function installOTP(osVersion, otpVersion, hexMirror) {
  let cmd
  let args

  const fullVersion = `${osVersion}/${otpVersion}`
  let cachedPath = tc.find('otp', fullVersion)
  const OS = process.platform

  if (OS === 'linux') {
    if (!cachedPath) {
      const tarPath = await tc.downloadTool(
        `${hexMirror}/builds/otp/${fullVersion}.tar.gz`,
      )
      const extractPath = await tc.extractTar(tarPath, undefined, [
        'zx',
        '--strip-components=1',
      ])
      cachedPath = await tc.cacheDir(extractPath, 'otp', fullVersion)
    }

    cmd = path.join(cachedPath, 'Install')
    args = ['-minimal', cachedPath]
    await exec(cmd, args)

    const otpPath = path.join(cachedPath, 'bin')

    core.addPath(otpPath)
    core.exportVariable('INSTALL_DIR_FOR_OTP', cachedPath)

    core.info('Installed Erlang/OTP version')
    cmd = path.join(otpPath, 'erl')
    args = ['-version']
    await exec(cmd, args)
  } else if (OS === 'win32') {
    if (!cachedPath) {
      const exePath = await tc.downloadTool(
        'https://github.com/erlang/otp/releases/download/' +
          `OTP-${otpVersion}/otp_win64_${otpVersion}.exe`,
      )
      cachedPath = await tc.cacheFile(exePath, 'otp.exe', 'otp', fullVersion)
    }

    const otpDir = path.join(process.env.RUNNER_TEMP, '.setup-beam', 'otp')
    const otpPath = path.join(otpDir, 'bin')

    await fs.promises.mkdir(otpDir, { recursive: true })

    cmd = path.join(cachedPath, 'otp.exe')
    args = ['/S', `/D=${otpDir}`]
    await exec(cmd, args)

    core.addPath(otpPath)
    core.exportVariable('INSTALL_DIR_FOR_OTP', otpDir)

    core.info('Installed Erlang/OTP version')

    cmd = path.join(otpPath, 'erl.exe')
    args = ['+V']
    await exec(cmd, args)
  }
}

/**
 * Install Elixir.
 *
 * @param {string} elixirVersion
 */
async function installElixir(elixirVersion, hexMirror) {
  let cmd
  let args
  let options

  let cachedPath = tc.find('elixir', elixirVersion)
  const OS = process.platform

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

  if (debugLoggingEnabled()) {
    core.exportVariable('ELIXIR_CLI_ECHO', 'true')
  }

  if (OS === 'linux') {
    cmd = path.join(elixirPath, 'elixir')
    args = ['-v']
    options = {}
  } else if (OS === 'win32') {
    cmd = path.join(elixirPath, 'elixir.bat')
    args = ['-v']
    options = { windowsVerbatimArguments: true }
  }
  await exec(cmd, args, options)

  await fs.promises.mkdir(escriptsPath, { recursive: true })
}

/**
 * Install Gleam.
 *
 * @param {string} gleamVersion
 */
async function installGleam(gleamVersion) {
  let cmd
  let args

  const OS = process.platform
  if (OS === 'linux') {
    cmd = path.join(__dirname, 'install-gleam.sh')
    args = [gleamVersion]
    await exec(cmd, args)
  } else if (OS === 'win32') {
    cmd = `pwsh.exe ${path.join(__dirname, 'install-gleam.ps1')}`
    args = [`-VSN:${gleamVersion}`]
    await exec(cmd, args)
  }
}

/**
 * Install rebar3.
 *
 * @param {string} rebar3Version
 */
async function installRebar3(rebar3Version) {
  let cmd
  let args

  const OS = process.platform
  if (OS === 'linux') {
    cmd = path.join(__dirname, 'install-rebar3.sh')
    args = [rebar3Version]
    await exec(cmd, args)
  } else if (OS === 'win32') {
    cmd = `pwsh.exe ${path.join(__dirname, 'install-rebar3.ps1')}`
    args = [`-VSN:${rebar3Version}`]
    await exec(cmd, args)
  }
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
  installOTP,
  installElixir,
  installGleam,
  installRebar3,
  checkPlatform,
}
