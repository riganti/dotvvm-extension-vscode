import {
    ApplyWorkspaceEditParams,
    ApplyWorkspaceEditRequest,
    CodeActionKind,
    DocumentUri,
    Connection,
    MessageType,
    RenameFile,
    RequestType,
    ShowMessageNotification,
    TextDocumentIdentifier,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    WorkspaceEdit,
    SemanticTokensRequest,
    SemanticTokensRangeRequest,
    DidChangeWatchedFilesParams,
    LinkedEditingRangeRequest
} from 'vscode-languageserver';
import { IPCMessageReader, IPCMessageWriter, createConnection, SocketMessageReader, SocketMessageWriter } from 'vscode-languageserver/node';
import { DiagnosticsManager } from './lib/DiagnosticsManager';
import { DotvvmDocument, DocumentManager } from './lib/documents';
import { getSemanticTokenLegends } from './lib/semanticToken/semanticTokenLegend';
import { Logger } from './logger';
import { LSConfigManager } from './ls-config';
import {
    AppCompletionItem,
    CSSPlugin,
    HTMLPlugin,
    PluginHost,
    DotvvmPlugin,
    OnWatchFileChangesPara,
} from './plugins';
import { debounceThrottle, isNotNullOrUndefined, normalizeUri, urlToPath } from './utils';
import { FallbackWatcher } from './lib/FallbackWatcher';
import { FileSystemProvider } from './plugins/css/FileSystemProvider';
import { SerializedConfigSeeker } from './lib/serializedConfigSeeker';
import * as parserUtils from './lib/parserutils';
import net from 'net'
import { getCSSLanguageService } from 'vscode-css-languageservice';

namespace TagCloseRequest {
    export const type: RequestType<TextDocumentPositionParams, string | null, any> =
        new RequestType('html/tag');
}

export interface LSOptions {
    /**
     * If you have a connection already that the ls should use, pass it in.
     * Else the connection will be created from `process`.
     */
    connection?: Connection;
    /**
     * If you want only errors getting logged.
     * Defaults to false.
     */
    logErrorsOnly?: boolean;
}

/**
 * Starts the language server.
 *
 * @param options Options to customize behavior
 */
export async function startServer(options?: LSOptions) {
    if (options?.logErrorsOnly !== undefined) {
        Logger.setLogErrorsOnly(options.logErrorsOnly);
    }
    parserUtils.init()
    console.log("argv:", process.argv)
    let connection = options?.connection;
    if (!connection) {
        if (process.argv.includes('--stdio')) {
            console.log = (...args: any[]) => {
                console.warn(...args);
            };
            connection = createConnection(process.stdin, process.stdout);
        } else if (process.argv.some(o => o.startsWith("--pipe="))) {
            const pipeName = process.argv.find(o => o.startsWith("--pipe="))!.split("=")[1];
            const socket = net.connect(pipeName)
            console.log("Connecting to pipe:", pipeName);
            connection = createConnection(
                new SocketMessageReader(socket),
                new SocketMessageWriter(socket)
            );
        } else {
            connection = createConnection(
                new IPCMessageReader(process),
                new IPCMessageWriter(process)
            );
        }
    }

    const docManager = new DocumentManager(
        (textDocument) => new DotvvmDocument(textDocument.uri, textDocument.text)
    );
    const configManager = new LSConfigManager();
    const pluginHost = new PluginHost(docManager);
    let watcher: FallbackWatcher | undefined;
    let configSeeker: SerializedConfigSeeker | undefined;

    connection.onInitialize((evt) => {
        const workspaceUris = evt.workspaceFolders!.map((folder) => folder.uri.toString());
        Logger.log('Initialize language server at ', workspaceUris.join(', '), "node version: ", process.version);
        if (workspaceUris.length === 0) {
            Logger.error('No workspace path set');
        }
        const workspacePaths = workspaceUris.map(urlToPath).filter(isNotNullOrUndefined);
        configSeeker = new SerializedConfigSeeker(workspacePaths);

        const isTrusted: boolean = evt.initializationOptions?.isTrusted ?? true;
        configManager.updateIsTrusted(isTrusted);
        if (!isTrusted) {
            Logger.log("Workspace is not trusted, we basically don't care.");
        }

        // Backwards-compatible way of setting initialization options (first `||` is the old style)
        configManager.update(
                evt.initializationOptions?.config ||
                {}
        );
        configManager.updateEmmetConfig(
            evt.initializationOptions?.configuration?.emmet ||
                evt.initializationOptions?.emmetConfig ||
                {}
        );
        configManager.updateCssConfig(evt.initializationOptions?.configuration?.css);

        pluginHost.initialize({
            filterIncompleteCompletions:
                !evt.initializationOptions?.dontFilterIncompleteCompletions,
            definitionLinkSupport: !!evt.capabilities.textDocument?.definition?.linkSupport
        });

        // Order of plugin registration matters for FirstNonNull, which affects for example hover info
        // pluginHost.register(new HTMLPlugin(docManager, configManager, configSeeker));
        pluginHost.register(new DotvvmPlugin(configSeeker, configManager));

        const cssLanguage = getCSSLanguageService({
            clientCapabilities: evt.capabilities,
            fileSystemProvider: new FileSystemProvider()
        });
        const workspaceFolders = evt.workspaceFolders ?? [{ name: '', uri: evt.rootUri ?? '' }];
        pluginHost.register(
            new CSSPlugin(docManager, configManager, workspaceFolders, cssLanguage)
        );


        const clientSupportApplyEditCommand = !!evt.capabilities.workspace?.applyEdit;
        const clientCodeActionCapabilities = evt.capabilities.textDocument?.codeAction;
        const clientSupportedCodeActionKinds =
            clientCodeActionCapabilities?.codeActionLiteralSupport?.codeActionKind.valueSet;

        return {
            capabilities: {
                textDocumentSync: {
                    openClose: true,
                    change: TextDocumentSyncKind.Incremental,
                    save: {
                        includeText: false
                    }
                },
                hoverProvider: true,
                completionProvider: {
                    resolveProvider: true,
                    triggerCharacters: [
                        '.',
                        '"',
                        "'",
                        '`',
                        '/',
                        '@',
                        '<',

                        // Emmet
                        '>',
                        '*',
                        '#',
                        '$',
                        '+',
                        '^',
                        '(',
                        '[',
                        '@',
                        '-',
                        // No whitespace because
                        // it makes for weird/too many completions
                        // of other completion providers

                        // Svelte
                        ':',
                        '{'
                    ]
                },
                documentFormattingProvider: true,
                colorProvider: true,
                documentSymbolProvider: true,
                definitionProvider: true,
                codeActionProvider: clientCodeActionCapabilities?.codeActionLiteralSupport
                    ? {
                          codeActionKinds: [
                              CodeActionKind.QuickFix,
                              CodeActionKind.SourceOrganizeImports,
                              ...(clientSupportApplyEditCommand ? [CodeActionKind.Refactor] : [])
                          ].filter(
                              clientSupportedCodeActionKinds &&
                                  evt.initializationOptions?.shouldFilterCodeActionKind
                                  ? (kind) => clientSupportedCodeActionKinds.includes(kind)
                                  : () => true
                          )
                      }
                    : true,
                executeCommandProvider: clientSupportApplyEditCommand
                    ? {
                          commands: [
                              'extract_to_dotvvm_component',
                              'debug_log_tree'
                          ]
                      }
                    : undefined,
                renameProvider: evt.capabilities.textDocument?.rename?.prepareSupport
                    ? { prepareProvider: true }
                    : true,
                referencesProvider: true,
                selectionRangeProvider: true,
                signatureHelpProvider: {
                    triggerCharacters: ['(', ',', '<'],
                    retriggerCharacters: [')']
                },
                semanticTokensProvider: {
                    legend: getSemanticTokenLegends(),
                    range: true,
                    full: true
                },
                linkedEditingRangeProvider: true,
                implementationProvider: true,
                typeDefinitionProvider: true
            }
        };
    });

    connection.onExit(() => {
        watcher?.dispose()
        configSeeker?.dispose()
    });

    connection.onRenameRequest((req) =>
        pluginHost.rename(req.textDocument, req.position, req.newName)
    );
    connection.onPrepareRename((req) => pluginHost.prepareRename(req.textDocument, req.position));

    connection.onDidChangeConfiguration(({ settings }) => {
        configManager.update(settings.dotvvm);
        configManager.updateEmmetConfig(settings.emmet);
        configManager.updateCssConfig(settings.css);
    });

    connection.onDidOpenTextDocument((evt) => {
        docManager.openDocument(evt.textDocument);
        docManager.markAsOpenedInClient(evt.textDocument.uri);
    });

    connection.onDidCloseTextDocument((evt) => docManager.closeDocument(evt.textDocument.uri));
    connection.onDidChangeTextDocument((evt) => {
        docManager.updateDocument(evt.textDocument, evt.contentChanges);
        pluginHost.didUpdateDocument();
    });
    connection.onHover((evt) => pluginHost.doHover(evt.textDocument, evt.position));
    connection.onCompletion((evt, cancellationToken) =>
        pluginHost.getCompletions(evt.textDocument, evt.position, evt.context, cancellationToken)
    );
    connection.onDocumentFormatting((evt) =>
        pluginHost.formatDocument(evt.textDocument, evt.options)
    );
    connection.onRequest(TagCloseRequest.type, (evt) =>
        pluginHost.doTagComplete(evt.textDocument, evt.position)
    );
    connection.onDocumentColor((evt) => pluginHost.getDocumentColors(evt.textDocument));
    connection.onColorPresentation((evt) =>
        pluginHost.getColorPresentations(evt.textDocument, evt.range, evt.color)
    );
    connection.onDocumentSymbol((evt, cancellationToken) =>
        pluginHost.getDocumentSymbols(evt.textDocument, cancellationToken)
    );
    connection.onDefinition((evt) => pluginHost.getDefinitions(evt.textDocument, evt.position));
    connection.onReferences((evt) =>
        pluginHost.findReferences(evt.textDocument, evt.position, evt.context)
    );

    connection.onCodeAction((evt, cancellationToken) =>
        pluginHost.getCodeActions(evt.textDocument, evt.range, evt.context, cancellationToken)
    );
    connection.onExecuteCommand(async (evt) => {
        const result = await pluginHost.executeCommand(
            { uri: evt.arguments?.[0] },
            evt.command,
            evt.arguments
        );
        if (WorkspaceEdit.is(result)) {
            const edit: ApplyWorkspaceEditParams = { edit: result };
            connection?.sendRequest(ApplyWorkspaceEditRequest.type.method, edit);
        } else if (result) {
            connection?.sendNotification(ShowMessageNotification.type.method, {
                message: result,
                type: MessageType.Error
            });
        }
    });

    connection.onCompletionResolve((completionItem, cancellationToken) => {
        const data = (completionItem as AppCompletionItem).data as TextDocumentIdentifier;

        if (!data) {
            return completionItem;
        }

        return pluginHost.resolveCompletion(data, completionItem, cancellationToken);
    });

    connection.onSignatureHelp((evt, cancellationToken) =>
        pluginHost.getSignatureHelp(evt.textDocument, evt.position, evt.context, cancellationToken)
    );

    connection.onSelectionRanges((evt) =>
        pluginHost.getSelectionRanges(evt.textDocument, evt.positions)
    );

    connection.onImplementation((evt) =>
        pluginHost.getImplementation(evt.textDocument, evt.position)
    );

    connection.onTypeDefinition((evt) =>
        pluginHost.getTypeDefinition(evt.textDocument, evt.position)
    );

    const diagnosticsManager = new DiagnosticsManager(
        connection.sendDiagnostics,
        docManager,
        pluginHost.getDiagnostics.bind(pluginHost)
    );

    const updateAllDiagnostics = debounceThrottle(() => diagnosticsManager.updateAll(), 1000);

    connection.onDidSaveTextDocument(updateAllDiagnostics);

    connection.onRequest(SemanticTokensRequest.type, (evt, cancellationToken) =>
        pluginHost.getSemanticTokens(evt.textDocument, undefined, cancellationToken)
    );
    connection.onRequest(SemanticTokensRangeRequest.type, (evt, cancellationToken) =>
        pluginHost.getSemanticTokens(evt.textDocument, evt.range, cancellationToken)
    );

    connection.onRequest(
        LinkedEditingRangeRequest.type,
        async (evt) => await pluginHost.getLinkedEditingRanges(evt.textDocument, evt.position)
    );

    docManager.on(
        'documentChange',
        debounceThrottle(async (document: DotvvmDocument) => diagnosticsManager.update(document), 750)
    );
    docManager.on('documentClose', (document: DotvvmDocument) =>
        diagnosticsManager.removeDiagnostics(document)
    );

    connection.onRequest('$/getFileReferences', async (uri: string) => {
        return pluginHost.fileReferences(uri);
    });

    connection.onRequest('$/getComponentReferences', async (uri: string) => {
        return pluginHost.findComponentReferences(uri);
    });

    connection.listen();
}
