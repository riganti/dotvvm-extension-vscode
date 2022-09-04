import { Diagnostic, DiagnosticSeverity, Position, Range } from 'vscode-languageserver';
import {
    DotvvmDocument,
} from '../../../lib/documents';
import { Logger } from '../../../logger';
import { CompilerWarningsSettings } from '../../../ls-config';

export async function getDiagnostics(
    doc: DotvvmDocument
): Promise<Diagnostic[]> {
    // const config = await doc.config;
    // if (config?.loadConfigError) {
    //     return getConfigLoadErrorDiagnostics(config.loadConfigError);
    // }

    return []

}
