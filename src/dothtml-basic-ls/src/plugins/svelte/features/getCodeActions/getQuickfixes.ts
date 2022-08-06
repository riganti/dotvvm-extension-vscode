import {
    CodeAction,
    Diagnostic,
} from 'vscode-languageserver';
import { SvelteDocument } from '../../SvelteDocument';

/**
 * Get applicable quick fixes.
 */
export async function getQuickfixActions(
    svelteDoc: SvelteDocument,
    svelteDiagnostics: Diagnostic[]
): Promise<CodeAction[]> {

    return []
}
