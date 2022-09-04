#!/bin/bash
set -e

cd tree-sitter-dotvvm
echo "Building tree sitter"
yarn install --immutable
yarn build

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
