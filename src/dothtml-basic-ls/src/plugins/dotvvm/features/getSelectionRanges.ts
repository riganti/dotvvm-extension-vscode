import { walk } from 'estree-walker';
import { Position, SelectionRange } from 'vscode-languageserver';
import { isInTag, mapSelectionRangeToParent, offsetAt, toRange } from '../../../lib/documents';
import { DotvvmDocument } from '../DotvvmDocument';

export async function getSelectionRange(svelteDoc: DotvvmDocument, position: Position): Promise<SelectionRange | null> {
    const { script, style, moduleScript } = svelteDoc;
    return null
}
