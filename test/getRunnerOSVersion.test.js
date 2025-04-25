const { describe, it, afterEach } = require('node:test')
const assert = require('node:assert')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const { getRunnerOSVersion } = require('../src/lib/getRunnerOSVersion')

describe('getRunnerOSVersion', () => {
  it('throws if no ImageOS env exists', async () => {
    assert.throws(() => {
      getRunnerOSVersion(undefined)
    })
  })

  describe('simple mappings', () => {
    for (const [imageOS, runnerOS] of [
      ['ubuntu18', 'ubuntu-18.04'],
      ['ubuntu20', 'ubuntu-20.04'],
      ['ubuntu22', 'ubuntu-22.04'],
      ['ubuntu24', 'ubuntu-24.04'],
      ['win19', 'windows-2019'],
      ['win22', 'windows-2022'],
    ]) {
      it(`returns ${runnerOS} for ${imageOS}`, () => {
        const result = getRunnerOSVersion(imageOS)

        assert.strictEqual(result, runnerOS)
      })
    }
  })

  describe('detect ubuntu version if "ImageOS" is "Linux"', () => {
    afterEach(() => {
      // Clear the mock filesystem after each test.
      for (const path in mockFS) {
        delete mockFS[path]
      }
    })

    it('detects ubuntu 24.04', () => {
      mockFS['/etc/os-release'] = loadFixture('ubuntu24.txt')

      const result = getRunnerOSVersion('Linux', mockedReadFileSync)
      assert.strictEqual(result, 'ubuntu-24.04')
    })

    it('detects ubuntu 22.04', () => {
      mockFS['/etc/os-release'] = loadFixture('ubuntu22.txt')

      const result = getRunnerOSVersion('Linux', mockedReadFileSync)
      assert.strictEqual(result, 'ubuntu-22.04')
    })

    it('rejects ubuntu 25.04 (valid format, but not in availability table)', () => {
      mockFS['/etc/os-release'] = loadFixture('ubuntu25.txt')

      assert.throws(() => {
        getRunnerOSVersion('Linux', mockedReadFileSync)
      })
    })

    it('rejects alpine 3 (invalid distro)', () => {
      mockFS['/etc/os-release'] = loadFixture('alpine3.txt')

      assert.throws(() => {
        getRunnerOSVersion('Linux', mockedReadFileSync)
      })
    })

    it('fails with usual message if /etc/os-release is not found', () => {
      assert.throws(
        () => {
          getRunnerOSVersion('Linux', mockedReadFileSync)
        },
        {
          message: /(got Linux)/,
        },
      )
    })
  })
})

function loadFixture(filename) {
  const path = join(__dirname, 'fixtures', 'os-release', filename)

  return readFileSync(path, 'utf8')
}

const mockFS = {}

function mockedReadFileSync(path) {
  if (Object.hasOwn(mockFS, path)) {
    return mockFS[path]
  }

  throw new Error(`File not found in mockFS: ${path} (forgot to mock it?)`)
}
