<!-- markdownlint-disable MD013 -->
# setup-beam [![GitHub Actions Test][test-img]][test] [![GitHub Actions CI][ci-img]][ci]

[test]: https://github.com/erlef/setup-beam
[test-img]: https://github.com/erlef/setup-beam/workflows/test/badge.svg
[ci]: https://github.com/erlef/setup-beam
[ci-img]: https://github.com/erlef/setup-beam/workflows/ci/badge.svg

This action sets up an Erlang/OTP environment for use in a GitHub Actions
workflow by:

- installing Erlang/OTP
- optionally, installing Elixir
- optionally, installing `rebar3`
- optionally, installing `hex`

**Note** Currently, this action only supports Actions' `ubuntu-` runtimes.

## Usage

See [action.yml](action.yml) for the action's specification.

**Note**: The Erlang/OTP release version specification is [relatively
complex](http://erlang.org/doc/system_principles/versions.html#version-scheme).
For best results, we recommend specifying exact Erlang/OTP, Elixir versions, and
`rebar3` versions.
However, values like `22.x`, or even `>22`, are also accepted, and we attempt to resolve them
according to semantic versioning rules.

Additionally, it is recommended that one specifies Erlang/OTP, Elixir and `rebar3` versions
using YAML strings, as these examples do, so that numbers like `23.0` don't
end up being parsed as `23`, which is not equivalent.

For pre-release Elixir versions, such as `1.11.0-rc.0`, use the full version
specifier (`1.11.0-rc.0`). Pre-release versions are opt-in, so `1.11.x` will
not match a pre-release.

### Compatibility between Ubuntu and Erlang/OTP

This list presents the known working version combos between Ubuntu
and Erlang/OTP.

| Ubuntu       | Erlang/OTP | Status
|-             |-           |-
| ubuntu-16.04 | 17 - 24    | ✅
| ubuntu-18.04 | 17 - 24    | ✅
| ubuntu-20.04 | 20 - 24    | ✅
| windows-2016 | 23 - 24    | ✅
| windows-2019 | 23 - 24    | ✅

### Basic example (Elixir)

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: erlef/setup-beam@v1
        with:
          otp-version: '22.2'
          elixir-version: '1.9.4'
      - run: mix deps.get
      - run: mix test
```

### Basic example (`rebar3`)

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: erlef/setup-beam@v1
        with:
          otp-version: '22.2'
          rebar3-version: '3.14.2'
      - run: rebar3 ct
```

### Matrix example (Elixir)

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    name: OTP ${{matrix.otp}} / Elixir ${{matrix.elixir}}
    strategy:
      matrix:
        otp: ['20.3', '21.3', '22.2']
        elixir: ['1.8.2', '1.9.4']
    steps:
      - uses: actions/checkout@v2
      - uses: erlef/setup-beam@v1
        with:
          otp-version: ${{matrix.otp}}
          elixir-version: ${{matrix.elixir}}
      - run: mix deps.get
      - run: mix test
```

### Matrix example (`rebar3`)

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    name: Erlang/OTP ${{matrix.otp}} / rebar3 ${{matrix.rebar3}}
    strategy:
      matrix:
        otp: ['20.3', '21.3', '22.2']
        rebar3: ['3.14.1', '3.14.3']
    steps:
      - uses: actions/checkout@v2
      - uses: erlef/setup-beam@v1
        with:
          otp-version: ${{matrix.otp}}
          rebar3-version: ${{matrix.rebar3}}
      - run: rebar3 ct
```

### Basic example (`rebar3` on Windows 2016)

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: windows-2019
    steps:
      - uses: actions/checkout@v2
      - uses: erlef/setup-beam@v1
        with:
          otp-version: '24.0.2'
          rebar3-version: '3.16.1'
      - shell: pwsh
        run: "& rebar3 ct"
```

## Elixir Problem Matchers

The Elixir Problem Matchers in this repository are adapted from [here](https://github.com/fr1zle/vscode-elixir/blob/45eddb589acd7ac98e0c7305d1c2b24668ca709a/package.json#L70-L118). See [MATCHER_NOTICE](MATCHER_NOTICE.md) for license details.

## License

The scripts and documentation in this project are released under the [MIT license](LICENSE.md).

## Contributing

Check out [this doc](CONTRIBUTING.md).

## Current Status

This action is in active development.
