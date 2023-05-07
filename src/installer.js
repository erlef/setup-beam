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
  if (hexMirrors.length === 0) {
    throw new Error(
      `Could not install Erlang/OTP ${otpVersion} from any hex.pm mirror`,
    )
  }

  const [hexMirror, ...hexMirrorsT] = hexMirrors
  const fullVersion = `${osVersion}/${otpVersion}`
  let cachedPath = tc.find('otp', fullVersion)
  const OS = process.platform

  try {
    if (OS === 'linux') {
      if (!cachedPath) {
        const tarPath = await tc.downloadTool(
          `https://builds.hex.pm/builds/otp/${fullVersion}.tar.gz`,
        )
        const extractPath = await tc.extractTar(tarPath, undefined, ['zx', '--strip-components=1'])
        cachedPath = await tc.cacheDir(extractPath, 'otp', fullVersion)
      }

      // TODO: Can we cache install?
      await exec(path.join(cachedPath, 'Install'), ['-minimal', cachedPath])

      const otpPath = path.join(cachedPath, 'bin')

      core.addPath(otpPath)
      core.exportVariable('INSTALL_DIR_FOR_OTP', cachedPath)

      console.log('Installed Erlang/OTP version')
      await exec(path.join(otpPath, 'erl'), ['-version'])
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

      // TODO: Can we cache install?
      await fs.promises.mkdir(otpDir, { recursive: true })
      await exec(path.join(cachedPath, 'otp.exe'), ['/S', `/D=${otpDir}`])

      core.addPath(otpPath)
      core.exportVariable('INSTALL_DIR_FOR_OTP', otpDir)

      console.log('Installed Erlang/OTP version')
      await exec(path.join(otpPath, 'erl'), ['+V'])
    }
  } catch (err) {
    core.info(`Install OTP failed for mirror ${hexMirror}`)
    core.info(`${err}\n${err.stack}`)
    await installOTP(osVersion, otpVersion, hexMirrorsT)
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
    core.info(`${err}\n${err.stack}`)
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
