const core = require('@actions/core')
const { exec } = require('@actions/exec')
const tc = require('@actions/tool-cache')
const path = require('path')
const fs = require('fs')
const os = require('os')
const semver = require('semver')

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
  // * whenNotCached
  //     - what to do with the downloadable (e.g. cache the tool using tc)
  // * outputVersion
  ///    - configuration elements on how to output the tool version, post-install

  switch (toolName) {
    case 'otp':
      installOpts = {
        tool: 'Erlang/OTP',
        linux: {
          downloadToolURL: () =>
            `${hexMirror}/builds/otp/${versionSpec}.tar.gz`,
          whenNotCached: async (file) => {
            const dest = undefined
            const flags = ['zx', '--strip-components=1']
            const targetDir = await tc.extractTar(file, dest, flags)
            const cachePathNoBin = await tc.cacheDir(
              targetDir,
              toolName,
              versionSpec,
            )

            const cmd = path.join(cachePathNoBin, 'Install')
            const args = ['-minimal', cachePathNoBin]
            await exec(cmd, args)

            const cachePath = path.join(cachePathNoBin, 'bin')
            return cachePath
          },
          outputVersion: () => {
            const cmd = 'erl'
            const args = ['-version']

            return [cmd, args]
          },
        },
        win32: {
          downloadToolURL: () =>
            'https://github.com/erlang/otp/releases/download/' +
            `OTP-${toolVersion}/otp_win64_${toolVersion}.exe`,
          whenNotCached: async (file) => {
            const targetFile = 'otp.exe'
            const cachePathNoBin = await tc.cacheFile(
              file,
              targetFile,
              toolName,
              versionSpec,
            )

            const cmd = path.join(cachePathNoBin, 'otp.exe')
            const args = ['/S', `/D=${cachePathNoBin}`]
            await exec(cmd, args)

            const cachePath = path.join(cachePathNoBin, 'bin')
            return cachePath
          },
          outputVersion: () => {
            const cmd = 'erl.exe'
            const args = ['+V']

            return [cmd, args]
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
          whenNotCached: async (file) => {
            const targetDir = await tc.extractZip(file)
            const cachePathNoBin = await tc.cacheDir(
              targetDir,
              toolName,
              versionSpec,
            )

            const escriptsPath = path.join(os.homedir(), '.mix', 'escripts')
            await fs.promises.mkdir(escriptsPath, { recursive: true })
            core.addPath(escriptsPath)

            if (debugLoggingEnabled()) {
              core.exportVariable('ELIXIR_CLI_ECHO', 'true')
            }

            const cachePath = path.join(cachePathNoBin, 'bin')
            return cachePath
          },
          outputVersion: () => {
            const cmd = 'elixir'
            const args = ['-v']

            return [cmd, args]
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
          whenNotCached: async (file) => {
            const dest = 'bin'
            const flags = ['zx']
            const targetDir = await tc.extractTar(file, dest, flags)
            const cachePath = await tc.cacheDir(
              targetDir,
              toolName,
              versionSpec,
            )

            return cachePath
          },
          outputVersion: () => {
            const cmd = 'gleam'
            const args = ['--version']

            return [cmd, args]
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

            return `"https://github.com/gleam-lang/gleam/releases/download/${versionSpec}/${zip}"`
          },
          whenNotCached: async (file) => {
            const dest = 'bin'
            const targetDir = await tc.extractZip(file, dest)
            const cachePath = await tc.cacheDir(
              targetDir,
              toolName,
              versionSpec,
            )

            return cachePath
          },
          outputVersion: () => {
            const cmd = 'gleam'
            const args = ['--version']

            return [cmd, args]
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
          whenNotCached: async (file) => {
            const folder = path.dirname(file)
            const filename = path.basename(file)
            const cachePath = path.join(folder, 'bin')
            fs.mkdirSync(cachePath)
            const targetFile = path.join(cachePath, filename)
            fs.rename(file, targetFile)
            fs.chmodSync(targetFile, 0o755)

            return cachePath
          },
          outputVersion: () => {
            const cmd = 'rebar3'
            const args = ['version']

            return [cmd, args]
          },
        },
        win32: {},
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

  core.debug(`Checking if ${toolName} is already cached...`)
  if (cachePath === '') {
    core.debug("  ... it isn't!")
    const downloadToolURL = platformOpts.downloadToolURL()
    const file = await tc.downloadTool(downloadToolURL)
    cachePath = await platformOpts.whenNotCached(file)
  } else {
    core.debug(`  ... it is, at ${cachePath}`)
  }

  core.debug(`Adding ${cachePath} to system path`)
  core.addPath(cachePath)

  const installDirForVarName = `INSTALL_DIR_FOR_${toolName}`.toUpperCase()
  core.debug(`Exporting ${installDirForVarName} as ${cachePath}`)
  core.exportVariable(installDirForVarName, cachePath)

  core.info(`Installed ${installOpts.tool} version`)
  const [cmd, args] = platformOpts.outputVersion()
  await exec(cmd, args)
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
