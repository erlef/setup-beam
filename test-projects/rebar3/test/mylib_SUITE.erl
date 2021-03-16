-module(mylib_SUITE).

-include_lib("stdlib/include/assert.hrl").

-compile([export_all, nowarn_export_all]).

all() ->
    [hello_world].

hello_world(_Config) ->
    ?assertEqual(world, mylib:hello()).
