import { EOL } from 'os';
import {
    Position,
    CompletionList,
    CompletionItemKind,
    CompletionItem,
    InsertTextFormat,
    MarkupKind
} from 'vscode-languageserver';
import { isInTag, DotvvmDocument } from '../../../lib/documents';
import { AttributeContext, getAttributeContextAtPosition } from '../../../lib/documents/parseHtml';
import { getModifierData } from './getModifierData';
import { attributeCanHaveEventModifier } from './utils';

const HTML_COMMENT_START = '<!--';

const componentDocumentationCompletion: CompletionItem = {
    label: '@component',
    insertText: `component${EOL}$1${EOL}`,
    documentation:
        'Documentation for this component. ' +
        'It will show up on hover. You can use markdown and code blocks here',
    insertTextFormat: InsertTextFormat.Snippet,
    kind: CompletionItemKind.Snippet,
    sortText: '-1',
    filterText: 'component',
    preselect: true
};

export function getCompletions(
    doc: DotvvmDocument,
    position: Position
): CompletionList | null {
    const offset = doc.offsetAt(position);

    return null; // TODO
}
