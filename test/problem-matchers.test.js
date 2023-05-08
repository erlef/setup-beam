const assert = require('assert')
const core = require('@actions/core')
const { problemMatcher } = require('../matchers/elixir-matchers.json')

async function all() {
  await testElixirMixCompileError()
  await testElixirMixCompileWarning()
  await testElixirMixTestFailure()
  await testElixirCredoOutputDefault()
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

all()
  .then(() => process.exit(0))
  .catch((err) => {
    core.error(err)
    process.exit(1)
  })
