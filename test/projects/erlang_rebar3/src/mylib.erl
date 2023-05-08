%%%-------------------------------------------------------------------
%% @doc mylib public API
%% @end
%%%-------------------------------------------------------------------

-module(mylib).

-export([hello/0]).
-ignore_xref(hello/0).

-spec hello() -> world.
hello() ->
    Ret = world,
    _ = io:format("~p", [Ret]),
    Ret.

%% internal functions
