import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class DotvvmCompletionProvider {
    private metadata;
    private projectFiles;

    constructor() {
        this.metadata = {};
        this.projectFiles = {};
        this.loadMetadataFile("dotvvm.json", "DotVVM.Framework.Controls", "dot", "DotVVM");
        this.loadMetadataFile("bootstrap.json", "DotVVM.Framework.Controls.Bootstrap", "bs","DotVVM.Controls.Bootstrap");
        this.loadMetadataFile("businesspack.json", "DotVVM.BusinessPack.Controls", "bp","DotVVM.BusinessPack");
    }

    loadMetadataFile = (filename, controlNamespace, tagPrefix, packageName) =>{
        // parse JSON metadata files
        var _this = this;
        var metadataPath = path.resolve(__dirname, "../../metadata/" + filename);
        fs.readFile(metadataPath, 'utf8', (err, data) => {
            if (err) {
                throw err;
            }
            var result = JSON.parse(data);
            var metadata = _this.processMetadataFile(result, controlNamespace, tagPrefix, packageName);
            _this.metadata[tagPrefix] = metadata;
        });
    }

    processMetadataFile = (data, controlNamespace, tagPrefix,packageName) => {
        var result = {
            controls: {},
            controlNamespace: controlNamespace,
            tagPrefix: tagPrefix,
            packageName : packageName
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

    provideCompletionItems = (document, position, token) => {

        if (this.getTextBeforePosition(document, position, 1) === "<") {
            var result = this.filterElementCompletionItemsByProject(this.getElementCompletionItems(""), document.fileName);
            return result; 
        }

        // suggest elements with specified tag prefixb
        for (let prefix in this.metadata) {
            if (this.getTextBeforePosition(document, position, prefix.length + 2) === ("<" + prefix + ":")) {
                return this.getElementCompletionItems(prefix); 
            }
        } 

        // suggest attributes
        if (this.getTextBeforePosition(document, position, 1) === " " && !this.isCompletedElementOnLine(document,position)) {
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

    getElementCompletionItems = (filterTagPrefix) => {
        var completionItems = [];
        for (let prefix in this.metadata) {
            if (filterTagPrefix && prefix !== filterTagPrefix) {
                continue;
            }
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

    getAttributeCompletionItems = (fullTagName) => {


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

    filterElementCompletionItemsByProject = (items, fullPath) => {
        // find or load project file and included libraries
        var projectFileName = null;

        for (let projectFile in this.projectFiles) {
            var projectDir = path.dirname(projectFile);
            if (fullPath.indexOf(projectDir) === 0) {
                projectFileName = projectFile;
                break;
            }
        }

        let project;
        if(projectFileName !== null){
            project = this.detectInstalledLibraries(projectFileName)
        }
        else{
            project = this.detectInstalledLibraries(this.findProjectFile(fullPath));
        }
        
        // filter the results
        return items.filter(i => project.tagPrefixes.indexOf(i.label.substring(0, i.label.indexOf(":")).toLowerCase()) >= 0);
    }

    getTextBeforePosition = (document, position, length) => {
        if (position.character - length < 0) {
            return "";
        };
        var range = new vscode.Range(new vscode.Position(position.line, position.character - length), position);
        return document.getText(range);
    }

    isCompletedElementOnLine = (document,position) => {
        var range = new vscode.Range(new vscode.Position(position.line, 0), position);
        return document.getText(range).match("/>");
    };

    findProjectFile = (fullPath) =>{
        // finds the csproj file in the same directory or in parent directories
        var parentDir = path.dirname(fullPath);
        var dir = fs.readdirSync(parentDir);
        var projectFile = dir.find(f => f.match(/\.csproj/i) !== null);
        if (projectFile) {
            return path.join(parentDir, projectFile);
        }
        
        if (parentDir != fullPath) {
            return this.findProjectFile(parentDir);
        }
        return;
    }

    detectInstalledLibraries= (projectFile) => {
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
                if (data.indexOf(_this.metadata[library].packageName) >= 0) {
                    result.push(library);
                }
            }
        }
        return _this.projectFiles[projectFile] = {
            tagPrefixes: result
        };
    }
}