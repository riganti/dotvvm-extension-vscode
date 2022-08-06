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
import { IPCMessageReader, IPCMessageWriter, createConnection } from 'vscode-languageserver/node';
import { DiagnosticsManager } from './lib/DiagnosticsManager';
import { Document, DocumentManager } from './lib/documents';
import { getSemanticTokenLegends } from './lib/semanticToken/semanticTokenLegend';
import { Logger } from './logger';
import { LSConfigManager } from './ls-config';
import {
    AppCompletionItem,
    CSSPlugin,
    HTMLPlugin,
    PluginHost,
    SveltePlugin,
    OnWatchFileChangesPara,
} from './plugins';
import { debounceThrottle, isNotNullOrUndefined, normalizeUri, urlToPath } from './utils';
import { FallbackWatcher } from './lib/FallbackWatcher';
import { createLanguageServices } from './plugins/css/service';
import { FileSystemProvider } from './plugins/css/FileSystemProvider';

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
export function startServer(options?: LSOptions) {
    let connection = options?.connection;
    if (!connection) {
        if (process.argv.includes('--stdio')) {
            console.log = (...args: any[]) => {
                console.warn(...args);
            };
            connection = createConnection(process.stdin, process.stdout);
        } else {
            connection = createConnection(
                new IPCMessageReader(process),
                new IPCMessageWriter(process)
            );
        }
    }

    if (options?.logErrorsOnly !== undefined) {
        Logger.setLogErrorsOnly(options.logErrorsOnly);
    }

    const docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text)
    );
    const configManager = new LSConfigManager();
    const pluginHost = new PluginHost(docManager);
    let watcher: FallbackWatcher | undefined;

    connection.onInitialize((evt) => {
        const workspaceUris = evt.workspaceFolders?.map((folder) => folder.uri.toString()) ?? [
            evt.rootUri ?? ''
        ];
        Logger.log('Initialize language server at ', workspaceUris.join(', '));
        if (workspaceUris.length === 0) {
            Logger.error('No workspace path set');
        }

        if (!evt.capabilities.workspace?.didChangeWatchedFiles) {
            const workspacePaths = workspaceUris.map(urlToPath).filter(isNotNullOrUndefined);
            watcher = new FallbackWatcher('**/*.{ts,js}', workspacePaths);
            watcher.onDidChangeWatchedFiles(onDidChangeWatchedFiles);
        }

        const isTrusted: boolean = evt.initializationOptions?.isTrusted ?? true;
        configManager.updateIsTrusted(isTrusted);
        if (!isTrusted) {
            Logger.log('Workspace is not trusted, running with reduced capabilities.');
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
        pluginHost.register((new SveltePlugin(configManager)));
        pluginHost.register(new HTMLPlugin(docManager, configManager));

        const cssLanguageServices = createLanguageServices({
            clientCapabilities: evt.capabilities,
            fileSystemProvider: new FileSystemProvider()
        });
        const workspaceFolders = evt.workspaceFolders ?? [{ name: '', uri: evt.rootUri ?? '' }];
        pluginHost.register(
            new CSSPlugin(docManager, configManager, workspaceFolders, cssLanguageServices)
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
                              'extract_to_dotvvm_component'
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
        watcher?.dispose();
    });

    connection.onRenameRequest((req) =>
        pluginHost.rename(req.textDocument, req.position, req.newName)
    );
    connection.onPrepareRename((req) => pluginHost.prepareRename(req.textDocument, req.position));

    connection.onDidChangeConfiguration(({ settings }) => {
        configManager.update(settings.svelte?.plugin);
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

    connection.onDidChangeWatchedFiles(onDidChangeWatchedFiles);
    function onDidChangeWatchedFiles(para: DidChangeWatchedFilesParams) {
        const onWatchFileChangesParas = para.changes
            .map((change) => ({
                fileName: urlToPath(change.uri),
                changeType: change.type
            }))
            .filter((change): change is OnWatchFileChangesPara => !!change.fileName);

        pluginHost.onWatchFileChanges(onWatchFileChangesParas);

        updateAllDiagnostics();
    }

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
        debounceThrottle(async (document: Document) => diagnosticsManager.update(document), 750)
    );
    docManager.on('documentClose', (document: Document) =>
        diagnosticsManager.removeDiagnostics(document)
    );

    // The language server protocol does not have a specific "did rename/move files" event,
    // so we create our own in the extension client and handle it here
    connection.onRequest('$/getEditsForFileRename', async (fileRename: RenameFile) =>
        pluginHost.updateImports(fileRename)
    );

    connection.onRequest('$/getFileReferences', async (uri: string) => {
        return pluginHost.fileReferences(uri);
    });

    connection.onRequest('$/getComponentReferences', async (uri: string) => {
        return pluginHost.findComponentReferences(uri);
    });

    connection.listen();
}
