let vscode = require('vscode');
let fs = require('fs');
let path = require('path');

class DotvvmCompletionProvider {

    constructor() {
        this.metadata = {};
        this.projectFiles = {};
        this.loadMetadataFile("dotvvm.json", "DotVVM.Framework.Controls", "dot");
        this.loadMetadataFile("bootstrap.json", "DotVVM.Framework.Controls.Bootstrap", "bs");
        this.loadMetadataFile("businesspack.json", "DotVVM.BusinessPack", "bp");
    }


    loadMetadataFile(filename, controlNamespace, tagPrefix) {
        // parse JSON metadata files
        var _this = this;
        fs.readFile(path.resolve(__dirname, "../metadata/" + filename), 'utf8', function (err, data) {
            if (err) {
                throw err;
            }

            var result = JSON.parse(data);
            var metadata = _this.processMetadataFile(result, controlNamespace, tagPrefix);
            _this.metadata[tagPrefix] = metadata;
        });
    }

    processMetadataFile(data, controlNamespace, tagPrefix) {
        var result = {
            controls: {},
            controlNamespace: controlNamespace,
            tagPrefix: tagPrefix
        };
        
        // load all controls
        for (let i = 0; i < data.length; i++) {
            if (data[i].Namespace === controlNamespace && !data[i].IsAbstract) {
                var properties = {};
                var contentProperties = {};

                // load all properties
                for (let j = 0; j < data[i].Properties.length; j++) {
                    if (data[i].Properties[j].MarkupOptions.MappingMode == 1
                        || data[i].Properties[j].MarkupOptions.MappingMode == 3) {
                        properties[data[i].Properties[j].Name] = {};
                    }
                    else if (data[i].Properties[j].MarkupOptions.MappingMode == 2) {
                        contentProperties[data[i].Properties[j].Name] = {};
                    }
                }

                result.controls[data[i].Name] = { 
                    properties: properties,
                    contentProperties: contentProperties
                };
            }
        }

        return result;
    }

    provideCompletionItems(document, position, token) {
        // suggest all elements
        if (this.getTextBeforePosition(document, position, 1) === "<") {
            return this.filterElementCompletionItemsByProject(this.getElementCompletionItems(), document.fileName); 
        }
        
        // suggest elements with specified tag prefix
        for (let prefix in this.metadata) {
            if (this.getTextBeforePosition(document, position, prefix.length + 2) === ("<" + prefix + ":")) {
                return this.getElementCompletionItems(prefix); 
            }
        } 

        // suggest attributes
        if (this.getTextBeforePosition(document, position, 1) == " ") {
            // find last element name
            var startPosition = new vscode.Position(Math.max(0, position.line - 5), 0);
            var text = document.getText(new vscode.Range(startPosition, position));
            var lastTagPosition = text.lastIndexOf("<");
            if (lastTagPosition >= 0) {
                text = text.substring(lastTagPosition + 1);
                var spacePosition = text.indexOf(" ");
                if (spacePosition >= 0) {
                    text = text.substring(0, spacePosition);
                    return this.getAttributeCompletionItems(text);
                }
            }
        }

        return [];
    }

    resolveCompletionItem(item, token) {
        return item;
    }

    getElementCompletionItems(filterTagPrefix) {
        var completionItems = [];
        for (let prefix in this.metadata) {
            if (filterTagPrefix && prefix !== filterTagPrefix) continue;

            for (let control in this.metadata[prefix].controls) {
                let item = new vscode.CompletionItem(prefix + ":" + control);
                if (filterTagPrefix) {
                    item.insertText = control + " ";
                }
                else {
                    item.insertText = prefix + ":" + control + " ";
                }
                completionItems.push(item);
            }
        }
        return completionItems;
    }

    getAttributeCompletionItems(fullTagName) {
        var parts = fullTagName.split(":");
        if (parts.length !== 2) {
            return [];
        }

        var library = this.metadata[parts[0]];
        if (!library) {
            return [];
        }

        var control = library.controls[parts[1]];
        if (!control) {
            return [];
        }

        var completionItems = [];
        for (let property in control.properties) {
            let item = new vscode.CompletionItem(property);
            item.insertText = property + "=";
            completionItems.push(item);
        }
        return completionItems;
    }

    getTextBeforePosition(document, position, length) {
        if (position.character - length < 0) return "";

        var range = new vscode.Range(new vscode.Position(position.line, position.character - length), position);
        return document.getText(range);
    }

    filterElementCompletionItemsByProject(items, fullPath) {
        // find or load project file and included libraries
        var projectFileName = null;
        for (let projectFile in this.projectFiles) {
            var projectDir = path.dirname(projectFile);
            if (fullPath.indexOf(projectDir) === 0) {
                projectFileName = projectFile;
                break;
            }
        }        
        var project = this.detectInstalledLibraries(projectFileName || this.findProjectFile(fullPath));

        // filter the results
        return items.filter(i => project.tagPrefixes.indexOf(i.label.substring(0, i.label.indexOf(":")).toLowerCase()) >= 0);
    }

    findProjectFile(fullPath) {
        // finds the csproj file in the same directory or in parent directories
        var parentDir = path.dirname(fullPath);
        var projectFile = fs.readdirSync(parentDir).find(f => f.match(/\.csproj/i));
        if (projectFile) {
            return path.join(parentDir, projectFile);
        }
        
        if (parentDir != fullPath) {
            return this.findProjectFile(parentDir);
        }
        return;
    }

    detectInstalledLibraries(projectFile) {
        if (!projectFile) {
            // project file not found, return default configuration
            return {
                tagPrefixes: ["dot"]
            };
        }

        if (this.projectFiles[projectFile]) {
            // project file found in cache
            return this.projectFiles[projectFile];
        }
        
        // load project file
        var _this = this;
        var data = fs.readFileSync(projectFile, 'utf8');

        // find package or assembly references
        var result = ["dot"];
        for (let library in _this.metadata) {
            if (library !== "dot") {
                if (data.indexOf(_this.metadata[library].controlNamespace) >= 0) {
                    result.push(library);
                }
            }
        }
        return _this.projectFiles[projectFile] = {
            tagPrefixes: result
        };
    }
}

module.exports = DotvvmCompletionProvider;