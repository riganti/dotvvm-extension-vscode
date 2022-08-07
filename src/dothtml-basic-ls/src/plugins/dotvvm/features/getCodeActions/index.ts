import {
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    Range,
    WorkspaceEdit
} from 'vscode-languageserver';
import { DotvvmDocument } from '../../../../lib/documents';
import { getQuickfixActions } from './getQuickfixes';
import { executeRefactoringCommand } from './getRefactorings';

export async function getCodeActions(
    doc: DotvvmDocument,
    range: Range,
    context: CodeActionContext
): Promise<CodeAction[]> {
    const svelteDiagnostics = context.diagnostics;
    if (
        svelteDiagnostics.length &&
        (!context.only || context.only.includes(CodeActionKind.QuickFix))
    ) {
        return await getQuickfixActions(doc, svelteDiagnostics);
    }

    return [];
}

export async function executeCommand(
    doc: DotvvmDocument,
    command: string,
    args?: any[]
): Promise<WorkspaceEdit | string | null> {
    return await executeRefactoringCommand(doc, command, args);
}
