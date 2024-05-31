simulateInput('otp-version', '25.1.2')
simulateInput('elixir-version', '1.14.2')
simulateInput('rebar3-version', '3.20')
simulateInput('install-rebar', 'true')
simulateInput('install-hex', 'true')
simulateInput('github-token', process.env.GITHUB_TOKEN)
simulateInput('hexpm-mirrors', 'https://builds.hex.pm', { multiline: true })

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const core = require('@actions/core')
const setupBeam = require('../src/setup-beam')
const { problemMatcher } = require('../matchers/elixir-matchers.json')

async function all() {
  await testFailInstallOTP()
  await testFailInstallElixir()
  await testFailInstallGleam()
  await testFailInstallRebar3()

  await testOTPVersions()
  await testLinuxARM64OTPVersions()
  await testLinuxAMD64OTPVersions()
  await testElixirVersions()
  await testGleamVersions()
  await testRebar3Versions()

  await testGetVersionFromSpec()

  await testParseVersionFile()

  await testElixirMixCompileError()
  await testElixirMixCompileWarning()
  await testElixirMixTestFailure()
  await testElixirCredoOutputDefault()
}

async function testFailInstallOTP() {
  const otpOSVersion = 'ubuntu-08.04'
  const otpVersion = 'OTP-23.2'
  assert.rejects(
    async () => {
      await setupBeam.install('otp', {
        hexMirror: 'https://builds.hex.pm',
        otpOSVersion,
        otpVersion,
      })
    },
    (err) => {
      assert.ok(err instanceof Error)
      return true
    },
    `Installing Erlang/OTP ${otpVersion} over ${otpOSVersion} is supposed to fail`,
  )
}

async function testFailInstallElixir() {
  let exVersion

  exVersion = '0.11'
  assert.rejects(
    async () => {
      await setupBeam.install('elixir', {
        hexMirror: 'https://builds.hex.pm',
        exVersion,
      })
    },
    (err) => {
      assert.ok(err instanceof Error)
      return true
    },
    `Installing Elixir ${exVersion} is supposed to fail`,
  )

  exVersion = 'v1.0.0-otp-17'
  assert.rejects(
    async () => {
      await setupBeam.install('elixir', {
        hexMirror: 'https://builds.hex.pm',
        exVersion,
      })
    },
    (err) => {
      assert.ok(err instanceof Error)
      return true
    },
    `Installing Elixir ${exVersion} is supposed to fail`,
  )
}

async function testFailInstallGleam() {
  const gleamVersion = '0.1.3'
  assert.rejects(
    async () => {
      await setupBeam.install('gleam', { gleamVersion })
    },
    (err) => {
      assert.ok(err instanceof Error)
      return true
    },
    `Installing Gleam ${gleamVersion} is supposed to fail`,
  )
}

async function testFailInstallRebar3() {
  const r3Version = '0.14.4'
  assert.rejects(
    async () => {
      await setupBeam.install('rebar3', { r3Version })
    },
    (err) => {
      assert.ok(err instanceof Error)
      return true
    },
    `Installing rebar3 ${r3Version} is supposed to fail`,
  )
}

async function testOTPVersions() {
  let got
  let expected
  let spec
  let osVersion
  let before
  const hexMirrors = simulateInput(
    'hexpm-mirrors',
    'https://repo.hex.pm, https://cdn.jsdelivr.net/hex',
    { multiline: true },
  )

  if (process.platform === 'linux') {
    before = simulateInput('version-type', 'strict')
    spec = '26'
    osVersion = 'ubuntu-24.04'
    expected = 'maint-26'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    simulateInput('version-type', before)
    spec = '27.0'
    osVersion = 'ubuntu-24.04'
    expected = 'OTP-27.0'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    simulateInput('version-type', before)
    spec = '25.3.2.1'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-25.3.2.1'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)
    simulateInput('version-type', before)

    spec = '19.3.x'
    osVersion = 'ubuntu-16.04'
    expected = 'OTP-19.3.6.13'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '^19.3.6'
    osVersion = 'ubuntu-16.04'
    expected = 'OTP-19.3.6.13'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '^19.3'
    osVersion = 'ubuntu-18.04'
    expected = 'OTP-19.3.6.13'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '20'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.3.8.26'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '20.3.8.26'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.3.8.26'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = '20.x'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.3.8.26'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '20.0'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.0.5'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '20.0.x'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.0.5'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = 'maint'
    osVersion = 'ubuntu-22.04'
    expected = 'maint'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = 'master'
    osVersion = 'ubuntu-22.04'
    expected = 'master'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)
  }

  if (process.platform === 'win32') {
    spec = '24.0.1'
    osVersion = 'windows-latest'
    expected = '24.0.1'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '23.2.x'
    osVersion = 'windows-2016'
    expected = '23.2.7'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '23.0'
    osVersion = 'windows-2019'
    expected = '23.0.4'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)
  }

  simulateInput('hexpm-mirrors', hexMirrors, { multiline: true })
}

async function testLinuxARM64OTPVersions() {
  let got
  let expected
  let spec
  let osVersion
  let before
  const hexMirrors = simulateInput(
    'hexpm-mirrors',
    'https://repo.hex.pm, https://cdn.jsdelivr.net/hex',
    { multiline: true },
  )

  const arm64Options = setupBeam.githubARMRunnerArchs()
  process.env.RUNNER_ARCH =
    arm64Options[Math.floor(Math.random() * arm64Options.length)]

  if (process.platform === 'linux') {
    before = simulateInput('version-type', 'strict')
    spec = '26'
    osVersion = 'ubuntu-24.04'
    expected = 'maint-26'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    simulateInput('version-type', before)
    spec = '27.0'
    osVersion = 'ubuntu-24.04'
    expected = 'OTP-27.0'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    simulateInput('version-type', before)
    spec = '25.3.2.1'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-25.3.2.1'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)
    simulateInput('version-type', before)

    spec = '20'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.3.8.26'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '20.3.8.26'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.3.8.26'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = '20.x'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.3.8.26'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '20.0'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.0.5'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '20.0.x'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.0.5'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = 'maint'
    osVersion = 'ubuntu-22.04'
    expected = 'maint'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = 'master'
    osVersion = 'ubuntu-22.04'
    expected = 'master'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)
  }

  simulateInput('hexpm-mirrors', hexMirrors, { multiline: true })
}

async function testLinuxAMD64OTPVersions() {
  let got
  let expected
  let spec
  let osVersion
  let before
  const hexMirrors = simulateInput(
    'hexpm-mirrors',
    'https://repo.hex.pm, https://cdn.jsdelivr.net/hex',
    { multiline: true },
  )

  const amd64Options = setupBeam.githubAMDRunnerArchs()
  process.env.RUNNER_ARCH =
    amd64Options[Math.floor(Math.random() * amd64Options.length)]

  if (process.platform === 'linux') {
    before = simulateInput('version-type', 'strict')
    spec = '26'
    osVersion = 'ubuntu-24.04'
    expected = 'maint-26'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    simulateInput('version-type', before)
    spec = '27.0'
    osVersion = 'ubuntu-24.04'
    expected = 'OTP-27.0'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    simulateInput('version-type', before)
    spec = '25.3.2.1'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-25.3.2.1'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    simulateInput('version-type', before)
    spec = '19.3.x'
    osVersion = 'ubuntu-16.04'
    expected = 'OTP-19.3.6.13'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '^19.3.6'
    osVersion = 'ubuntu-16.04'
    expected = 'OTP-19.3.6.13'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '^19.3'
    osVersion = 'ubuntu-18.04'
    expected = 'OTP-19.3.6.13'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '20'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.3.8.26'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '20.3.8.26'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.3.8.26'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = '20.x'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.3.8.26'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '20.0'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.0.5'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '20.0.x'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.0.5'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = 'maint'
    osVersion = 'ubuntu-22.04'
    expected = 'maint'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = 'master'
    osVersion = 'ubuntu-22.04'
    expected = 'master'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)
  }

  simulateInput('hexpm-mirrors', hexMirrors, { multiline: true })
}

async function testElixirVersions() {
  let got
  let expected
  let spec
  let otpVersion
  let before
  const hexMirrors = simulateInput('hexpm-mirrors', 'https://repo.hex.pm', {
    multiline: true,
  })

  spec = '1.1.x'
  otpVersion = 'OTP-17'
  expected = 'v1.1.1-otp-17'
  got = await setupBeam.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)

  spec = '1.10.4'
  otpVersion = 'OTP-23'
  expected = 'v1.10.4-otp-23'
  got = await setupBeam.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)

  spec = '1.12.1'
  otpVersion = 'OTP-24.0.2'
  expected = 'v1.12.1-otp-24'
  got = await setupBeam.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)

  before = simulateInput('version-type', 'strict')
  spec = '1.14.0'
  otpVersion = 'main'
  expected = 'v1.14.0'
  got = await setupBeam.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)

  before = simulateInput('version-type', 'strict')
  spec = 'v1.11.0-rc.0'
  otpVersion = 'OTP-23'
  expected = 'v1.11.0-rc.0-otp-23'
  got = await setupBeam.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)

  before = simulateInput('version-type', 'strict')
  spec = 'v1.11.0-rc.0-otp-23'
  otpVersion = 'OTP-23'
  expected = 'v1.11.0-rc.0-otp-23'
  got = await setupBeam.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)

  before = simulateInput('version-type', 'strict')
  spec = 'v1.11.0'
  otpVersion = '22.3.4.2'
  expected = 'v1.11.0-otp-22'
  got = await setupBeam.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)

  before = simulateInput('version-type', 'strict')
  spec = 'main'
  otpVersion = '23.1'
  expected = 'main-otp-23'
  got = await setupBeam.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)

  simulateInput('hexpm-mirrors', hexMirrors, { multiline: true })
}

async function testGleamVersions() {
  let got
  let expected
  let spec
  let otpVersion

  spec = 'v0.3.0'
  otpVersion = 'OTP-23'
  expected = 'v0.3.0'
  got = await setupBeam.getGleamVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)

  spec = '0.13.2'
  otpVersion = 'OTP-24'
  expected = 'v0.13.2'
  got = await setupBeam.getGleamVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)

  const before = simulateInput('version-type', 'strict')
  spec = 'v0.14.0-rc2'
  otpVersion = 'OTP-22'
  expected = 'v0.14.0-rc2'
  got = await setupBeam.getGleamVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)
}

async function testRebar3Versions() {
  let got
  let expected
  let spec

  spec = '3.10.x'
  expected = '3.10.0'
  got = await setupBeam.getRebar3Version(spec)
  assert.deepStrictEqual(got, expected)

  spec = '3.11'
  expected = '3.11.1'
  got = await setupBeam.getRebar3Version(spec)
  assert.deepStrictEqual(got, expected)

  spec = '3.10'
  expected = '3.10.0'
  got = await setupBeam.getRebar3Version(spec)
  assert.deepStrictEqual(got, expected)
}

async function testGetVersionFromSpec() {
  let got
  let expected
  let spec
  let before
  const versions0 = [
    '3.2.30.5',
    '3.2.3.5',
    '1',
    '2',
    '3.2.3.4.1',
    '1.0.9',
    '3.2.3.40.1',
    '1.0.2',
    '2.0',
    '2.10',
    '2.9',
    '1.0',
    '3.2.3.4.2',
    '1.1.0',
    '3.4.5.4',
    '3.4.5.3',
    '3.4.5.4.1',
    '24.0-rc3',
    '24.0-rc2',
    '24.0',
    '23.3.4',
    '23.3.3',
    '22.3.4.9.1',
    '22.3.4.12.1',
    '22.3.4.10.1',
    '22.3.4.2',
    'main',
    'v11.11.0-rc.0-otp-23',
    '22.3.4.2.1.0',
    '12.1.2.2',
    '12.1.2.4',
    '12.1.2.0',
    '12.1.2.3',
    '12.1.2.3.0',
  ]
  const versions = {}
  versions0.forEach((version) => {
    versions[version] = version
  })

  spec = '1'
  expected = '1.1.0'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '1.0'
  expected = '1.0.9'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  before = simulateInput('version-type', 'strict')
  spec = '1'
  expected = '1'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)

  before = simulateInput('version-type', 'strict')
  spec = '1.0'
  expected = '1.0'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)

  spec = '2'
  expected = '2.10'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '3'
  expected = '3.4.5.4.1'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '3.2'
  expected = '3.2.30.5'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '>20'
  expected = '24.0'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '24.0'
  expected = '24.0'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  before = simulateInput('version-type', 'strict')
  spec = '24.0-rc3'
  expected = '24.0-rc3'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)

  spec = '24.0-rc2'
  expected = '24.0-rc2'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '22.3'
  expected = '22.3.4.12.1'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '23.3.3'
  expected = '23.3.3'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '24'
  expected = '24.0'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '23.3'
  expected = '23.3.4'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  before = simulateInput('version-type', 'strict')
  spec = 'main'
  expected = 'main'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)

  before = simulateInput('version-type', 'strict')
  spec = '22.3.4.2'
  expected = '22.3.4.2'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)

  spec = '22.3.4.2'
  expected = '22.3.4.2.1.0'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '22.3.4.2.1'
  expected = '22.3.4.2.1.0'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '22.3.4.2.1.0'
  expected = '22.3.4.2.1.0'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '12.1.2.3'
  expected = '12.1.2.3.0'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '22.3.4.2.1.0.1'
  expected = null
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  before = simulateInput('version-type', 'strict')
  spec = '22.3.4.3'
  expected = null
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', before)
}

async function testParseVersionFile() {
  const otpVersion = unsimulateInput('otp-version')
  const elixirVersion = unsimulateInput('elixir-version')
  const gleamVersion = unsimulateInput('gleam-version')
  const rebar3Version = unsimulateInput('rebar3-version')

  const erlang = '25.1.1'
  const elixir = '1.14.1'
  const gleam = '0.23.0'
  const rebar3 = '3.16.0'
  const toolVersions = `# a comment
erlang   ref:v${erlang}# comment, no space, and ref:v
elixir ref:${elixir}  # comment, with space and ref:
 not-gleam 0.23 # not picked up
gleam ${gleam} 
rebar ${rebar3}`
  const filename = 'test/.tool-versions'
  fs.writeFileSync(filename, toolVersions)
  process.env.GITHUB_WORKSPACE = ''
  const appVersions = setupBeam.parseVersionFile(filename)
  assert.strictEqual(appVersions.get('erlang'), erlang)
  assert.strictEqual(appVersions.get('elixir'), elixir)

  const absoluteFilename = path.join(os.tmpdir(), '.tool-versions')
  fs.writeFileSync(absoluteFilename, toolVersions)

  process.env.GITHUB_WORKSPACE = process.cwd()
  const absoluteAppVersions = setupBeam.parseVersionFile(absoluteFilename)
  assert.strictEqual(absoluteAppVersions.get('erlang'), erlang)
  assert.strictEqual(absoluteAppVersions.get('elixir'), elixir)

  assert.ok(async () => {
    await setupBeam.install('otp', { toolVersion: erlang })
  })
  assert.ok(async () => {
    await setupBeam.install('elixir', { toolVersion: elixir })
  })
  assert.ok(async () => {
    await setupBeam.install('gleam', { toolVersion: gleam })
  })
  assert.ok(async () => {
    await setupBeam.install('rebar3', { toolVersion: rebar3 })
  })

  simulateInput('otp-version', otpVersion)
  simulateInput('elixir-version', elixirVersion)
  simulateInput('gleam-version', gleamVersion)
  simulateInput('rebar3-version', rebar3Version)
}

async function testElixirMixCompileError() {
  const [matcher] = problemMatcher.find(
    ({ owner }) => owner === 'elixir-mixCompileError',
  ).pattern

  const output = '** (CompileError) lib/test.ex:16: undefined function err/0'
  const [message, , file, line] = output.match(matcher.regexp)
  assert.equal(file, 'lib/test.ex')
  assert.equal(line, '16')
  assert.equal(message, output)
}

async function testElixirMixCompileWarning() {
  const [messagePattern, filePattern] = problemMatcher.find(
    ({ owner }) => owner === 'elixir-mixCompileWarning',
  ).pattern

  const firstOutput =
    'warning: variable "err" does not exist and is being expanded to "err()"'
  const secondOutput = '  lib/test.ex:16: Test.hello/0'

  const [, message] = firstOutput.match(messagePattern.regexp)
  assert.equal(
    message,
    'variable "err" does not exist and is being expanded to "err()"',
  )

  const [, file, line] = secondOutput.match(filePattern.regexp)
  assert.equal(file, 'lib/test.ex')
  assert.equal(line, '16')
}

async function testElixirMixTestFailure() {
  const [messagePattern, filePattern] = problemMatcher.find(
    ({ owner }) => owner === 'elixir-mixTestFailure',
  ).pattern

  const firstOutput = '1) test throws (TestTest)'
  const secondOutput = '  test/test_test.exs:9'

  const [, message] = firstOutput.match(messagePattern.regexp)
  assert.equal(message, 'test throws (TestTest)')

  const [, file, line] = secondOutput.match(filePattern.regexp)
  assert.equal(file, 'test/test_test.exs')
  assert.equal(line, '9')
}

async function testElixirCredoOutputDefault() {
  const [messagePattern, filePattern] = problemMatcher.find(
    ({ owner }) => owner === 'elixir-credoOutputDefault',
  ).pattern

  const firstOutput = '┃ [F] → Function is too complex (CC is 29, max is 9).'
  const secondOutput = '┃       lib/test.ex:15:7 #(Test.hello)'

  const [, message] = firstOutput.match(messagePattern.regexp)
  assert.equal(message, 'Function is too complex (CC is 29, max is 9).')

  const [, file, line, column] = secondOutput.match(filePattern.regexp)
  assert.equal(file, 'lib/test.ex')
  assert.equal(line, '15')
  assert.equal(column, '7')
}

function unsimulateInput(key) {
  return simulateInput(key, '')
}

function simulateInput(key, value0, opts) {
  const { multiline } = opts || {}
  const before = process.env[input(key, opts)]
  let value = value0
  if (multiline) {
    if (value.indexOf(', ') !== -1) {
      value = value0.replace(/, /g, '\n')
    } else {
      value = value0.replace(/\n/g, ', ')
    }
  }
  process.env[input(key)] = value
  return before
}

function input(key) {
  return `INPUT_${key.replace(/ /g, '_').toUpperCase()}`
}

all()
  .then(() => process.exit(0))
  .catch((err) => {
    core.error(err)
    process.exit(1)
  })
