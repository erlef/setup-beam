-module(mylib_SUITE).

-include_lib("stdlib/include/assert.hrl").

-compile([export_all, nowarn_export_all]).

all() ->
    [hello_world, ssl_ok].

hello_world(_Config) ->
    ?assertEqual(world, mylib:hello()).

ssl_ok(_Config) ->
    {ok, _} = application:ensure_all_started(ssl).
