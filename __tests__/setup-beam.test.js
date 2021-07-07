simulateInput('otp-version', '23.2')
simulateInput('elixir-version', '1.11')
simulateInput('rebar3-version', '3.14')
simulateInput('install-rebar', 'true')
simulateInput('install-hex', 'true')

const assert = require('assert')
const setupBeam = require('../src/setup-beam')
const installer = require('../src/installer')

async function all() {
  await testFailInstallOTP()
  await testFailInstallElixir()
  await testFailInstallRebar3()

  await testOTPVersions()
  await testElixirVersions()
  await testRebar3Versions()

  await testGetVersionFromSpec()
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

  if (process.platform === 'linux') {
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
  }

  if (process.platform === 'win32') {
    spec = '24.0.1'
    osVersion = 'windows-latest'
    expected = '24.0.1'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '23.2.x'
    osVersion = 'windows-2016'
    expected = '23.2.7.4'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)

    spec = '23.0'
    osVersion = 'windows-2019'
    expected = '23.0.4'
    got = await setupBeam.getOTPVersion(spec, osVersion)
    assert.deepStrictEqual(got, expected)
  }
}

async function testElixirVersions() {
  let got
  let expected
  let spec
  let otpVersion

  spec = '1.1.x'
  otpVersion = 'OTP-23'
  expected = 'v1.1.1'
  got = await setupBeam.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)

  spec = '1.10.4'
  otpVersion = 'OTP-23'
  expected = 'v1.10.4-otp-23'
  got = await setupBeam.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)

  spec = '1.11.0-rc.0'
  otpVersion = 'OTP-23'
  expected = 'v1.11.0-rc.0-otp-23'
  got = await setupBeam.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)
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
}

function simulateInput(key, value) {
  process.env[`INPUT_${key.replace(/ /g, '_').toUpperCase()}`] = value
}

all()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
