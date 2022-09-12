#!/usr/bin/env bash

configuration=$1
if [ -z "$configuration" ]; then
    configuration=release
fi

set -e

dotnet publish /p:NativeLib=Static /p:SelfContained=true -r linux-x64 -c $configuration

ilcompiler=~/.nuget/packages/runtime.linux-x64.microsoft.dotnet.ilcompiler/7.0.0-preview.7.22375.6

dotnetLibs="./bin/$configuration/net7.0/linux-x64/publish/AnalyzerLib.a
  $ilcompiler/sdk/libbootstrapperdll.a
  $ilcompiler/sdk/libRuntime.WorkstationGC.a
  $ilcompiler/framework/libSystem.Native.a
  $ilcompiler/framework/libSystem.Globalization.Native.a
  $ilcompiler/framework/libSystem.IO.Compression.Native.a
  $ilcompiler/framework/libSystem.Net.Security.Native.a
  $ilcompiler/framework/libSystem.Security.Cryptography.Native.OpenSsl.a
"

clang -o bin/test test.c $dotnetLibs \
  -Wall -pthread -lstdc++ -ldl -lm \
  -Wl,--require-defined,NativeAOT_StaticInitialization -Wl,--allow-multiple-definition
