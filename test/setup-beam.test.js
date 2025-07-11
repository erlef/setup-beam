process.env.NODE_ENV = 'test'

simulateInput('otp-version', '25.1.2')
simulateInput('otp-architecture', '64')
simulateInput('elixir-version', '1.14.2')
simulateInput('rebar3-version', '3.20')
simulateInput('install-rebar', 'true')
simulateInput('install-hex', 'true')
simulateInput('github-token', process.env.GITHUB_TOKEN)
simulateInput('hexpm-mirrors', 'https://builds.hex.pm', { multiline: true })

const assert = require('assert')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const setupBeam = require('../src/setup-beam')
const { problemMatcher } = require('../matchers/elixir-matchers.json')
const { describe, it } = require('node:test')
const csv = require('csv-parse/sync')

const matrix = {
  otp: {
    'ubuntu-18.04': parseBuild('test/otp/ubuntu-18.04/builds.txt'),
    'ubuntu-20.04': parseBuild('test/otp/ubuntu-20.04/builds.txt'),
    'ubuntu-22.04': parseBuild('test/otp/ubuntu-22.04/builds.txt'),
    'ubuntu-24.04': parseBuild('test/otp/ubuntu-24.04/builds.txt'),
    windows: parseReleases('test/otp/releases.json'),
    'macos-aarch64': parseCsv('test/otp/macos/aarch64-apple-darwin.csv'),
    'macos-x86_64': parseCsv('test/otp/macos/x86_64-apple-darwin.csv'),
  },
  elixir: parseBuild('test/elixir/builds.txt'),
  gleam: parseReleases('test/gleam/releases.json'),
  rebar3: parseReleases('test/rebar3/releases.json'),
}

function parseBuild(version) {
  let versions = {}
  fs.readFileSync(path.join(process.cwd(), version), 'utf8')
    .trim()
    .split('\n')
    .forEach((line) => (versions[line.split(' ')[0]] = line.split(' ')[0]))
  return versions
}

function parseReleases(version) {
  let versions = {}
  let data = fs.readFileSync(path.join(process.cwd(), version), 'utf8')
  let json = JSON.parse(data)
  if (version.includes('otp')) {
    json
      .map((x) => x.assets)
      .flat()
      .filter((x) => x.name.match(/^otp_win64_.*.exe$/))
      .forEach((x) => {
        let v = x.name.match(/^otp_win64_(.*).exe$/)[1]
        versions[v] = v
      })
    return versions
  } else {
    json.map((x) => (versions[x.tag_name] = x.tag_name))
    return versions
  }
}

function parseCsv(file) {
  let versions = {}
  let fileH = fs.readFileSync(file, 'utf8')
  csv
    .parse(fileH, { columns: true })
    .forEach((line) => (versions[line.ref_name] = line.ref_name))
  return versions
}

describe('OTP install', () => {
  it('fails for invalid OS version', async () => {
    const otpOSVersion = 'ubuntu-08.04'
    const otpVersion = 'OTP-23.2'

    await assert.rejects(
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
  })
})

describe('Elixir install', () => {
  it('fails for version 0.11 without OTP', async () => {
    const exVersion = '0.11'
    await assert.rejects(
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
  })

  it('fails for version 1.0.0 on OTP 17 (without OTP)', async () => {
    const exVersion = 'v1.0.0-otp-17'
    await assert.rejects(
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
  })
})

describe('Gleam install', () => {
  it('fails for unknown OTP', async () => {
    const gleamVersion = '0.1.3'
    await assert.rejects(
      async () => {
        await setupBeam.install('gleam', { gleamVersion })
      },
      (err) => {
        assert.ok(err instanceof Error)
        return true
      },
      `Installing Gleam ${gleamVersion} is supposed to fail`,
    )
  })
})

describe('rebar3 install', () => {
  it('fails for unknown OTP', async () => {
    const r3Version = '0.14.4'
    await assert.rejects(
      async () => {
        await setupBeam.install('rebar3', { r3Version })
      },
      (err) => {
        assert.ok(err instanceof Error)
        return true
      },
      `Installing rebar3 ${r3Version} is supposed to fail`,
    )
  })
})

describe('.getOTPVersion(_) - Erlang', () => {
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
  const previousRunnerArch = process.env.RUNNER_ARCH

  if (process.platform === 'linux') {
    process.env.RUNNER_ARCH = 'X64'

    it('is Ok for known linux version', async () => {
      before = simulateInput('version-type', 'strict')
      spec = '27.0'
      osVersion = 'ubuntu-24.04'
      expected = 'OTP-27.0'
      got = await setupBeam.getOTPVersion(spec, osVersion)
      assert.deepStrictEqual(got, expected)
      simulateInput('version-type', before)

      before = simulateInput('version-type', 'strict')
      spec = '25.3.2.1'
      osVersion = 'ubuntu-20.04'
      expected = 'OTP-25.3.2.1'
      got = await setupBeam.getOTPVersion(spec, osVersion)
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

      spec = 'maint'
      osVersion = 'ubuntu-22.04'
      expected = 'maint'
      got = await setupBeam.getOTPVersion(spec, osVersion)
      assert.deepStrictEqual(got, expected)

      spec = 'master'
      osVersion = 'ubuntu-22.04'
      expected = 'master'
      got = await setupBeam.getOTPVersion(spec, osVersion)
      assert.deepStrictEqual(got, expected)
    })
  }

  if (process.platform === 'win32') {
    it('is Ok for known win32 version', async () => {
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

      // Check we get the same results for 32-bit OTP
      before = simulateInput('otp-architecture', '32')

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

      simulateInput('otp-architecture', before)
    })
  }

  if (process.platform === 'linux') {
    it('is main-... only if strict/maint-... is used as input', async () => {
      const arm64Options = setupBeam.githubARMRunnerArchs()
      process.env.RUNNER_ARCH =
        arm64Options[Math.floor(Math.random() * arm64Options.length)]

      before = simulateInput('version-type', 'strict')
      await assert.rejects(
        async () => {
          await setupBeam.getOTPVersion('27', 'ubuntu-24.04')
        },
        (err) => {
          assert.ok(err instanceof Error)
          return true
        },
        `Fetching strict OTP version maint-<v> with input <v> is supposed to fail`,
      )
      simulateInput('version-type', before)

      before = simulateInput('version-type', 'strict')
      assert.strictEqual(
        await setupBeam.getOTPVersion('maint-27', 'ubuntu-24.04'),
        'maint-27',
      )
      simulateInput('version-type', before)

      before = simulateInput('version-type', 'loose')
      assert.strictEqual(
        await setupBeam.getOTPVersion('maint-27', 'ubuntu-24.04'),
        'maint-27',
      )
      simulateInput('version-type', before)

      process.env.RUNNER_ARCH = previousRunnerArch
    })

    it('is Ok for known linux ARM64 version', async () => {
      const arm64Options = setupBeam.githubARMRunnerArchs()
      process.env.RUNNER_ARCH =
        arm64Options[Math.floor(Math.random() * arm64Options.length)]

      before = simulateInput('version-type', 'strict')
      spec = '27.0'
      osVersion = 'ubuntu-24.04'
      expected = 'OTP-27.0'
      got = await setupBeam.getOTPVersion(spec, osVersion)
      assert.deepStrictEqual(got, expected)
      simulateInput('version-type', before)

      before = simulateInput('version-type', 'strict')
      spec = '25.3.2.1'
      osVersion = 'ubuntu-20.04'
      expected = 'OTP-25.3.2.1'
      got = await setupBeam.getOTPVersion(spec, osVersion)
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

      spec = 'maint'
      osVersion = 'ubuntu-22.04'
      expected = 'maint'
      got = await setupBeam.getOTPVersion(spec, osVersion)
      assert.deepStrictEqual(got, expected)

      spec = 'master'
      osVersion = 'ubuntu-22.04'
      expected = 'master'
      got = await setupBeam.getOTPVersion(spec, osVersion)
      assert.deepStrictEqual(got, expected)
    })

    it('is Ok for known linux AMD64 version', async () => {
      const amd64Options = setupBeam.githubAMDRunnerArchs()
      process.env.RUNNER_ARCH =
        amd64Options[Math.floor(Math.random() * amd64Options.length)]

      before = simulateInput('version-type', 'strict')
      spec = '27.0'
      osVersion = 'ubuntu-24.04'
      expected = 'OTP-27.0'
      got = await setupBeam.getOTPVersion(spec, osVersion)
      assert.deepStrictEqual(got, expected)
      simulateInput('version-type', before)

      before = simulateInput('version-type', 'strict')
      spec = '25.3.2.1'
      osVersion = 'ubuntu-20.04'
      expected = 'OTP-25.3.2.1'
      got = await setupBeam.getOTPVersion(spec, osVersion)
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

      spec = 'maint'
      osVersion = 'ubuntu-22.04'
      expected = 'maint'
      got = await setupBeam.getOTPVersion(spec, osVersion)
      assert.deepStrictEqual(got, expected)

      spec = 'master'
      osVersion = 'ubuntu-22.04'
      expected = 'master'
      got = await setupBeam.getOTPVersion(spec, osVersion)
      assert.deepStrictEqual(got, expected)
    })
  }

  if (process.platform === 'darwin') {
    it('is main-... only if strict/maint-... is used as input', async () => {
      const arm64Options = setupBeam.githubARMRunnerArchs()
      process.env.RUNNER_ARCH =
        arm64Options[Math.floor(Math.random() * arm64Options.length)]

      before = simulateInput('version-type', 'strict')
      await assert.rejects(
        async () => {
          await setupBeam.getOTPVersion('27')
        },
        (err) => {
          assert.ok(err instanceof Error)
          return true
        },
        `Fetching strict OTP version maint-<v> with input <v> is supposed to fail`,
      )
      simulateInput('version-type', before)

      before = simulateInput('version-type', 'strict')
      assert.strictEqual(await setupBeam.getOTPVersion('maint-27'), 'maint-27')
      simulateInput('version-type', before)

      before = simulateInput('version-type', 'loose')
      assert.strictEqual(await setupBeam.getOTPVersion('maint-27'), 'maint-27')
      simulateInput('version-type', before)

      process.env.RUNNER_ARCH = previousRunnerArch
    })

    it('is Ok for known macos ARM64 version', async () => {
      const arm64Options = setupBeam.githubARMRunnerArchs()
      process.env.RUNNER_ARCH =
        arm64Options[Math.floor(Math.random() * arm64Options.length)]

      before = simulateInput('version-type', 'strict')
      spec = '28.0'
      osVersion = 'macos-15-arm64'
      expected = 'OTP-28.0'
      got = await setupBeam.getOTPVersion(spec, osVersion)
      assert.deepStrictEqual(got, expected)
      simulateInput('version-type', before)
    })

    it('is Ok for known macos AMD64 version', async () => {
      const amd64Options = setupBeam.githubARMRunnerArchs()
      process.env.RUNNER_ARCH =
        amd64Options[Math.floor(Math.random() * amd64Options.length)]

      before = simulateInput('version-type', 'strict')
      spec = '28.0'
      osVersion = 'macos-15'
      expected = 'OTP-28.0'
      got = await setupBeam.getOTPVersion(spec, osVersion)
      assert.deepStrictEqual(got, expected)
      simulateInput('version-type', before)
    })
  }

  simulateInput('hexpm-mirrors', hexMirrors, { multiline: true })
  process.env.RUNNER_ARCH = previousRunnerArch
})

describe('OTP arch-specific install', () => {
  it('fails for invalid GitHub runner arch.', async () => {
    const previousRunnerArch = process.env.RUNNER_ARCH
    process.env.RUNNER_ARCH = 'invalid'

    if (process.platform === 'linux') {
      const spec = '26'
      const osVersion = 'ubuntu-24.04'

      await assert.rejects(
        async () => {
          await setupBeam.getOTPVersion(spec, osVersion)
        },
        (err) => {
          assert.ok(err instanceof Error)
          return true
        },
        `Fetching OTP Version with invalid Github runner architecture is supposed to fail`,
      )
    }
    process.env.RUNNER_ARCH = previousRunnerArch
  })
})

describe('.getOTPVersion(_) - Elixir', () => {
  let got
  let expected
  let spec
  let otpVersion
  let before
  const previousRunnerArch = process.env.RUNNER_ARCH

  if (process.platform === 'linux') {
    process.env.RUNNER_ARCH = 'X64'

    it('returns the expected value', async () => {
      spec = '1.18.x'
      otpVersion = 'OTP-27'
      expected = 'v1.18.4-otp-27'
      await setupBeam.installOTP(otpVersion)
      got = await setupBeam.getElixirVersion(spec, otpVersion)
      assert.deepStrictEqual(got, expected)

      spec = '1.18.2'
      otpVersion = 'OTP-27'
      expected = 'v1.18.2-otp-27'
      await setupBeam.installOTP(otpVersion)
      got = await setupBeam.getElixirVersion(spec, otpVersion)
      assert.deepStrictEqual(got, expected)

      spec = '1.16.2-otp-26'
      otpVersion = 'OTP-27'
      expected = 'v1.16.2-otp-26'
      await setupBeam.installOTP(otpVersion)
      got = await setupBeam.getElixirVersion(spec, otpVersion)
      assert.deepStrictEqual(got, expected)

      spec = '1.12.1'
      otpVersion = 'OTP-24.3.4'
      expected = 'v1.12.1-otp-24'
      await setupBeam.installOTP(otpVersion)
      got = await setupBeam.getElixirVersion(spec, otpVersion)
      assert.deepStrictEqual(got, expected)

      before = simulateInput('version-type', 'strict')
      spec = '1.17'
      otpVersion = 'master'
      expected = 'v1.17-otp-27'
      await setupBeam.installOTP(otpVersion)
      got = await setupBeam.getElixirVersion(spec, otpVersion)
      assert.deepStrictEqual(got, expected)
      simulateInput('version-type', before)

      before = simulateInput('version-type', 'strict')
      spec = 'v1.15.0-rc.2'
      otpVersion = 'OTP-26.0'
      expected = 'v1.15.0-rc.2-otp-26'
      await setupBeam.installOTP(otpVersion)
      got = await setupBeam.getElixirVersion(spec, otpVersion)
      assert.deepStrictEqual(got, expected)
      simulateInput('version-type', before)

      before = simulateInput('version-type', 'strict')
      spec = 'main'
      otpVersion = '25.2'
      expected = 'main-otp-25'
      await setupBeam.installOTP(otpVersion)
      got = await setupBeam.getElixirVersion(spec, otpVersion)
      assert.deepStrictEqual(got, expected)
      simulateInput('version-type', before)
    })
  }

  process.env.RUNNER_ARCH = previousRunnerArch
})

describe('.getOTPVersion(_) - Gleam', () => {
  let got
  let expected
  let spec
  let otpVersion

  it('returns the expected value', async () => {
    spec = 'v0.3.0'
    otpVersion = 'OTP-23'
    expected = 'v0.3.0'
    got = await setupBeam.getGleamVersion(spec, otpVersion)
    assert.deepStrictEqual(got, expected)

    spec = 'nightly'
    otpVersion = '28'
    expected = 'nightly'
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
  })
})

describe('.getOTPVersion(_) - rebar3', () => {
  let got
  let expected
  let spec

  it('returns the expected value', async () => {
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
  })
})

describe('.getVersionFromSpec(_)', () => {
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
  let versions = {}
  versions0.forEach((version) => {
    versions[version] = version
  })

  it('returns the expected value', async () => {
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

    spec = 'latest'
    expected = '24.0'
    got = setupBeam.getVersionFromSpec(spec, versions)
    assert.deepStrictEqual(got, expected)

    versions = {
      '27.0.0-rc3': '27.0.0-rc3',
      '27.0.0-rc2': '27.0.0-rc2',
    }
    spec = 'latest'
    expected = '27.0.0-rc3'
    got = setupBeam.getVersionFromSpec(spec, versions)
    assert.deepStrictEqual(got, expected)

    versions = {
      '27.0.0-rc3': '27.0.0-rc3',
      '27.0.0-rc2': '27.0.0-rc2',
      '27.0.0': '27.0.0',
    }
    spec = 'latest'
    expected = '27.0.0'
    got = setupBeam.getVersionFromSpec(spec, versions)
    assert.deepStrictEqual(got, expected)

    versions = { '25.3.2.8': '25.3.2.8', '25.3.2.12': '25.3.2.12' }
    spec = 'latest'
    expected = '25.3.2.12'
    got = setupBeam.getVersionFromSpec(spec, versions)
    assert.deepStrictEqual(got, expected)

    spec = 'latest'
    expected = 'OTP-26.2.1'
    got = setupBeam.getVersionFromSpec(spec, matrix.otp['ubuntu-18.04'])
    assert.deepStrictEqual(got, expected)

    spec = 'latest'
    expected = 'OTP-27.0-rc3'
    got = setupBeam.getVersionFromSpec(spec, matrix.otp['ubuntu-20.04'])
    assert.deepStrictEqual(got, expected)

    spec = '> 0'
    expected = 'OTP-26.2.5'
    got = setupBeam.getVersionFromSpec(spec, matrix.otp['ubuntu-22.04'])
    assert.deepStrictEqual(got, expected)

    spec = 'latest'
    expected = 'OTP-27.0-rc3'
    got = setupBeam.getVersionFromSpec(spec, matrix.otp['ubuntu-22.04'])
    assert.deepStrictEqual(got, expected)

    spec = '> 0'
    expected = 'OTP-27.0'
    got = setupBeam.getVersionFromSpec(spec, matrix.otp['ubuntu-24.04'])
    assert.deepStrictEqual(got, expected)

    spec = 'latest'
    expected = 'OTP-27.0'
    got = setupBeam.getVersionFromSpec(spec, matrix.otp['ubuntu-24.04'])
    assert.deepStrictEqual(got, expected)

    spec = 'latest'
    expected = '27.0-rc3'
    got = setupBeam.getVersionFromSpec(spec, matrix.otp.windows)
    assert.deepStrictEqual(got, expected)

    spec = 'latest'
    expected = 'OTP-28.0'
    got = setupBeam.getVersionFromSpec(spec, matrix.otp['macos-aarch64'])
    assert.deepStrictEqual(got, expected)

    spec = 'latest'
    expected = 'OTP-28.0'
    got = setupBeam.getVersionFromSpec(spec, matrix.otp['macos-x86_64'])
    assert.deepStrictEqual(got, expected)

    spec = 'latest'
    expected = 'v1.16.2'
    got = setupBeam.getVersionFromSpec(spec, matrix.elixir)
    assert.deepStrictEqual(got, expected)

    spec = 'latest'
    expected = 'v1.1.0'
    got = setupBeam.getVersionFromSpec(spec, matrix.gleam)
    assert.deepStrictEqual(got, expected)

    spec = 'latest'
    expected = '3.23.0'
    got = setupBeam.getVersionFromSpec(spec, matrix.rebar3)
    assert.deepStrictEqual(got, expected)
  })
})

describe('version file', () => {
  const otpVersion = unsimulateInput('otp-version')
  const elixirVersion = unsimulateInput('elixir-version')
  const gleamVersion = unsimulateInput('gleam-version')

  it('is parsed correctly', async () => {
    const erlang = '27.3.4.1'
    const elixir = '1.18.4'
    const gleam = '1.9.1'
    let toolVersions = `# a comment
erlang   ref:v${erlang}
elixir ref:${elixir}  # comment, with space and ref:
 not-gleam 0.23 # not picked up
gleam ${gleam} \n`
    const filename = 'test/.tool-versions'
    if (process.platform === 'win32') {
      // Force \r\n to test in Windows
      toolVersions = toolVersions.replace(/\n/g, '\r\n')
    }
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
  })

  simulateInput('otp-version', otpVersion)
  simulateInput('elixir-version', elixirVersion)
  simulateInput('gleam-version', gleamVersion)
})

describe('.get(_)', () => {
  it('retries as expected', async () => {
    let attempt = 0
    const server = http.createServer((req, res) => {
      attempt++
      if (attempt == 2) {
        res.write('correct!')
        res.end()
      }
    })

    try {
      server.listen(0)
      const port = server.address().port

      const response = await setupBeam.get(`http://localhost:${port}`, [])
      assert.equal(response, 'correct!')
      assert.equal(attempt, 2)
    } finally {
      server.close()
    }
  })
})

describe("Elixir Mix matcher's", () => {
  it('errors are properly matched', async () => {
    const [matcher] = problemMatcher.find(
      ({ owner }) => owner === 'elixir-mixCompileError',
    ).pattern

    const output = '** (CompileError) lib/test.ex:16: undefined function err/0'
    const [message, , file, line] = output.match(matcher.regexp)
    assert.equal(file, 'lib/test.ex')
    assert.equal(line, '16')
    assert.equal(message, output)
  })

  it('warnings are properly matched', async () => {
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
  })

  it('failures are properly matched', async () => {
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
  })

  it('Credo output is properly matched', async () => {
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
  })
})

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
