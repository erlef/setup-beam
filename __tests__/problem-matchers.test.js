const assert = require('assert')
const { problemMatcher } = require('../.github/elixir-matchers')

async function all() {
  await testElixirMixCompileError()
  await testElixirMixCompileWarning()
  await testElixirMixTestFailure()
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
    'warning: variable "err" does not exist and is being expanded to "err()", please use parentheses to remove the ambiguity or change the variable name'
  const secondOutput = '  lib/test.ex:16: Test.hello/0'

  const [, message] = firstOutput.match(messagePattern.regexp)
  assert.equal(
    message,
    'variable "err" does not exist and is being expanded to "err()", please use parentheses to remove the ambiguity or change the variable name',
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

all()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
