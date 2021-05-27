simulateInput('otp-version', '23.2')
simulateInput('elixir-version', '1.11')
simulateInput('rebar3-version', '3.14')
simulateInput('install-rebar', 'true')
simulateInput('install-hex', 'true')

const assert = require('assert')
const setupElixir = require('../src/setup-beam')
const installer = require('../src/installer')

async function all() {
  await testFailInstallOTP()
  await testFailInstallElixir()
  await testFailInstallRebar3()

  await testOTPVersions()
  await testElixirVersions()
  await testRebar3Versions()
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

  spec = '19.3.x'
  osVersion = 'ubuntu-16.04'
  expected = 'OTP-19.3.6'
  got = await setupElixir.getOTPVersion(spec, osVersion)
  assert.deepStrictEqual(got, expected)

  spec = '^19.3.6'
  osVersion = 'ubuntu-16.04'
  expected = 'OTP-19.3.6'
  got = await setupElixir.getOTPVersion(spec, osVersion)
  assert.deepStrictEqual(got, expected)

  spec = '^19.3'
  osVersion = 'ubuntu-18.04'
  expected = 'OTP-19.3.6'
  got = await setupElixir.getOTPVersion(spec, osVersion)
  assert.deepStrictEqual(got, expected)

  spec = '20'
  osVersion = 'ubuntu-20.04'
  expected = 'OTP-20.3.8'
  got = await setupElixir.getOTPVersion(spec, osVersion)
  assert.deepStrictEqual(got, expected)

  spec = '20.x'
  osVersion = 'ubuntu-20.04'
  expected = 'OTP-20.3.8'
  got = await setupElixir.getOTPVersion(spec, osVersion)
  assert.deepStrictEqual(got, expected)

  spec = '20.0'
  osVersion = 'ubuntu-20.04'
  expected = 'OTP-20.0.5'
  got = await setupElixir.getOTPVersion(spec, osVersion)
  assert.deepStrictEqual(got, expected)

  spec = '20.0.x'
  osVersion = 'ubuntu-20.04'
  expected = 'OTP-20.0.5'
  got = await setupElixir.getOTPVersion(spec, osVersion)
  assert.deepStrictEqual(got, expected)
}

async function testElixirVersions() {
  let got
  let expected
  let spec
  let otpVersion

  spec = '1.1.x'
  otpVersion = 'OTP-23'
  expected = 'v1.1.1'
  got = await setupElixir.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)

  spec = '1.10.4'
  otpVersion = 'OTP-23'
  expected = 'v1.10.4-otp-23'
  got = await setupElixir.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)

  spec = '1.11.0-rc.0'
  otpVersion = 'OTP-23'
  expected = 'v1.11.0-rc.0-otp-23'
  got = await setupElixir.getElixirVersion(spec, otpVersion)
  assert.deepStrictEqual(got, expected)
}

async function testRebar3Versions() {
  let got
  let expected
  let spec

  spec = '3.10.x'
  expected = '3.10.0'
  got = await setupElixir.getRebar3Version(spec)
  assert.deepStrictEqual(got, expected)

  spec = '3.10.0'
  expected = '3.10.0'
  got = await setupElixir.getRebar3Version(spec)
  assert.deepStrictEqual(got, expected)

  spec = '3.10'
  expected = '3.10.0'
  got = await setupElixir.getRebar3Version(spec)
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
