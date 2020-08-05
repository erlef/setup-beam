# setup-elixir

[![](https://github.com/actions/setup-elixir/workflows/Test/badge.svg)](https://github.com/actions/setup-elixir/actions)
[![](https://github.com/actions/setup-elixir/workflows/Licensed/badge.svg)](https://github.com/actions/setup-elixir/actions)

This action sets up an Elixir environment for use in a GitHub Actions
workflow by:

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

Additionally, it is recommended that one specifies OTP and Elixir versions
using YAML strings, as these examples do, so that numbers like `23.0` don't
end up being parsed as `23`, which is not equivalent.

### Basic example

```yaml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-elixir@v1
        with:
          otp-version: '22.2'
          elixir-version: '1.9.4'
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
        otp: ['20.3', '21.3', '22.2']
        elixir: ['1.8.2', '1.9.4']
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-elixir@v1
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
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-elixir@v1
        with:
          otp-version: '22.2'
          elixir-version: '1.9.4'
      - run: mix deps.get
      - run: mix test
```

#### Authenticating with Postgres in Phoenix

When using the Phoenix example above, the `postgres` container has some
default authentication set up. Specifically, it expects a username of
"postgres", and a password of "postgres". It will be available at
`localhost:5432`.

The simplest way of setting these auth values in CI is by checking for the
`GITHUB_ACTIONS` environment variable that is set in all workflows:

```elixir
# config/test.exs

use Mix.Config

# Configure the database for local testing
config :app, App.Repo,
  database: "my_app_test",
  hostname: "localhost",
  pool: Ecto.Adapters.SQL.Sandbox

# Configure the database for GitHub Actions
if System.get_env("GITHUB_ACTIONS") do
  config :app, App.Repo,
    username: "postgres",
    password: "postgres"
end
```

## Matchers

The problem matchers in this repository are adapted from [here](https://github.com/fr1zle/vscode-elixir/blob/45eddb589acd7ac98e0c7305d1c2b24668ca709a/package.json). See [MATCHER_NOTICE](MATCHER_NOTICE.md) for license details.

## License

The scripts and documentation in this project are released under the [MIT license](LICENSE.md).

## Contributing

Check out [this doc](CONTRIBUTING.md).

## Current Status

This action is in active development.
