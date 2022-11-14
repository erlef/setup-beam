simulateInput('otp-version', '25.1.2')
simulateInput('elixir-version', '1.14.2')
simulateInput('rebar3-version', '3.20')
simulateInput('install-rebar', 'true')
simulateInput('install-hex', 'true')
simulateInput('github-token', process.env.GITHUB_TOKEN)

const assert = require('assert')
const fs = require('fs')
const setupBeam = require('../src/setup-beam')
const installer = require('../src/installer')

async function all() {
  await testFailInstallOTP()
  await testFailInstallElixir()
  await testFailInstallGleam()
  await testFailInstallRebar3()

  await testOTPVersions()
  await testElixirVersions()
  await testGleamVersions()
  await testRebar3Versions()

  await testGetVersionFromSpec()

  await testParseVersionFile()
}

async function testFailInstallOTP() {
  const otpOSVersion = 'ubuntu-08.04'
  const otpVersion = 'OTP-23.2'
  assert.rejects(
    async () => {
      await installer.installOTP(otpOSVersion, otpVersion)
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
      await installer.installElixir(exVersion)
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
      await installer.installElixir(exVersion)
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
      await installer.installGleam(gleamVersion)
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
      await installer.installRebar3(r3Version)
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
  const hexMirrors = ['https://repo.hex.pm', 'https://cdn.jsdelivr.net/hex']

  if (process.platform === 'linux') {
    spec = '19.3.x'
    osVersion = 'ubuntu-16.04'
    expected = 'OTP-19.3.6.13'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = '^19.3.6'
    osVersion = 'ubuntu-16.04'
    expected = 'OTP-19.3.6.13'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = '^19.3'
    osVersion = 'ubuntu-18.04'
    expected = 'OTP-19.3.6.13'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = '20'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.3.8.26'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = '20.x'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.3.8.26'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = '20.0'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.0.5'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = '20.0.x'
    osVersion = 'ubuntu-20.04'
    expected = 'OTP-20.0.5'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)
  }

  if (process.platform === 'win32') {
    spec = '24.0.1'
    osVersion = 'windows-latest'
    expected = '24.0.1'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = '23.2.x'
    osVersion = 'windows-2016'
    expected = '23.2.7'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)

    spec = '23.0'
    osVersion = 'windows-2019'
    expected = '23.0.4'
    got = await setupBeam.getOTPVersion(spec, osVersion, hexMirrors)
    assert.deepStrictEqual(got, expected)
  }
}

async function testElixirVersions() {
  let got
  let expected
  let spec
  let otpVersion
  const hexMirrors = ['https://repo.hex.pm']

  spec = '1.1.x'
  otpVersion = 'OTP-17'
  expected = 'v1.1.1-otp-17'
  got = await setupBeam.getElixirVersion(spec, otpVersion, hexMirrors)
  assert.deepStrictEqual(got, expected)

  spec = '1.10.4'
  otpVersion = 'OTP-23'
  expected = 'v1.10.4-otp-23'
  got = await setupBeam.getElixirVersion(spec, otpVersion, hexMirrors)
  assert.deepStrictEqual(got, expected)

  spec = '1.12.1'
  otpVersion = 'OTP-24.0.2'
  expected = 'v1.12.1-otp-24'
  got = await setupBeam.getElixirVersion(spec, otpVersion, hexMirrors)
  assert.deepStrictEqual(got, expected)

  simulateInput('version-type', 'strict')
  spec = '1.14.0'
  otpVersion = 'master'
  expected = 'v1.14.0'
  got = await setupBeam.getElixirVersion(spec, otpVersion, hexMirrors)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', 'loose')

  simulateInput('version-type', 'strict')
  spec = 'v1.11.0-rc.0'
  otpVersion = 'OTP-23'
  expected = 'v1.11.0-rc.0-otp-23'
  got = await setupBeam.getElixirVersion(spec, otpVersion, hexMirrors)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', 'loose')

  simulateInput('version-type', 'strict')
  spec = 'v1.11.0'
  otpVersion = '22.3.4.2'
  expected = 'v1.11.0-otp-22'
  got = await setupBeam.getElixirVersion(spec, otpVersion, hexMirrors)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', 'loose')

  simulateInput('version-type', 'strict')
  spec = 'main'
  otpVersion = '23.1'
  expected = 'main-otp-23'
  got = await setupBeam.getElixirVersion(spec, otpVersion, hexMirrors)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', 'loose')
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

  simulateInput('version-type', 'strict')
  spec = 'v0.14.0-rc2'
  otpVersion = 'OTP-22'
  expected = 'v0.14.0-rc2'
  got = await setupBeam.getGleamVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', 'loose')
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
  const versions = [
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
    'master',
    'v11.11.0-rc.0-otp-23',
    '22.3.4.2',
  ]

  spec = '1'
  expected = '1.1.0'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  spec = '1.0'
  expected = '1.0.9'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  simulateInput('version-type', 'strict')
  spec = '1'
  expected = '1'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', 'loose')

  simulateInput('version-type', 'strict')
  spec = '1.0'
  expected = '1.0'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', 'loose')

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

  simulateInput('version-type', 'strict')
  spec = '24.0-rc3'
  expected = '24.0-rc3'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', 'loose')

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

  simulateInput('version-type', 'strict')
  spec = 'master'
  expected = 'master'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', 'loose')

  spec = 'master'
  expected = 'master'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)

  simulateInput('version-type', 'strict')
  spec = '22.3.4.2'
  expected = '22.3.4.2'
  got = setupBeam.getVersionFromSpec(spec, versions)
  assert.deepStrictEqual(got, expected)
  simulateInput('version-type', 'loose')
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
erlang   ${erlang}# comment, no space
elixir ${elixir}  # comment, with space
 not-gleam 0.23 # not picked up
gleam ${gleam} 
rebar ${rebar3}`
  const filename = '__tests__/.tool-versions'
  fs.writeFileSync(filename, toolVersions)
  process.env.GITHUB_WORKSPACE = ''
  const appVersions = setupBeam.parseVersionFile(filename)
  assert.strictEqual(appVersions.get('erlang'), erlang)
  assert.strictEqual(appVersions.get('elixir'), elixir)

  assert.ok(async () => {
    await installer.installOTP(erlang)
  })
  assert.ok(async () => {
    await installer.installElixir(elixir)
  })
  assert.ok(async () => {
    await installer.installGleam(gleam)
  })
  assert.ok(async () => {
    await installer.installRebar3(rebar3)
  })

  simulateInput('otp-version', otpVersion)
  simulateInput('elixir-version', elixirVersion)
  simulateInput('gleam-version', gleamVersion)
  simulateInput('rebar3-version', rebar3Version)
}

function unsimulateInput(key) {
  const before = process.env[input(key)]
  simulateInput(key, '')
  return before
}

function simulateInput(key, value) {
  process.env[input(key)] = value
}

function input(key) {
  return `INPUT_${key.replace(/ /g, '_').toUpperCase()}`
}

all()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
