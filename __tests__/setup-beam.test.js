const {getElixirVersion} = require('../src/setup-beam')
const {deepStrictEqual} = require('assert')

async function test() {
  let vsn
  vsn = await getElixirVersion('v1.10.x', '23')
  deepStrictEqual(vsn, ['v1.10.4', '23'])

  vsn = await getElixirVersion('^v1.10', '23')
  deepStrictEqual(vsn, ['v1.10.4', '23'])

  vsn = await getElixirVersion('v1.11.0-rc.0', '23')
  deepStrictEqual(vsn, ['v1.11.0-rc.0', '23'])
}

test()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
