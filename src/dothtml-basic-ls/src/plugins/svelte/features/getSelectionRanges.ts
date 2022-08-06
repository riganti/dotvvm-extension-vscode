import { walk } from 'estree-walker';
import { Position, SelectionRange } from 'vscode-languageserver';
import { isInTag, mapSelectionRangeToParent, offsetAt, toRange } from '../../../lib/documents';
import { SvelteDocument } from '../SvelteDocument';

export async function getSelectionRange(svelteDoc: SvelteDocument, position: Position): Promise<SelectionRange | null> {
    const { script, style, moduleScript } = svelteDoc;
    return null
}
