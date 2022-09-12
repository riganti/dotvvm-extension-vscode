import * as path from 'path';
import * as fs from 'fs'
import {
    commands,
    ExtensionContext,
    extensions,
    IndentAction,
    languages,
    Position,
    ProgressLocation,
    Range,
    TextDocument,
    Uri,
    ViewColumn,
    window,
    workspace,
    WorkspaceEdit
} from 'vscode';
import {
    ExecuteCommandRequest,
    LanguageClientOptions,
    RequestType,
    RevealOutputChannelOn,
    TextDocumentEdit,
    TextDocumentPositionParams,
    WorkspaceEdit as LSWorkspaceEdit
} from 'vscode-languageclient';
import { LanguageClient, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { activateTagClosing } from './html/autoClose';
import { EMPTY_ELEMENTS } from './html/htmlEmptyTagsShared';

namespace TagCloseRequest {
    export const type: RequestType<TextDocumentPositionParams, string, any> = new RequestType(
        'html/tag'
    );
}

export function activateLS(context: ExtensionContext) {
    let lsApi =
        activateLanguageServer(context);

    // This API is considered private and only exposed for experimenting.
    // Interface may change at any time. Use at your own risk!
    return {
        /**
         * As a function, because restarting the server
         * will result in another instance.
         */
        getLanguageServer() {
            return lsApi.getLS();
        }
    };
}

function findServerBinary(searchPaths: (string | undefined)[]) {
    const platform = process.platform == "linux" ? "linux" : process.platform == "darwin" ? "macos" : "win.exe";

    const serverNameCandidates = [
        'dotvvm-language-server-' + process.arch + '-' + platform,
        'dotvvm-language-server-' + platform,
        'dotvvm-language-server',
    ]

    for (const searchPath of searchPaths) {
        if (!searchPath) { continue }

        for (const n of serverNameCandidates) {
            const serverPath = path.join(searchPath, n);
            if (fs.existsSync(serverPath)) {
                return serverPath;
            }
        }
    }
}

function setExecutableFlag(path: string) {
    if (process.platform === 'win32') {
        return;
    }

    const stat = fs.statSync(path)
    if ((stat.mode & 0o111) != 0) {
        return;
    }

    console.log("The language server binary (", path, ") is not executable. Setting the executable flag.")

    try {
        const newMode = (stat.mode & 0o777) | 0o111

        fs.chmodSync(path, newMode);
    } catch (e) {
        console.log("Failed to set the executable flag:", e)
    }
}

export function activateLanguageServer(context: ExtensionContext) {
    const runtimeConfig = workspace.getConfiguration('dotvvm.language-server');

    const { workspaceFolders } = workspace;
    const rootPath = Array.isArray(workspaceFolders) ? workspaceFolders[0].uri.fsPath : undefined;

    const tempLsPath = runtimeConfig.get<string>('ls-path');
    const runWithNode: boolean | undefined = runtimeConfig.get<boolean>('run-with-node');
    // Returns undefined if path is empty string
    // Return absolute path if not already
    const lsPath =
        tempLsPath && tempLsPath.trim() !== ''
            ? path.isAbsolute(tempLsPath)
                ? tempLsPath
                : path.join(rootPath as string, tempLsPath)
            : undefined;

    console.log("DIRNAME=", __dirname)
    

    // const serverModule = eval("require.resolve(lsPath || 'dothtml-basic-ls/bin/server.js')");
    let serverDir
    try
    {
        serverDir = path.dirname(eval("require.resolve((lsPath || 'dothtml-basic-ls/dist') + '/startServer.js')"));
    } catch { }
    const serverPath = findServerBinary([serverDir, __dirname])
    if (!serverPath) {
        throw new Error("Could not find dotvvm-language-server executable.")
    }
    const nodeServerPath = serverDir && path.join(serverDir, 'startServer.js')
    console.log('Loading server from ', serverPath);

    const runExecArgv: string[] = [];
    let port = runtimeConfig.get<number>('port') ?? -1;
    if (port < 0) {
        port = 6009;
    } else {
        console.log('setting port to', port);
        runExecArgv.push(`--inspect=${port}`);
    }
    const debugArgs = ['--nolazy', `--inspect=${port}`, `--enable-source-maps`]

    if (runWithNode === true && !nodeServerPath) {
        throw new Error("Could not find dotvvm-language-server startServer.js")
    }

    if (runWithNode !== false) {
        setExecutableFlag(serverPath);
    }

    const serverOptions: ServerOptions = {
        run: {
            command: runWithNode === true ? "node" : serverPath,
            // module: serverModule,
            transport: TransportKind.pipe,
            args: runWithNode === true && nodeServerPath ? [nodeServerPath, ...runExecArgv] : runExecArgv
            // options: { execArgv: runExecArgv }
        },
        debug: {
            command: runWithNode === false ? serverPath : "node",
            // module: serverModule,
            transport: TransportKind.pipe,
            args: runWithNode === false || !nodeServerPath ? runExecArgv : [...debugArgs, nodeServerPath]
            // options: debugOptions
        }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'dotvvm' }],
        revealOutputChannelOn: RevealOutputChannelOn.Never,
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('{**/*.js,**/*.ts}', false, false, false)
        },
        initializationOptions: {
            configuration: {
                dotvvm: workspace.getConfiguration('dotvvm'),
                css: workspace.getConfiguration('css')
            },
            dontFilterIncompleteCompletions: true, // VSCode filters client side and is smarter at it than us
            isTrusted: (workspace as any).isTrusted
        }
    };

    let ls = createLanguageServer(serverOptions, clientOptions);
	context.subscriptions.push(ls);

    ls.start().then(() => {
        const tagRequestor = (document: TextDocument, position: Position) => {
            const param = ls.code2ProtocolConverter.asTextDocumentPositionParams(
                document,
                position
            );
            return ls.sendRequest(TagCloseRequest.type, param);
        };
        const disposable = activateTagClosing(
            tagRequestor,
            { dotvvm: true },
            'html.autoClosingTags'
        );
        context.subscriptions.push(disposable);
    });

    context.subscriptions.push(
        commands.registerCommand('dotvvm.debug.restartLS', async () => {
            await restartLS(true);
        })
    );

    let restartingLs = false;
    async function restartLS(showNotification: boolean) {
        if (restartingLs) {
            return;
        }

        restartingLs = true;
        await ls.stop();
        ls = createLanguageServer(serverOptions, clientOptions);
        context.subscriptions.push(ls);
        await ls.start();
        if (showNotification) {
            window.showInformationMessage('DotVVM language server restarted.');
        }
        restartingLs = false;
    }

    function getLS() {
        return ls;
    }

    addDidChangeTextDocumentListener(getLS);

    addRenameFileListener(getLS);

    addExtracComponentCommand(getLS, context);

    addDebugCommands(getLS, context);

    languages.setLanguageConfiguration('dotvvm', {
        // This all is pretty much from https://github.com/sveltejs/language-tools/blob/master/packages/svelte-vscode/src/extension.ts
        indentationRules: {
            // Matches a valid opening tag that is:
            //  - Not a doctype
            //  - Not a void element
            //  - Not a closing tag
            //  - Not followed by a closing tag of the same element
            // Or matches `<!--`
            // Or matches open curly brace
            //
            increaseIndentPattern:
                // eslint-disable-next-line max-len, no-useless-escape
                /<(?!\?|(?:area|base|br|col|frame|hr|html|img|input|link|meta|param)\b|[^>]*\/>)([-_\.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/,
            // Matches a closing tag that:
            //  - Follows optional whitespace
            //  - Is not `</html>`
            // Or matches `-->`
            // Or closing curly brace
            //
            // eslint-disable-next-line no-useless-escape
            decreaseIndentPattern: /^\s*(<\/(?!html)[-_\.A-Za-z0-9]+\b[^>]*>|-->|\})/
        },
        // Matches a number or word that either:
        //  - Is a number with an optional negative sign and optional full number
        //    with numbers following the decimal point. e.g `-1.1px`, `.5`, `-.42rem`, etc
        //  - Is a sequence of characters without spaces and not containing
        //    any of the following: `~!@$^&*()=+[{]}\|;:'",.<>/
        //
        wordPattern:
            // eslint-disable-next-line max-len, no-useless-escape
            /(-?\d*\.\d\w*)|([^\`\~\!\@\$\#\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\s]+)/g,
        onEnterRules: [
            {
                // Matches an opening tag that:
                //  - Isn't an empty element
                //  - Is possibly namespaced
                //  - Isn't a void element
                //  - Isn't followed by another tag on the same line
                //
                // eslint-disable-next-line no-useless-escape
                beforeText: new RegExp(
                    `<(?!(?:${EMPTY_ELEMENTS.join(
                        '|'
                    )}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`,
                    'i'
                ),
                // Matches a closing tag that:
                //  - Is possibly namespaced
                //  - Possibly has excess whitespace following tagname
                afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>/i,
                action: { indentAction: IndentAction.IndentOutdent }
            },
            {
                // Matches an opening tag that:
                //  - Isn't an empty element
                //  - Isn't namespaced
                //  - Isn't a void element
                //  - Isn't followed by another tag on the same line
                //
                // eslint-disable-next-line no-useless-escape
                beforeText: new RegExp(
                    `<(?!(?:${EMPTY_ELEMENTS.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`,
                    'i'
                ),
                action: { indentAction: IndentAction.Indent }
            }
        ]
    });

    return {
        getLS
    };
}

function addDidChangeTextDocumentListener(getLS: () => LanguageClient) {
    // Only Svelte file changes are automatically notified through the inbuilt LSP
    // because the extension says it's only responsible for Svelte files.
    // Therefore we need to set this up for TS/JS files manually.
    workspace.onDidChangeTextDocument((evt) => {
        // if (evt.document.languageId === 'typescript' || evt.document.languageId === 'javascript') {
        //     getLS().sendNotification('$/onDidChangeTsOrJsFile', {
        //         uri: evt.document.uri.toString(true),
        //         changes: evt.contentChanges.map((c) => ({
        //             range: {
        //                 start: { line: c.range.start.line, character: c.range.start.character },
        //                 end: { line: c.range.end.line, character: c.range.end.character }
        //             },
        //             text: c.text
        //         }))
        //     });
        // }
    });
}

function addRenameFileListener(getLS: () => LanguageClient) {
    // workspace.onDidRenameFiles(async (evt) => {
    //     const oldUri = evt.files[0].oldUri.toString(true);
    //     const parts = oldUri.split(/\/|\\/);
    //     const lastPart = parts[parts.length - 1];
    //     // If user moves/renames a folder, the URI only contains the parts up to that folder,
    //     // and not files. So in case the URI does not contain a '.', check for imports to update.
    //     if (
    //         lastPart.includes('.') &&
    //         !['.ts', '.js', '.json', '.svelte'].some((ending) => lastPart.endsWith(ending))
    //     ) {
    //         return;
    //     }

    //     window.withProgress(
    //         { location: ProgressLocation.Window, title: 'Updating Imports..' },
    //         async () => {
    //             const editsForFileRename = await getLS().sendRequest<LSWorkspaceEdit | null>(
    //                 '$/getEditsForFileRename',
    //                 // Right now files is always an array with a single entry.
    //                 // The signature was only designed that way to - maybe, in the future -
    //                 // have the possibility to change that. If that ever does, update this.
    //                 // In the meantime, just assume it's a single entry and simplify the
    //                 // rest of the logic that way.
    //                 {
    //                     oldUri,
    //                     newUri: evt.files[0].newUri.toString(true)
    //                 }
    //             );
    //             const edits = editsForFileRename?.documentChanges?.filter(TextDocumentEdit.is);
    //             if (!edits) {
    //                 return;
    //             }

    //             const workspaceEdit = new WorkspaceEdit();
    //             // We need to take into account multiple cases:
    //             // - A Svelte file is moved/renamed
    //             //      -> all updates will be related to that Svelte file, do that here. The TS LS won't even notice the update
    //             // - A TS/JS file is moved/renamed
    //             //      -> all updates will be related to that TS/JS file
    //             //      -> let the TS LS take care of these updates in TS/JS files, do Svelte file updates here
    //             // - A folder with TS/JS AND Svelte files is moved/renamed
    //             //      -> all Svelte file updates are handled here
    //             //      -> all TS/JS file updates that consist of only TS/JS import updates are handled by the TS LS
    //             //      -> all TS/JS file updates that consist of only Svelte import updates are handled here
    //             //      -> all TS/JS file updates that are mixed are handled here, but also possibly by the TS LS
    //             //         if the TS plugin doesn't prevent it. This trades risk of broken updates with certainty of missed updates
    //             edits.forEach((change) => {
    //                 const isTsOrJsFile =
    //                     change.textDocument.uri.endsWith('.ts') ||
    //                     change.textDocument.uri.endsWith('.js');
    //                 const containsSvelteImportUpdate = change.edits.some((edit) =>
    //                     edit.newText.endsWith('.svelte')
    //                 );
    //                 if (isTsOrJsFile && !containsSvelteImportUpdate) {
    //                     return;
    //                 }

    //                 change.edits.forEach((edit) => {
    //                     if (
    //                         isTsOrJsFile &&
    //                         !TsPlugin.isEnabled() &&
    //                         !edit.newText.endsWith('.svelte')
    //                     ) {
    //                         // TS plugin enabled -> all mixed imports are handled here
    //                         // TS plugin disabled -> let TS/JS path updates be handled by the TS LS, Svelte here
    //                         return;
    //                     }

    //                     // Renaming a file should only result in edits of existing files
    //                     workspaceEdit.replace(
    //                         Uri.parse(change.textDocument.uri),
    //                         new Range(
    //                             new Position(edit.range.start.line, edit.range.start.character),
    //                             new Position(edit.range.end.line, edit.range.end.character)
    //                         ),
    //                         edit.newText
    //                     );
    //                 });
    //             });
    //             workspace.applyEdit(workspaceEdit);
    //         }
    //     );
    // });
}

function addDebugCommands(getLS: () => LanguageClient, context: ExtensionContext) {
    const subs1 = commands.registerTextEditorCommand('dotvvm.debug.dump-tree', async (editor) => {
        if (editor?.document?.languageId !== 'dotvvm') {
            return
        }

        const uri = editor.document.uri.toString()
        const range = editor.selection
        getLS().sendRequest(ExecuteCommandRequest.type, {
            command: 'debug_log_tree',
            arguments: [uri, { uri, range }]
        })
    })
    context.subscriptions.push(subs1)
}
function addExtracComponentCommand(getLS: () => LanguageClient, context: ExtensionContext) {
    context.subscriptions.push(
        commands.registerTextEditorCommand('dotvvm.extractComponent', async (editor) => {
            if (editor?.document?.languageId !== 'dotvvm') {
                return;
            }

            // Prompt for new component name
            const options = {
                prompt: 'Component Name: ',
                placeHolder: 'NewComponent'
            };

            window.showInputBox(options).then(async (filePath) => {
                if (!filePath) {
                    return window.showErrorMessage('No component name');
                }

                const uri = editor.document.uri.toString();
                const range = editor.selection;
                getLS().sendRequest(ExecuteCommandRequest.type, {
                    command: 'extract_to_dotvvm_component',
                    arguments: [uri, { uri, range, filePath }]
                });
            });
        })
    );
}

function createLanguageServer(serverOptions: ServerOptions, clientOptions: LanguageClientOptions) {
    return new LanguageClient('dotvvm', 'DotVVM', serverOptions, clientOptions);
}
