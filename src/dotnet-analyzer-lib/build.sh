#!/usr/bin/env bash

configuration=$1
if [ -z "$configuration" ]; then
    configuration=release
fi

set -e

dotnet publish /p:NativeLib=Static /p:SelfContained=true -r linux-x64 -c $configuration

cp ./bin/$configuration/net7.0/linux-x64/publish/AnalyzerLib.a bin/AnalyzerLib.a

ilcompiler=~/.nuget/packages/runtime.linux-x64.microsoft.dotnet.ilcompiler/7.0.0-preview.7.22375.6

dotnetLibs="./bin/$configuration/net7.0/linux-x64/publish/AnalyzerLib.a
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
