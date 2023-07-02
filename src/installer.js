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

            return [cmd, args]
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

            return [cmd, args]
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
            fs.mkdirSync(bindir)
            fs.chmodSync(oldPath, 0o755)

            const ps1Filename = path.join(bindir, 'rebar3.ps1')
            fs.writeFileSync(ps1Filename, `& escript.exe ${oldPath} \${args}`)

            const cmdFilename = path.join(bindir, 'rebar3.cmd')
            fs.writeFileSync(
              cmdFilename,
              `@echo off\r\nescript.exe ${oldPath} %*`,
            )
          },
          reportVersion: () => {
            const cmd = 'rebar3.cmd'
            const args = ['version']

            return [cmd, args]
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

  core.debug('Performing post extract operations...')
  await platformOpts.postExtract(cachePath)

  core.debug(`Adding ${cachePath}'s bin to system path`)
  core.addPath(path.join(cachePath, 'bin'))

  const installDirForVarName = `INSTALL_DIR_FOR_${toolName}`.toUpperCase()
  core.debug(`Exporting ${installDirForVarName} as ${cachePath}`)
  core.exportVariable(installDirForVarName, cachePath)

  core.info(`Installed ${installOpts.tool} version`)
  const [cmd, args] = platformOpts.reportVersion()
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
