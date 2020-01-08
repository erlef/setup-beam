# setup-elixir

[![](https://github.com/actions/setup-elixir/workflows/Test/badge.svg)](https://github.com/actions/setup-elixir/actions)
[![](https://github.com/actions/setup-elixir/workflows/Licensed/badge.svg)](https://github.com/actions/setup-elixir/actions)

This actions sets up an Elixir environment for use in Actions by:

- Installing OTP
- Installing Elixir

**Note** Currently, this action currently only supports Actions' `ubuntu-` runtimes.

## Usage

See [action.yml](action.yml).

**Note** The OTP release version specification is [relatively
complex](http://erlang.org/doc/system_principles/versions.html#version-scheme).
For best results, we recommend specifying exact OTP and Elixir versions.
However, values like `22.x` are also accepted, and we attempt to resolve them
according to semantic versioning rules.

### Basic example

```yaml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-elixir@v1.2.0
        with:
          otp-version: 22.2
          elixir-version: 1.9.4
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
        otp: [20.3, 21.3, 22.2]
        elixir: [1.8.2, 1.9.4]
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-elixir@v1.2.0
        with:
          otp-version: ${{matrix.otp}}
          elixir-version: ${{matrix.elixir}}
      - run: mix deps.get
      - run: mix test
```

### Phoenix example

```yaml
on: push

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      db:
        image: postgres:11
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-elixir@v1.2.0
        with:
          otp-version: 22.2
          elixir-version: 1.9.4
      - run: mix deps.get
      - run: mix test
```

## License

The scripts and documentation in this project are released under the [MIT license](LICENSE.md).

## Contributing

Check out [this doc](CONTRIBUTING.md).

## Current Status

This action is in active development.
