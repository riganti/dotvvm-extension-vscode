import { walk } from 'estree-walker';
import { Position, SelectionRange } from 'vscode-languageserver';
import { DotvvmDocument, isInTag, mapSelectionRangeToParent, offsetAt, toRange } from '../../../lib/documents';

export async function getSelectionRange(document: DotvvmDocument, position: Position): Promise<SelectionRange | null> {
    // TODO
    return null
}
