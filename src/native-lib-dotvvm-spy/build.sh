#!/usr/bin/env bash

set -e

configuration=$1
if [ -z "$configuration" ]; then
    configuration=Release
fi

echo 'If the dotnet build fails on a cryptic error, use `rm -rf bin obj`, it often fixes the problem'

dotnet publish /p:NativeLib=Shared /p:SelfContained=true -r linux-x64 -c $configuration --verbosity q

cp ./bin/$configuration/net7.0/linux-x64/publish/LibDotvvmSpy.so bin/libDotvvmSpy.so

clang -o bin/test_dyn test.c ./bin/libDotvvmSpy.so -g -Wall -pthread -lstdc++ -ldl -lm \
  -Wl,-rpath,'$ORIGIN' # add current dir to linker search path
  # -fsanitize=address -fno-omit-frame-pointer
  # -g

cd node_binding
yarn install
yarn build
yarn sanity-check
