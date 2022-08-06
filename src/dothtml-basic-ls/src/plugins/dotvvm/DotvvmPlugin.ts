import {
    CancellationToken,
    CodeAction,
    CodeActionContext,
    CompletionContext,
    CompletionList,
    Diagnostic,
    FormattingOptions,
    Hover,
    Position,
    Range,
    SelectionRange,
    TextEdit,
    WorkspaceEdit
} from 'vscode-languageserver';
import { Document } from '../../lib/documents';
import { Logger } from '../../logger';
import { LSConfigManager, LSDotvvmConfig } from '../../ls-config';
import {
    CodeActionsProvider,
    CompletionsProvider,
    DiagnosticsProvider,
    FormattingProvider,
    HoverProvider,
    SelectionRangeProvider
} from '../interfaces';
import { executeCommand, getCodeActions } from './features/getCodeActions';
import { getCompletions } from './features/getCompletions';
import { getDiagnostics } from './features/getDiagnostics';
import { getHoverInfo } from './features/getHoverInfo';
import { getSelectionRange } from './features/getSelectionRanges';
import { DotvvmDocument } from './DotvvmDocument';

export class DotvvmPlugin
    implements
        DiagnosticsProvider,
        FormattingProvider,
        CompletionsProvider,
        HoverProvider,
        CodeActionsProvider,
        SelectionRangeProvider
{
    __name = 'dotvvm';
    private docManager = new Map<Document, DotvvmDocument>();

    constructor(private configManager: LSConfigManager) {}

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics') || !this.configManager.getIsTrusted()) {
            return [];
        }

        return getDiagnostics(
            await this.getDocument(document));
    }

    async formatDocument(document: Document, options: FormattingOptions): Promise<TextEdit[]> {
        return [] // TODO
    }

    async getCompletions(
        document: Document,
        position: Position,
        _?: CompletionContext,
        cancellationToken?: CancellationToken
    ): Promise<CompletionList | null> {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        const doc = await this.getDocument(document);
        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        return getCompletions(doc, position);
    }

    async doHover(document: Document, position: Position): Promise<Hover | null> {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        return getHoverInfo(document, await this.getDocument(document), position);
    }

    async getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext,
        cancellationToken?: CancellationToken
    ): Promise<CodeAction[]> {
        if (!this.featureEnabled('codeActions')) {
            return [];
        }

        const doc = await this.getDocument(document);

        if (cancellationToken?.isCancellationRequested) {
            return [];
        }

        try {
            return getCodeActions(doc, range, context);
        } catch (error) {
            return [];
        }
    }

    async executeCommand(
        document: Document,
        command: string,
        args?: any[]
    ): Promise<WorkspaceEdit | string | null> {
        if (!this.featureEnabled('codeActions')) {
            return null;
        }

        const doc = await this.getDocument(document);
        try {
            return executeCommand(doc, command, args);
        } catch (error) {
            return null;
        }
    }

    async getSelectionRange(
        document: Document,
        position: Position
    ): Promise<SelectionRange | null> {
        if (!this.featureEnabled('selectionRange')) {
            return null;
        }

        const doc = await this.getDocument(document);

        return getSelectionRange(doc, position);
    }

    private featureEnabled(feature: keyof LSDotvvmConfig) {
        return (
            this.configManager.enabled('dotvvm.enable') &&
            this.configManager.enabled(`dotvvm.${feature}.enable`)
        );
    }

    private async getDocument(document: Document) {
        let doc = this.docManager.get(document);
        if (!doc || doc.version !== document.version) {
            doc = new DotvvmDocument(document);
            this.docManager.set(document, doc);
        }
        return doc;
    }
}
