#!/bin/bash

cd tree-sitter-dotvvm/
echo "Building tree sitter"
yarn install
yarn build

cd ..
echo "Building dohtml language server"
cd dothtml-basic-ls
yarn install
yarn build

cd ..
echo "Building dotvvm vscode"
cd dotvvm-vscode
yarn install
yarn build
