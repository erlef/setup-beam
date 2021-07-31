import gleam_rebar3
import gleam/should

pub fn hello_world_test() {
  gleam_rebar3.hello_world()
  |> should.equal("Hello, from gleam_rebar3!")
}
