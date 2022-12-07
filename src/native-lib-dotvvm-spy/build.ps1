dotnet publish /p:NativeLib=Shared /p:SelfContained=true -r win-x64 -c Release
Copy-Item -Force -Verbose ./bin/Release/net7.0/win-x64/native/* bin/

cd node_binding
Remove-Item -Recurse build

yarn install
yarn build
yarn sanity-check
cd ..