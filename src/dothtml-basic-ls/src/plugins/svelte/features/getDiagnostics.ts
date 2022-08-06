import { Diagnostic, DiagnosticSeverity, Position, Range } from 'vscode-languageserver';
import {
    Document,
} from '../../../lib/documents';
import { Logger } from '../../../logger';
import { CompilerWarningsSettings } from '../../../ls-config';
import { SvelteDocument } from '../SvelteDocument';

/**
 * Returns diagnostics from the svelte compiler.
 * Also tries to return errors at correct position if transpilation/preprocessing fails.
 */
export async function getDiagnostics(
    document: Document,
    svelteDoc: SvelteDocument,
    settings: CompilerWarningsSettings
): Promise<Diagnostic[]> {
    // const config = await svelteDoc.config;
    // if (config?.loadConfigError) {
    //     return getConfigLoadErrorDiagnostics(config.loadConfigError);
    // }

    try {
        return [] // await tryGetDiagnostics(document, svelteDoc, settings);
    } catch (error) {
        return getPreprocessErrorDiagnostics(document, error);
    }
}

/**
 * Try to infer a nice diagnostic error message from the transpilation error.
 */
function getPreprocessErrorDiagnostics(document: Document, error: any): Diagnostic[] {
    Logger.error('Preprocessing failed');
    Logger.error(error);
    
    return []
}
