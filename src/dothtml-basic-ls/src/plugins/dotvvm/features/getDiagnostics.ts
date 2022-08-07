import { Diagnostic, DiagnosticSeverity, Position, Range } from 'vscode-languageserver';
import {
    DotvvmDocument,
} from '../../../lib/documents';
import { Logger } from '../../../logger';
import { CompilerWarningsSettings } from '../../../ls-config';

/**
 * Returns diagnostics from the svelte compiler.
 * Also tries to return errors at correct position if transpilation/preprocessing fails.
 */
export async function getDiagnostics(
    doc: DotvvmDocument
): Promise<Diagnostic[]> {
    // const config = await doc.config;
    // if (config?.loadConfigError) {
    //     return getConfigLoadErrorDiagnostics(config.loadConfigError);
    // }

    try {
        return [] // await tryGetDiagnostics(document, svelteDoc, settings);
    } catch (error) {
        return getPreprocessErrorDiagnostics(doc, error);
    }
}

/**
 * Try to infer a nice diagnostic error message from the transpilation error.
 */
function getPreprocessErrorDiagnostics(document: DotvvmDocument, error: any): Diagnostic[] {
    Logger.error('Preprocessing failed');
    Logger.error(error);
    
    return []
}
