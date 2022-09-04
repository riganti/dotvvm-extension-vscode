import { FallbackWatcher } from "./FallbackWatcher";
import { promises as fs } from 'fs'
import { FSWatcher, watch } from "chokidar";
import { DidChangeWatchedFilesParams, FileChangeType, FileEvent } from 'vscode-languageserver';
import { debounce } from "lodash";
import { join } from "path";
import { Identifier } from "typescript";
import { Logger } from "../logger";

export type PropertyMappingMode = "Exclude" | "Attribute" | "InnerElement" | "Both"

export type DotvvmPropertyInfo = {
    type: string
    dataContextChange?: DataContextChangeAttribute[]
    dataContextManipulation?: any
    isValueInherited?: boolean
    mappingName: string
    mappingMode?: PropertyMappingMode
    defaultValue?: any
    required?: boolean
    onlyBindings?: boolean,
    onlyHardcoded?: boolean,
    isCommand?: boolean,
    commandArguments?: CommandArgumentInfo[],
    isActive?: boolean
    fromCapability?: string
    capabilityPrefix?: string
    isCompileTimeOnly?: boolean
    isAttached?: boolean
}

export type DataContextChangeAttribute = {
    $type: string
    PropertyDependsOn?: string[]
    Order?: number
}

export type DotvvmPropertyGroupInfo = {
    prefixes?: string[]
    prefix?: string
    type: string
    dataContextChange?: any[]
    dataContextManipulation?: any[]
    mappingMode?: PropertyMappingMode
    onlyBindings?: boolean,
    onlyHardcoded?: boolean,
    isCommand?: boolean,
    commandArguments?: CommandArgumentInfo[],
    fromCapability?: string
}

export type DotvvmControlInfo = {
    assembly: string
    baseType?: string
    interfaces?: string[]
    isAbstract?: boolean
    defaultContentProperty?: string
    withoutContent?: boolean
}

type CommandArgumentInfo = { name: string, type: string }

export type CodeControlRegistrationInfo =
    { tagPrefix: string, namespace: string, assembly: string }

export type MarkupControlRegistrationInfo =
    { tagPrefix: string, tagName: string, src: string }

export type ControlRegistrationInfo =
    MarkupControlRegistrationInfo | CodeControlRegistrationInfo

export type DotvvmSerializedConfig = {
    dotvvmVersion: string
    properties: { [control: string]: {
        [property: string]: DotvvmPropertyInfo
    } }
    capabilities: { [control: string]: {
        [property: string]: DotvvmPropertyInfo
    } }
    propertyGroups: {[control: string]: {
        [property: string]: DotvvmPropertyGroupInfo
    } }
    controls: {
        [control: string]: DotvvmControlInfo
    }
    config: {
        markup: {
            controls: ControlRegistrationInfo[],
            assemblies: string[],
            importedNamespaces: { namespace: string, alias?: string }[],
            defaultExtensionParameters: {
                $type: string
                Identifier: string
                Inherit: boolean
                ParameterType: {
                    Type: string
                    Name: string
                    Namespace: string
                    Assembly: string
                    FullName: string
                }
            }[]
        }
        routes: {
            [name: string]: {
                url: string
                virtualPath: string
                defaultValues: { [name: string]: string }
            }
        }
        resources: {
            [resourceType: string]: {
                [resourceName: string]: { }
            }
        }
        //...
    }
}

type DidChangeHandler = (para: DotvvmSerializedConfig) => void;


export class SerializedConfigSeeker {

    private readonly watcher: FSWatcher;

    private undeliveredFileEvents: { type: FileChangeType, path: string }[] = [];

    constructor(workspacePaths: string[], private readonly fileName = "dotvvm_serialized_config.json.tmp") {
        const ignoreRegex = /\.git|node_modules/;
        const glob = `**/${this.fileName}`;
        this.watcher = watch(
            workspacePaths.map((workspacePath) => join(workspacePath, glob)), {
                ignored: (path: string) => ignoreRegex.test(path),
                ignoreInitial: false,
                ignorePermissionErrors: true,
                usePolling: false
            }
        );

        this.watcher
            .on('add', (path) => this.onFSEvent(path, FileChangeType.Created))
            .on('unlink', (path) => this.onFSEvent(path, FileChangeType.Deleted))
            .on('change', (path) => this.onFSEvent(path, FileChangeType.Changed));
        setTimeout(() => this.scheduleTrigger(), 30);
    }

    private onFSEvent(path: string, type: FileChangeType) {
        this.undeliveredFileEvents.push({ type, path });
        this.scheduleTrigger();
    }

    private readonly scheduleTrigger = debounce(() => {
        this.onDidChangeWatchedFiles(this.undeliveredFileEvents)
        this.undeliveredFileEvents = []
    }, 50);

    configs: { [file: string]: DotvvmSerializedConfig } = {};

    cachedStuff: { [key: string]: any } = {};

    private async loadDefaultConfigs(): Promise<void> {
        // TODO: configs for BP, BS, etc.
        Logger.log("Could not find file dotvvm_serialized_config.json.tmp anywhere, using a default config")
        const defaultConfig = await fs.readFile(__dirname +  "/../../../data/defaultConfig-framework.json", "utf8")
        this.configs["defaultConfig-framework"] = JSON.parse(defaultConfig)
    }

    async onDidChangeWatchedFiles(changes: { type: FileChangeType, path: string }[]): Promise<void> {
        const promises = []
        for (const c of changes) {
            if (c.type == FileChangeType.Created || c.type == FileChangeType.Changed) {
                promises.push(fs.readFile(c.path, "utf8").then(x => {
                    this.configs[c.path] = JSON.parse(x);
                }))
            } else if (c.type == FileChangeType.Deleted) {
                delete this.configs[c.path];
            }
        }
        await Promise.all(promises);
        if (Object.keys(this.configs).filter(c => c != "defaultConfig-framework").length == 0) {
            await this.loadDefaultConfigs()
        } else {
            delete this.configs["defaultConfig-framework"]
        }
        this.cachedStuff = {}

        console.log("(re)loaded DotVVM serialized configuration: ", Object.keys(this.configs));
    }

    cached<T>(key: string, getter: (c: DotvvmSerializedConfig[]) => T): T {
        if (this.cachedStuff[key]) {
            return this.cachedStuff[key];
        }
        return this.cachedStuff[key] = getter(Object.values(this.configs));
    }

    dispose(): void {
        this.watcher.close();
    }
}
