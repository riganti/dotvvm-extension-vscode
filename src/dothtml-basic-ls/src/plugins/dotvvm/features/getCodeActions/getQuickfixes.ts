import {
    CodeAction,
    Diagnostic,
} from 'vscode-languageserver';
import { DotvvmDocument } from '../../../../lib/documents';

/**
 * Get applicable quick fixes.
 */
export async function getQuickfixActions(
    svelteDoc: DotvvmDocument,
    svelteDiagnostics: Diagnostic[]
): Promise<CodeAction[]> {

    return []
}
