defmodule TestTest do
  use ExUnit.Case
  doctest Test

  test "greets the world" do
    out = Logfmt.encode(foo: "bar")
    assert out == "foo=bar"
  end

  test "ensures ssl" do
    assert {:ok, _} = Application.ensure_all_started(:ssl)
  end
end
