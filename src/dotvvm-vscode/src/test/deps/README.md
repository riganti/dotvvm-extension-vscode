The C# grammar is required only to run the grammar tests - it comes from here: https://raw.githubusercontent.com/dotnet/csharp-tmLanguage/

To update the grammer, you need to:
* download it from the repo
* convert it from YML to JSON (via `npx js-yaml src/test/deps/csharp.tmLanguage.yml > src/test/deps/csharp.tmLanguage.json`)
* convert it to UTF-8 without BOM.
