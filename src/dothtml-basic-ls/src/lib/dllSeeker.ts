import { FSWatcher, watch } from "chokidar";
import fs from 'fs'
import path from 'path'
import fsp from 'fs/promises'
import glob from 'fast-glob'
import { timeStamp } from "console";
import type { AnalyzerContext } from "lib-dotvvm-spy";
import { Logger } from "../logger";
import { unique } from "../utils";
import _ from "lodash";
import { parseTypeName } from "./dotnetUtils";


var dotvvmspy: undefined | typeof import("lib-dotvvm-spy");
if (process.arch != "x64" || !["win32", "linux"].includes(process.platform)) {
    Logger.error(`Cannot start lib-dotvvm-spy on ${process.platform}-${process.arch}, it currently only works on x64 Linux/Windows. Some features will be disabled.`);
}
else if (process.env["DOTVVM_LS_DISABLE_DOTNET"]) {
    // mainly for testing that LS works even without this.
    Logger.error(`DOTVVM_LS_DISABLE_DOTNET is set, some features will be disabled.`)
}
else {
    try {
        dotvvmspy = require('lib-dotvvm-spy');

        if (dotvvmspy?.sanityCheck() !== true) {
            throw new Error("Sanity check didn't return true");
        }
    } catch(e) {
        Logger.error("lib-dotvvm-spy doesn't work, some features will be disabled", e);
    }
}

export class DllSeeker {
    watchers: { [key: string]: FSWatcher } = {}

    analyzers: { [project: string]: AnalyzerContext } = {}

    static get analyzerOk() { return !!dotvvmspy }

    constructor() {
    }

    public async searchProject(dir: string) {
        if (!dotvvmspy) { return }

        dir = dir.replace('\\', '/').replace(/\/\/+|\/*$/, '/')

        if (Object.keys(this.watchers).some(w => dir.startsWith(w)) ||
            Object.keys(this.analyzers).some(w => w.startsWith(dir))) {
            return
        }

        const projectFiles = await glob('*.*proj', { cwd: dir, onlyFiles: true, absolute: true })
        // if we find a dll with the project name, it will be out main assembly
        const projectNames = projectFiles.map(f => path.basename(f).replace(/\.\w*proj$/, ''))

        // const files = fsp.readdir(path)
        // go into bin directory if that makes sense
        let binDirectory = dir
        if (await fsp.stat(binDirectory + "bin") && (await glob('*.dll', { cwd: binDirectory, onlyFiles: true })).length == 0) {
            binDirectory = binDirectory + "bin/"
        }

        const dlls = await glob('**/*.dll', { cwd: dir, onlyFiles: true, absolute: true })

        Logger.log("Searching for dlls in " + dir, ", found", dlls.length)

        if (dlls.length == 0) {
            return
        }

        const dllPaths = unique(dlls.map(f => path.dirname(f)))
        const dllsWithProjectName = dlls.filter(d => projectNames.some(p => d.endsWith(p + ".dll")))

        if (dllsWithProjectName.length > 0) {
            // newest of the found dlls (to prefer which configuration got compiled last)
            const mainAssembly = _.maxBy(dllsWithProjectName, d => fs.statSync(d).mtime)!
            Logger.log("Found dll with project name", mainAssembly, "creating AnalyzerContext")
            const analyzer = new dotvvmspy.AnalyzerContext(mainAssembly, dllPaths)

            this.analyzers[dir] = analyzer

            // TODO: reload when changes
            return
        }

        Logger.error("Could not find main assembly for project " + dir)
    }

    findImplementations(type: string, options: SymbolSearchFlags & { limit?: number }) {
        if (!dotvvmspy) { return [] }

        const analyzers = Object.values(this.analyzers)
        return unique(analyzers.flatMap(a => {
            const r = a.findImplementations(type, flagsToInt(options), options.limit ?? 1_000_000)

            if (r.length == 0) {
                Logger.log("No implementations found for", type, "in", a.mainAssembly)
            }
            return r.filter(r => !!r)
        }))
    }

    dispose() {
        for (const watcher of Object.values(this.watchers)) {
            watcher.close()
        }
        for (const analyzer of Object.values(this.analyzers)) {
            analyzer.dispose()
        }
        this.watchers = {}
        this.analyzers = {}
    }
}

function flagsToInt(flags: SymbolSearchFlags): number {
    return (flags.public ? 1 : 0) |
           (flags.protected ? 2 : 0) |
           (flags.internal ? 4 : 0) |
           (flags.static ? 8 : 0) |
           (flags.instance ? 0x10 : 0) |
           (flags.nonAbstract ? 0x20 : 0) |
           0;
}

type SymbolSearchFlags = {
    public?: boolean
    protected?: boolean
    internal?: boolean
    static?: boolean
    instance?: boolean
    nonAbstract?: boolean
}
