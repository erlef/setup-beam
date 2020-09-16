const {getElixirVersion} = require('../src/setup-elixir')

describe('getElixirVersion', () => {
  test('actual version parsing', async () => {
    const vsn = await getElixirVersion('v1.10.x', '23')
    expect(vsn).toEqual(['v1.10.4', '23'])
  })

  test('version range parsing', async () => {
    const vsn = await getElixirVersion('^v1.10', '23')
    expect(vsn).toEqual(['v1.10.4', '23'])
  })

  test('pre-release versions', async () => {
    const vsn = await getElixirVersion('v1.11.0-rc.0', '23')
    expect(vsn).toEqual(['v1.11.0-rc.0', '23'])
  })
})
