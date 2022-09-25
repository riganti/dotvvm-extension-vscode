#!/usr/bin/env bash

set -e

configuration=$1
if [ -z "$configuration" ]; then
    configuration=Release
fi

echo 'If the dotnet build fails on a cryptic error, use `rm -rf bin obj`, it often fixes the problem'

dotnet publish /p:NativeLib=Shared /p:SelfContained=true -r linux-x64 -c $configuration

cp ./bin/$configuration/net7.0/linux-x64/publish/LibDotvvmSpy.so bin/libDotvvmSpy.so

dotnet publish /p:NativeLib=Static /p:SelfContained=true -r linux-x64 -c $configuration

cp ./bin/$configuration/net7.0/linux-x64/publish/LibDotvvmSpy.a bin/libDotvvmSpy.a

ilcompiler=~/.nuget/packages/runtime.linux-x64.microsoft.dotnet.ilcompiler/7.0.0-rc.1.22426.10

dotnetLibs="./bin/libDotvvmSpy.a
  -L$ilcompiler/sdk
  -L$ilcompiler/framework
  -l:libbootstrapperdll.a
  -l:libRuntime.WorkstationGC.a
  -l:libSystem.Native.a
  -l:libSystem.Globalization.Native.a
  -l:libSystem.IO.Compression.Native.a
  -l:libSystem.Net.Security.Native.a
  -l:libSystem.Security.Cryptography.Native.OpenSsl.a
"

clang -o bin/test test.c $dotnetLibs -g -Wall -pthread -lstdc++ -ldl -lm \
  -Wl,--require-defined,NativeAOT_StaticInitialization \
  # -fsanitize=address -fno-omit-frame-pointer
  # -g

clang -o bin/test_dyn test.c ./bin/libDotvvmSpy.so -g -Wall -pthread -lstdc++ -ldl -lm \
  -Wl,-rpath,'$ORIGIN' # add current dir to linker search path
  # -fsanitize=address -fno-omit-frame-pointer
  # -g

yarn --cwd node_binding build
yarn --cwd node_binding sanity-check
