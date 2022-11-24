cd tree-sitter-dotvvm
echo "Building tree sitter"
yarn install --immutable
yarn build

cd ..
cd native-lib-dotvvm-spy
echo "Attempting to build .NET Native dotvvm-spy"
./build.ps1 -ErrorAction SilentlyContinue

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
