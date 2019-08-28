# setup-elixir

[![](https://github.com/actions/setup-elixir/workflows/Test/badge.svg)](https://github.com/actions/setup-elixir/actions)

This actions sets up an Elixir environment for use in Actions by:

- Installing OTP
- Installing Elixir

**Note** Currently, this action currently only supports Actions' `ubuntu-` runtimes.

## Usage

See [action.yml](action.yml).

**Note** The OTP release version specification is [relatively
complex](http://erlang.org/doc/system_principles/versions.html#version-scheme).
For best results, the current recommendation is to use a full exact version
spec from the list available from [Erlang
Solutions](https://www.erlang-solutions.com/resources/download.html).

### Basic example

```yaml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-elixir@v1.0.0
        with:
          otp-version: 22.x
          elixir-version: 1.9.x
      - run: mix deps.get
      - run: mix test
```

### Matrix example

```yaml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    name: OTP ${{matrix.otp}} / Elixir ${{matrix.elixir}}
    strategy:
      matrix:
        otp: [20.x, 21.x, 22.x]
        elixir: [1.8.x, 1.9.x]
    steps:
      - uses: actions/setup-elixir@v1.0.0
        with:
          otp-version: ${{matrix.otp}}
          elixir-version: ${{matrix.elixir}}
      - run: mix deps.get
      - run: mix test
```

## License

The scripts and documentation in this project are released under the [MIT license](LICENSE.md).

## Contributing

Check out [this doc](CONTRIBUTING.md).

## Current Status

This action is in active development.
