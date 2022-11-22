#!/bin/bash
set -e

cd tree-sitter-dotvvm
echo "Building tree sitter"
yarn install --immutable
yarn build

cd ..
cd native-lib-dotvvm-spy
echo "Attempting to build .NET Native dotvvm-spy"
set +e
./build.sh
set -e

cd ..
echo "Building dohtml language server"
cd dothtml-basic-ls
yarn install --immutable
yarn build

cd ..
echo "Building dotvvm vscode"
cd dotvvm-vscode
yarn install --immutable
yarn build
