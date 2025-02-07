# setup-beam [![Action][action-img]][action]&nbsp;[![Ubuntu][ubuntu-img]][ubuntu]&nbsp;[![Windows][windows-img]][windows]

[action]: https://github.com/erlef/setup-beam/actions/workflows/action.yml
[action-img]: https://github.com/erlef/setup-beam/actions/workflows/action.yml/badge.svg
[ubuntu]: https://github.com/erlef/setup-beam/actions/workflows/ubuntu.yml
[ubuntu-img]: https://github.com/erlef/setup-beam/actions/workflows/ubuntu.yml/badge.svg
[windows]: https://github.com/erlef/setup-beam/actions/workflows/windows.yml
[windows-img]: https://github.com/erlef/setup-beam/actions/workflows/windows.yml/badge.svg

This action sets up an Erlang/OTP environment for use in a GitHub Actions
workflow by:

- installing [Erlang/OTP](https://www.erlang.org/)
- optionally, installing [Elixir](https://elixir-lang.org/)
- optionally, installing [Gleam](https://gleam.run/)
- optionally, installing [`rebar3`](https://www.rebar3.org/)
- optionally, installing [`hex`](https://hex.pm/)
- optionally, opting for strict or loose version matching
- optionally, having
  [problem matchers](https://github.com/actions/toolkit/blob/main/docs/problem-matchers.md) show
  warnings and errors on pull requests
- optionally, using a version file (as explained in "Version file", below), to identify versions

**Note**: currently, this action only supports Actions' `ubuntu-` and `windows-` runtimes.

## Usage

See [action.yml](action.yml) for the action's specification.

### Input versioning

Input (tools') versions are controlled via `with:` (check the examples below).

#### Strict versions

The Erlang/OTP release version specification, for example, is [relatively
complex](http://erlang.org/doc/system_principles/versions.html#version-scheme), so,
for best results, we recommend specifying exact
versions, and setting option `version-type` to `strict`.

#### Version ranges

However, values like `22.x`, or even `>22`, are also accepted, and we attempt to resolve them
according to semantic versioning rules. This implicitly means `version-type` is `loose`,
which is also the default value for this option.

#### Specify versions as strings, not numbers

Additionally, it is recommended that one specifies versions
using YAML strings, as these examples do, so that numbers like `23.0` don't
end up being parsed as `23`, which is not equivalent.

#### Pre-release versions

For pre-release versions, such as `v1.11.0-rc.0`, use the full version
specifier (`v1.11.0-rc.0`) and set option `version-type` to `strict`. Pre-release versions are
opt-in, so `1.11.x` will not match a pre-release.

#### "Latest" versions

Set a tool's version to `latest` to retrieve the latest version of a given tool.
The latest version is (locally) calculated by the action based on the (retrieved) versions
it knows (**note**: it is not the same as [GitHub considers it](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
and some repositories might propose).

If in doubt do a test run and compare the obtained release with the one you were expecting to
be the latest.

### Compatibility between Operating System and Erlang/OTP

This list presents the known working version combos between the target operating system
and Erlang/OTP.

| Operating system | Erlang/OTP   | OTP Architecture | Status
|-                 |-             | -                |-
| `ubuntu-18.04`   | 17.0 - 25.3  | x86_64, arm64    | ✅
| `ubuntu-20.04`   | 21.0 - 27    | x86_64, arm64    | ✅
| `ubuntu-22.04`   | 24.2 - 27    | x86_64, arm64    | ✅
| `ubuntu-24.04`   | 24.3 - 27    | x86_64, arm64    | ✅
| `windows-2019`   | 21\* - 25    | x86_64, x86      | ✅
| `windows-2022`   | 21\* - 27    | x86_64, x86      | ✅

**Note** \*: prior to 23, Windows builds are only available for minor versions, e.g. 21.0, 21.3,
22.0, etc.

### Self-hosted runners

Self-hosted runners need to set env. variable `ImageOS` to one of the following, since the action
uses that to download assets:

| ImageOS    | Operating system
|-           |-
| `ubuntu18` | `ubuntu-18.04`
| `ubuntu20` | `ubuntu-20.04`
| `ubuntu22` | `ubuntu-22.04`
| `ubuntu24` | `ubuntu-24.04`
| `win19`    | `windows-2019`
| `win22`    | `windows-2022`

as per the following example:

```yaml
...

jobs:
  test:
    runs-on: self-hosted
    env:
      ImageOS: ubuntu20 # equivalent to runs-on ubuntu-20.04
    steps:
      - uses: actions/checkout@v4
      - uses: erlef/setup-beam@v1
        ...
```

### Outputs

The action provides the following outputs:

| Output               | Content
|-                     |-
| `otp-version`        | The Erlang version, e.g. `OTP-26.0`
| `elixir-version`     | The Elixir version, e.g. `v1.14-otp-26`
| `gleam-version`      | The Gleam version, e.g. `v1.5.1`
| `rebar3-version`     | The `rebar3` version, e.g. `3.18.0`
| `setup-beam-version` | The commit unique id of the executed action version, e.g. `a34c98f`

accessible as `${{steps.<setup-beam-step-id>.outputs.<Output>}}`,
e.g. `${{steps.setup-beam.outputs.erlang-version}}`

### Version file

A version file is specified via input `version-file` (e.g.`.tool-versions`). This
allows not having to use YML input for versions, though the action does check (and
will exit with error) if both inputs are set.

**Note**: if you're using a version file, option `version-type` is checked to be `strict`,
and will make the action exit with error otherwise.

The following version file formats are supported:

- `.tool-versions`, as specified by [asdf: Configuration](https://asdf-vm.com/manage/configuration.html)

Supported version elements are the same as the ones defined for the YML portion of the action,
with the following correspondence.

#### `.tool-versions` format

| YML              | `.tool-versions`
|-                 |-
| `otp-version`    | `erlang`
| `elixir-version` | `elixir`
| `gleam-version`  | `gleam`
| `rebar3-version` | `rebar`

### Alternative hex.pm mirrors

It is possible to use alternative hex.pm mirror(s), in their declared order, with
option `hexpm-mirrors`. By default, the action will use `builds.hex.pm`.
To use other alternative mirrors, add one per line, as shown below.

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: erlef/setup-beam@v1
        with:
          otp-version: '26'
          # Use `cdn.jsdelivr.net/hex` as an alternative to `builds.hex.pm`
          hexpm-mirrors: https://cdn.jsdelivr.net/hex
```

Alternatively, you may try `cdn.jsdelivr.net/hex` if `builds.hex.pm` fails:

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: erlef/setup-beam@v1
        with:
          otp-version: '26'
          hexpm-mirrors: |
            https://builds.hex.pm
            https://cdn.jsdelivr.net/hex
```

### OTP Architecture

On Windows you can specify the OTP architecture to install.

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: erlef/setup-beam@v1
        with:
          otp-version: '26'
          otp-architecture: '32'
```

### Environment variables

Base installation folders (useful for e.g. fetching headers for NIFs) are available in the following
environment variables:

- `INSTALL_DIR_FOR_OTP`: base folder for Erlang/OTP
- `INSTALL_DIR_FOR_ELIXIR`: base folder for Elixir
- `INSTALL_DIR_FOR_GLEAM`: base folder for Gleam
- `INSTALL_DIR_FOR_REBAR3`: base folder for `rebar3`

In each of these you'll find folder `bin` where the appropriate binaries, platform-dependant,
are found (i.e. `erl`, `erl.exe`, `rebar3`, `rebar3.exe`, ...).

### Elixir Problem Matchers

The Elixir Problem Matchers in this repository are adapted from
[here](https://github.com/fr1zle/vscode-elixir/blob/45eddb589acd7ac98e0c7305d1c2b24668ca709a/package.json#L70-L118).
See [MATCHER_NOTICE](MATCHER_NOTICE.md) for license details.

## Examples

### Erlang/OTP + Elixir, on Ubuntu

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: ubuntu-20.04
    name: OTP ${{matrix.otp}} / Elixir ${{matrix.elixir}}
    strategy:
      matrix:
        otp: ['21.1', '22.2', '23.3']
        elixir: ['1.8.2', '1.9.4']
    steps:
      - uses: actions/checkout@v4
      - uses: erlef/setup-beam@v1
        with:
          otp-version: ${{matrix.otp}}
          elixir-version: ${{matrix.elixir}}
      - run: mix deps.get
      - run: mix test
```

### Erlang/OTP + `rebar3`, on Ubuntu

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: ubuntu-20.04
    name: Erlang/OTP ${{matrix.otp}} / rebar3 ${{matrix.rebar3}}
    strategy:
      matrix:
        otp: ['21.1', '22.2', '23.3']
        rebar3: ['3.14.1', '3.14.3']
    steps:
      - uses: actions/checkout@v4
      - uses: erlef/setup-beam@v1
        with:
          otp-version: ${{matrix.otp}}
          rebar3-version: ${{matrix.rebar3}}
      - run: rebar3 ct
```

### Erlang/OTP + `rebar3`, on Windows

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: windows-2022
    steps:
      - uses: actions/checkout@v4
      - uses: erlef/setup-beam@v1
        with:
          otp-version: '24'
          rebar3-version: '3.16.1'
      - run: rebar3 ct
```

### Gleam on Ubuntu

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: erlef/setup-beam@v1
        with:
          otp-version: '27'
          gleam-version: '1.5.1'
      - run: gleam test
```

### Gleam on Ubuntu without OTP

```yaml
# create this in .github/workflows/ci.yml
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: erlef/setup-beam@v1
        with:
          otp-version: false
          gleam-version: '1.5.1'
      - run: gleam check
```

**Note**: the `otp-version: false` input is only applicable when installing Gleam.

## The project

### Versioning

`setup-beam` has three version paths, described below, for example version `1.8.0`:

- `@v1`: the latest in the `1.y.z` series (this tag is movable),
- `@v1.8`: the latest in the `1.8.z` series (this tag is movable),
- `@v1.8.0`: release `1.8.0` (this tag is not movable).

We make a real effort to not introduce incompatibilities without changing the major
version number. To be extra safe against changes causing issues in your CI you should specify
an exact version with `@vx.y.z`.

### License

The scripts and documentation in this project are released under the [MIT license](LICENSE.md).

### Contributing

Check out [this doc](CONTRIBUTING.md).

### Code of Conduct

This project's code of conduct is made explicit in [CODE_OF_CONDUCT.md](https://github.com/erlef/setup-beam/blob/main/CODE_OF_CONDUCT.md).

### Security

This project's security policy is made explicit in [SECURITY.md](https://github.com/erlef/setup-beam/blob/main/SECURITY.md).
