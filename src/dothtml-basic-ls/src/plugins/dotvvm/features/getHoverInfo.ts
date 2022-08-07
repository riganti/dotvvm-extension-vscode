import { Hover, Position } from 'vscode-languageserver';
import { flatten } from '../../../utils';
import { DotvvmDocument, isInTag } from '../../../lib/documents';
import { AttributeContext, getAttributeContextAtPosition } from '../../../lib/documents/parseHtml';
import { attributeCanHaveEventModifier } from './utils';
import { getModifierData } from './getModifierData';

/**
 * Get hover information for special svelte tags within moustache tags.
 */
export function getHoverInfo(
    document: DotvvmDocument,
    position: Position
): Hover | null {
    const offset = document.offsetAt(position);

    const isInStyleOrScript =
        isInTag(position, document.styleInfo) ||
        isInTag(position, document.scriptInfo) ||
        isInTag(position, document.moduleScriptInfo);

    if (isInStyleOrScript) {
        return null;
    }
    return { contents: "Some test hover" };
}
