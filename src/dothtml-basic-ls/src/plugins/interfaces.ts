import {
    CancellationToken,
    CompletionContext,
    FileChangeType,
    LinkedEditingRanges,
    SemanticTokens,
    SignatureHelpContext,
    TextDocumentContentChangeEvent
} from 'vscode-languageserver';
import {
    CodeAction,
    CodeActionContext,
    Color,
    ColorInformation,
    ColorPresentation,
    CompletionItem,
    CompletionList,
    DefinitionLink,
    Diagnostic,
    FormattingOptions,
    Hover,
    Location,
    Position,
    Range,
    ReferenceContext,
    SymbolInformation,
    TextDocumentIdentifier,
    TextEdit,
    WorkspaceEdit,
    SelectionRange,
    SignatureHelp
} from 'vscode-languageserver-types';
import { DotvvmDocument } from '../lib/documents';

export type Resolvable<T> = T | Promise<T>;

export interface AppCompletionItem<T extends TextDocumentIdentifier = any> extends CompletionItem {
    data?: T;
}

export interface AppCompletionList<T extends TextDocumentIdentifier = any> extends CompletionList {
    items: Array<AppCompletionItem<T>>;
}

export interface DiagnosticsProvider {
    getDiagnostics(document: DotvvmDocument): Resolvable<Diagnostic[]>;
}

export interface HoverProvider {
    doHover(document: DotvvmDocument, position: Position): Resolvable<Hover | null>;
}

export interface CompletionsProvider<T extends TextDocumentIdentifier = any> {
    getCompletions(
        document: DotvvmDocument,
        position: Position,
        completionContext?: CompletionContext,
        cancellationToken?: CancellationToken
    ): Resolvable<AppCompletionList<T> | null>;

    resolveCompletion?(
        document: DotvvmDocument,
        completionItem: AppCompletionItem<T>,
        cancellationToken?: CancellationToken
    ): Resolvable<AppCompletionItem<T>>;
}

export interface FormattingProvider {
    formatDocument(document: DotvvmDocument, options: FormattingOptions): Resolvable<TextEdit[]>;
}

export interface TagCompleteProvider {
    doTagComplete(document: DotvvmDocument, position: Position): Resolvable<string | null>;
}

export interface DocumentColorsProvider {
    getDocumentColors(document: DotvvmDocument): Resolvable<ColorInformation[]>;
}

export interface ColorPresentationsProvider {
    getColorPresentations(
        document: DotvvmDocument,
        range: Range,
        color: Color
    ): Resolvable<ColorPresentation[]>;
}

export interface DocumentSymbolsProvider {
    getDocumentSymbols(
        document: DotvvmDocument,
        cancellationToken?: CancellationToken
    ): Resolvable<SymbolInformation[]>;
}

export interface DefinitionsProvider {
    getDefinitions(document: DotvvmDocument, position: Position): Resolvable<DefinitionLink[]>;
}

export interface BackwardsCompatibleDefinitionsProvider {
    getDefinitions(
        document: DotvvmDocument,
        position: Position
    ): Resolvable<DefinitionLink[] | Location[]>;
}

export interface CodeActionsProvider {
    getCodeActions(
        document: DotvvmDocument,
        range: Range,
        context: CodeActionContext,
        cancellationToken?: CancellationToken
    ): Resolvable<CodeAction[]>;
    executeCommand?(
        document: DotvvmDocument,
        command: string,
        args?: any[]
    ): Resolvable<WorkspaceEdit | string | null>;
}

export interface FileRename {
    oldUri: string;
    newUri: string;
}

export interface RenameProvider {
    rename(
        document: DotvvmDocument,
        position: Position,
        newName: string
    ): Resolvable<WorkspaceEdit | null>;
    prepareRename(document: DotvvmDocument, position: Position): Resolvable<Range | null>;
}

export interface FindReferencesProvider {
    findReferences(
        document: DotvvmDocument,
        position: Position,
        context: ReferenceContext
    ): Promise<Location[] | null>;
}

export interface FileReferencesProvider {
    fileReferences(uri: string): Promise<Location[] | null>;
}

export interface FindComponentReferencesProvider {
    findComponentReferences(uri: string): Promise<Location[] | null>;
}

export interface SignatureHelpProvider {
    getSignatureHelp(
        document: DotvvmDocument,
        position: Position,
        context: SignatureHelpContext | undefined,
        cancellationToken?: CancellationToken
    ): Resolvable<SignatureHelp | null>;
}

export interface SelectionRangeProvider {
    getSelectionRange(document: DotvvmDocument, position: Position): Resolvable<SelectionRange | null>;
}

export interface SemanticTokensProvider {
    getSemanticTokens(textDocument: DotvvmDocument, range?: Range): Resolvable<SemanticTokens | null>;
}

export interface LinkedEditingRangesProvider {
    getLinkedEditingRanges(
        document: DotvvmDocument,
        position: Position
    ): Resolvable<LinkedEditingRanges | null>;
}

export interface ImplementationProvider {
    getImplementation(document: DotvvmDocument, position: Position): Resolvable<Location[] | null>;
}

export interface TypeDefinitionProvider {
    getTypeDefinition(document: DotvvmDocument, position: Position): Resolvable<Location[] | null>;
}

export interface OnWatchFileChangesPara {
    fileName: string;
    changeType: FileChangeType;
}

export interface OnWatchFileChanges {
    onWatchFileChanges(onWatchFileChangesParas: OnWatchFileChangesPara[]): void;
}

export interface UpdateTsOrJsFile {
    updateTsOrJsFile(fileName: string, changes: TextDocumentContentChangeEvent[]): void;
}

type ProviderBase = DiagnosticsProvider &
    HoverProvider &
    CompletionsProvider &
    FormattingProvider &
    TagCompleteProvider &
    DocumentColorsProvider &
    ColorPresentationsProvider &
    DocumentSymbolsProvider &
    CodeActionsProvider &
    FindReferencesProvider &
    FileReferencesProvider &
    FindComponentReferencesProvider &
    RenameProvider &
    SignatureHelpProvider &
    SemanticTokensProvider &
    LinkedEditingRangesProvider &
    ImplementationProvider &
    TypeDefinitionProvider;

export type LSProvider = ProviderBase & BackwardsCompatibleDefinitionsProvider;

export interface LSPProviderConfig {
    /**
     * Whether or not completion lists that are marked as imcomplete
     * should be filtered server side.
     */
    filterIncompleteCompletions: boolean;
    /**
     * Whether or not getDefinitions supports the LocationLink interface.
     */
    definitionLinkSupport: boolean;
}

export type Plugin = Partial<
    ProviderBase &
        DefinitionsProvider &
        OnWatchFileChanges &
        SelectionRangeProvider &
        UpdateTsOrJsFile
> & { __name: string };
