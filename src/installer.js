const core = require('@actions/core')
const { exec } = require('@actions/exec')
const tc = require('@actions/tool-cache')
const path = require('path')
const fs = require('fs')
const os = require('os')

async function install(toolName, opts) {
  const { osVersion, toolVersion, hexMirror } = opts
  const versionSpec =
    osVersion !== undefined ? `${osVersion}/${toolVersion}` : toolVersion
  const cachePath0 = tc.find(toolName, versionSpec)
  const processPlatform = process.platform
  let installOpts

  // The installOpts object is composed of supported processPlatform keys
  // (e.g. 'linux', 'win32', or 'all' - in case there's no distinction between platforms)
  // In each of these keys there's an object with keys:
  // * downloadToolURL
  //     - where to fetch the downloadable from
  // * postDownloadCache
  //     - what to do with the downloadable (e.g. cache the tool using tc)
  // * installCmdArgsOptions [optional]
  //     - return a [cmd, args, options] list to execute the installer
  // * postInstall
  ///    - what to execute after installation is concluded (e.g. output the tool version)

  switch (toolName) {
    case 'otp':
      installOpts = {
        linux: {
          downloadToolURL: `${hexMirror}/builds/otp/${versionSpec}.tar.gz`,
          postDownloadCache: async (file) => {
            const dest = undefined
            const flags = ['zx', '--strip-components=1']
            const targetDir = await tc.extractTar(file, dest, flags)
            return tc.cacheDir(targetDir, toolName, versionSpec)
          },
          installCmdArgsOptions: (cachePath) => {
            const cmd = path.join(cachePath, 'Install')
            const args = ['-minimal', cachePath]
            const options = {}
            return [cmd, args, options]
          },
          postInstall: async (binFolder) => {
            core.info('Installed Erlang/OTP version')
            const cmd = path.join(binFolder, 'erl')
            const args = ['-version']
            return exec(cmd, args)
          },
        },
        win32: {
          downloadToolURL:
            'https://github.com/erlang/otp/releases/download/' +
            `OTP-${toolVersion}/otp_win64_${toolVersion}.exe`,
          postDownloadCache: async (file) => {
            const targetFile = 'otp.exe'
            return tc.cacheFile(file, targetFile, toolName, versionSpec)
          },
          installCmdArgsOptions: (cachePath) => {
            const cmd = path.join(cachePath, 'otp.exe')
            const args = ['/S', `/D=${cachePath}`]
            const options = {}
            return [cmd, args, options]
          },
          postInstall: async (binFolder) => {
            core.info('Installed Erlang/OTP version')
            const cmd = path.join(binFolder, 'erl.exe')
            const args = ['+V']
            return exec(cmd, args)
          },
        },
      }
      break
    case 'elixir':
      installOpts = {
        all: {
          downloadToolURL: `${hexMirror}/builds/elixir/${toolVersion}.zip`,
          postDownloadCache: async (file) => {
            const targetDir = await tc.extractZip(file)
            return tc.cacheDir(targetDir, toolName, versionSpec)
          },
          postInstall: async (binFolder) => {
            const escriptsPath = path.join(os.homedir(), '.mix', 'escripts')
            await fs.promises.mkdir(escriptsPath, { recursive: true })
            core.addPath(escriptsPath)
            core.info('Installed Elixir version')
            if (debugLoggingEnabled()) {
              core.exportVariable('ELIXIR_CLI_ECHO', 'true')
            }
            const cmd = path.join(binFolder, 'elixir')
            const args = ['-v']
            const options = { windowsVerbatimArguments: true }
            return exec(cmd, args, options)
          },
        },
      }
      break
    case 'gleam':
      await installGleam(toolVersion)
      break
    case 'rebar3':
      await installRebar3(toolVersion)
      break
    default:
      throw new Error(`no installer for ${toolName}`)
  }

  if (['otp', 'elixir'].includes(toolName)) {
    // Temp.: this will otherwise break for Gleam and Rebar3
    await installTool({
      toolName,
      installOpts: installOpts.all || installOpts[processPlatform],
      cachePath0,
    })
  }
}

async function installTool(opts) {
  const { toolName, installOpts, cachePath0 } = opts
  let cachePath = cachePath0

  if (cachePath === '') {
    const file = await tc.downloadTool(installOpts.downloadToolURL)
    cachePath = await installOpts.postDownloadCache(file)
  }

  if (installOpts.installCmdArgsOptions) {
    const [cmd, args, options] = installOpts.installCmdArgsOptions(cachePath)
    await exec(cmd, args, options)
  }

  const binFolder = path.join(cachePath, 'bin')
  core.addPath(binFolder)
  core.exportVariable(`INSTALL_DIR_FOR_${toolName}`.toUpperCase(), cachePath)
  await installOpts.postInstall(binFolder)
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
  install,
  checkPlatform,
}
