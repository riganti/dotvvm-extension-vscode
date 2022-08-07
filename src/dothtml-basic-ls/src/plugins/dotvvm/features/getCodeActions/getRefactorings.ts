import * as path from 'path';
import {
    CreateFile,
    OptionalVersionedTextDocumentIdentifier,
    Position,
    Range,
    TextDocumentEdit,
    TextEdit,
    WorkspaceEdit
} from 'vscode-languageserver';
import { DotvvmDocument, isRangeInTag, TagInformation, updateRelativeImport } from '../../../../lib/documents';
import { pathToUrl } from '../../../../utils';

export interface ExtractComponentArgs {
    uri: string;
    range: Range;
    filePath: string;
}

export const extractComponentCommand = 'extract_to_svelte_component';

export async function executeRefactoringCommand(
    doc: DotvvmDocument,
    command: string,
    args?: any[]
): Promise<WorkspaceEdit | string | null> {
    // if (command === extractComponentCommand && args) {
    //     return executeExtractComponentCommand(doc, args[1]);
    // }

    return null;
}
