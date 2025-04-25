const fs = require('node:fs')
const core = require('@actions/core')

const IMAGE_OS_TO_RUNNER_OS = {
  ubuntu18: 'ubuntu-18.04',
  ubuntu20: 'ubuntu-20.04',
  ubuntu22: 'ubuntu-22.04',
  ubuntu24: 'ubuntu-24.04',
  win19: 'windows-2019',
  win22: 'windows-2022',
}

function getRunnerOSVersion(imageOS, readFile = fs.readFileSync) {
  core.startGroup('Get runner OS version')

  core.info(`ImageOS is set to '${imageOS}'`)

  if (imageOS === 'Linux') {
    core.info('Attempting to detect OS version from /etc/os-release.')

    try {
      const osRelease = parseOSRelease(readFile)
      core.debug('Parsed /etc/os-release: ' + JSON.stringify(osRelease))

      const shortVersion = osRelease.VERSION_ID?.split('.')[0]
      imageOS = osRelease.ID + shortVersion

      core.info(`Detected '${imageOS}'`)
    } catch (error) {
      core.error('Failed to parse /etc/os-release: ' + error.message)
    }
  }

  const containerFromEnvImageOS = IMAGE_OS_TO_RUNNER_OS[imageOS]
  if (!containerFromEnvImageOS) {
    throw new Error(
      "Tried to map a target OS from env. variable 'ImageOS' (got " +
        `${imageOS}` +
        "), but failed. If you're using a " +
        "self-hosted runner, you should set 'env': 'ImageOS': ... to one of the following: " +
        "['" +
        `${Object.keys(IMAGE_OS_TO_RUNNER_OS).join("', '")}` +
        "']",
    )
  }

  core.info('Resulting runner OS: ' + containerFromEnvImageOS)

  core.endGroup()

  return containerFromEnvImageOS
}

/**
 * Returns an Object with the contents of `/etc/os-release`, with the keys
 * being the left side of the '=' and the values being the right side.
 * The values are stripped of quotes and whitespace.
 *
 * Usually, this should result in an object like:
 *
 *     {
 *       ID: 'ubuntu',
 *       VERSION_ID: '24.04',
 *       // ...other keys
 *     }
 *
 * @returns {Object} The contents of `/etc/os-release` as an object.
 */
function parseOSRelease(readFile) {
  const osRelease = readFile('/etc/os-release', 'utf8')
  const lines = osRelease.split('\n')

  return Object.fromEntries(
    lines
      .filter((line) => line.includes('='))
      .map((line) => {
        const [key, value] = line.split('=')
        return [key.trim(), value.replace(/"/g, '').trim()]
      }),
  )
}

module.exports = {
  getRunnerOSVersion,
}
