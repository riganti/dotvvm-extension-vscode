import {
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    Range,
    WorkspaceEdit
} from 'vscode-languageserver';
import { DotvvmDocument } from '../../DotvvmDocument';
import { getQuickfixActions } from './getQuickfixes';
import { executeRefactoringCommand } from './getRefactorings';

export async function getCodeActions(
    svelteDoc: DotvvmDocument,
    range: Range,
    context: CodeActionContext
): Promise<CodeAction[]> {
    const svelteDiagnostics = context.diagnostics;
    if (
        svelteDiagnostics.length &&
        (!context.only || context.only.includes(CodeActionKind.QuickFix))
    ) {
        return await getQuickfixActions(svelteDoc, svelteDiagnostics);
    }

    return [];
}

export async function executeCommand(
    svelteDoc: DotvvmDocument,
    command: string,
    args?: any[]
): Promise<WorkspaceEdit | string | null> {
    return await executeRefactoringCommand(svelteDoc, command, args);
}
