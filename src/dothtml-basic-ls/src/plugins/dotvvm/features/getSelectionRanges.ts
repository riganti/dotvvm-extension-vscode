import { walk } from 'estree-walker';
import { SyntaxNode } from 'tree-sitter-dotvvm';
import { Position, SelectionRange } from 'vscode-languageserver';
import { DotvvmDocument, isInTag, mapSelectionRangeToParent } from '../../../lib/documents';
import { nodeToVsRange } from '../../../lib/parserutils';

function nodeToSelectionRanges(node: SyntaxNode | null | undefined): SelectionRange | null {
    if (!node)
        return null
    return {
        range: nodeToVsRange(node),
        parent: nodeToSelectionRanges(node.parent) ?? undefined
    }
}

export async function getSelectionRange(document: DotvvmDocument, position: Position): Promise<SelectionRange | null> {
    const node = document.tree?.nodeAt(position);

    return nodeToSelectionRanges(node);
}
