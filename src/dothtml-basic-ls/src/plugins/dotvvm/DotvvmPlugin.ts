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
import { DotvvmDocument } from '../../lib/documents';
import { diagnosticsFromTree } from '../../lib/treeSitterDiagnostics';
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
    constructor(private configManager: LSConfigManager) {}

    async getDiagnostics(document: DotvvmDocument): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics') || !this.configManager.getIsTrusted()) {
            return [];
        }

        const syntaxDiagnostics = document.tree ? diagnosticsFromTree(document.tree.tree) : [];

        return syntaxDiagnostics.concat(await getDiagnostics(document));
    }

    async formatDocument(document: DotvvmDocument, options: FormattingOptions): Promise<TextEdit[]> {
        return [] // TODO
    }

    async getCompletions(
        doc: DotvvmDocument,
        position: Position,
        _?: CompletionContext,
        cancellationToken?: CancellationToken
    ): Promise<CompletionList | null> {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        if (cancellationToken?.isCancellationRequested) {
            return null;
        }

        return getCompletions(doc, position);
    }

    async doHover(document: DotvvmDocument, position: Position): Promise<Hover | null> {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        return getHoverInfo(document, position);
    }

    async getCodeActions(
        document: DotvvmDocument,
        range: Range,
        context: CodeActionContext,
        cancellationToken?: CancellationToken
    ): Promise<CodeAction[]> {
        if (!this.featureEnabled('codeActions')) {
            return [];
        }

        if (cancellationToken?.isCancellationRequested) {
            return [];
        }

        try {
            return getCodeActions(document, range, context);
        } catch (error) {
            return [];
        }
    }

    async executeCommand(
        doc: DotvvmDocument,
        command: string,
        args?: any[]
    ): Promise<WorkspaceEdit | string | null> {
        if (!this.featureEnabled('codeActions')) {
            return null;
        }

        try {
            return executeCommand(doc, command, args);
        } catch (error) {
            return null;
        }
    }

    async getSelectionRange(
        doc: DotvvmDocument,
        position: Position
    ): Promise<SelectionRange | null> {
        if (!this.featureEnabled('selectionRange')) {
            return null;
        }

        return getSelectionRange(doc, position);
    }

    private featureEnabled(feature: keyof LSDotvvmConfig) {
        return (
            this.configManager.enabled('dotvvm.enable') &&
            this.configManager.enabled(`dotvvm.${feature}.enable`)
        );
    }

}
