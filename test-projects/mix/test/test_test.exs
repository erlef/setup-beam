defmodule TestTest do
  use ExUnit.Case
  doctest Test

  test "greets the world" do
    out = Logfmt.encode(foo: "bar")
    assert out == "foo=bar"
  end
end
