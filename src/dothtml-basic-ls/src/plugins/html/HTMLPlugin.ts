import { doComplete as doEmmetComplete } from 'vscode-emmet-helper';
import {
    getLanguageService,
    HTMLDocument,
    CompletionItem as HtmlCompletionItem,
    Node,
    LanguageService
} from 'vscode-html-languageservice';
import {
    CompletionList,
    Hover,
    Position,
    SymbolInformation,
    CompletionItem,
    CompletionItemKind,
    TextEdit,
    Range,
    WorkspaceEdit,
    LinkedEditingRanges
} from 'vscode-languageserver';
import {
    DocumentManager,
    DotvvmDocument,
    isInTag,
    getNodeIfIsInComponentStartTag
} from '../../lib/documents';
import { LSConfigManager, LSHTMLConfig } from '../../ls-config';
import { DothtmlDataProvider } from './dothtmlDataProvider'
import {
    HoverProvider,
    CompletionsProvider,
    RenameProvider,
    LinkedEditingRangesProvider
} from '../interfaces';
import { possiblyComponent } from '../../utils';
import { SerializedConfigSeeker } from '../../lib/serializedConfigSeeker';

export class HTMLPlugin
    implements HoverProvider, CompletionsProvider, RenameProvider, LinkedEditingRangesProvider
{
    __name = 'html';
    private configManager: LSConfigManager;
    private documents = new WeakMap<DotvvmDocument, HTMLDocument>();
    private styleScriptTemplate = new Set(['template', 'style', 'script']);
    dothtmlDataProvider: DothtmlDataProvider;
    private lang: LanguageService

    constructor(
        docManager: DocumentManager,
        configManager: LSConfigManager,
        private configSeeker: SerializedConfigSeeker) {
        this.dothtmlDataProvider = new DothtmlDataProvider(configSeeker);
        this.lang = getLanguageService({
            customDataProviders: [this.dothtmlDataProvider],
            // useDefaultDataProvider: false
        })

        this.configManager = configManager;
        docManager.on('documentChange', (document) => {
            this.documents.set(document, document.html);
        });
    }

    doHover(document: DotvvmDocument, position: Position): Hover | null {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        const node = html.findNodeAt(document.offsetAt(position));
        if (!node || possiblyComponent(node)) {
            return null;
        }

        return this.lang.doHover(document, position, html);
    }

    getCompletions(document: DotvvmDocument, position: Position): CompletionList | null {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        const lang = document.determineSublanguage(position)
        if (lang.lang != 'html') {
            return null;
        }

        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        let emmetResults: CompletionList = {
            isIncomplete: false,
            items: []
        };
        if (
            this.configManager.getConfig().html.completions.emmet &&
            this.configManager.getEmmetConfig().showExpandedAbbreviation !== 'never'
        ) {
            this.lang.setCompletionParticipants([
                {
                    onHtmlContent: () =>
                        (emmetResults =
                            <CompletionList>doEmmetComplete(
                                document,
                                position,
                                'html',
                                this.configManager.getEmmetConfig()
                            ) || emmetResults)
                }
            ]);
        }

        const results = this.isInComponentTag(html, document, position)
            ? // Only allow emmet inside component element tags.
              // Other attributes/events would be false positives.
              CompletionList.create([])
            : this.lang.doComplete(document, position, html);
        const items = this.toCompletionItems(results.items);

        items.forEach((item) => {
            if (item.label.startsWith('on:') && item.textEdit) {
                item.textEdit = {
                    ...item.textEdit,
                    newText: item.textEdit.newText.replace('="$1"', '$2="$1"')
                };
            }
        });

        return CompletionList.create(
            [
                ...this.toCompletionItems(items),
                ...emmetResults.items
            ],
            // Emmet completions change on every keystroke, so they are never complete
            emmetResults.items.length > 0
        );
    }

    /**
     * The HTML language service uses newer types which clash
     * without the stable ones. Transform to the stable types.
     */
    private toCompletionItems(items: (HtmlCompletionItem | CompletionItem)[]): CompletionItem[] {
        return items.map((item) => {
            if (!item.textEdit || TextEdit.is(item.textEdit)) {
                return <CompletionItem>item;
            }
            return <CompletionItem>{
                ...item,
                textEdit: TextEdit.replace(item.textEdit.replace, item.textEdit.newText)
            };
        });
    }

    private isInComponentTag(html: HTMLDocument, document: DotvvmDocument, position: Position) {
        return !!getNodeIfIsInComponentStartTag(html, document.offsetAt(position));
    }

    doTagComplete(document: DotvvmDocument, position: Position): string | null {
        if (!this.featureEnabled('tagComplete')) {
            return null;
        }
        if (document.determineSublanguage(position).lang != 'html') {
            return null;
        }
        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        return this.lang.doTagComplete(document, position, html);
    }

    getDocumentSymbols(document: DotvvmDocument): SymbolInformation[] {
        if (!this.featureEnabled('documentSymbols')) {
            return [];
        }

        const html = this.documents.get(document);
        if (!html) {
            return [];
        }

        return this.lang.findDocumentSymbols(document, html);
    }

    rename(document: DotvvmDocument, position: Position, newName: string): WorkspaceEdit | null {
        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        const node = html.findNodeAt(document.offsetAt(position));
        if (!node || possiblyComponent(node)) {
            return null;
        }

        return this.lang.doRename(document, position, newName, html);
    }

    prepareRename(document: DotvvmDocument, position: Position): Range | null {
        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        const offset = document.offsetAt(position);
        const node = html.findNodeAt(offset);
        if (!node || possiblyComponent(node) || !node.tag || !this.isRenameAtTag(node, offset)) {
            return null;
        }
        const tagNameStart = node.start + '<'.length;

        return document.rangeWithLen(tagNameStart, node.tag.length);
    }

    getLinkedEditingRanges(document: DotvvmDocument, position: Position): LinkedEditingRanges | null {
        if (!this.featureEnabled('linkedEditing')) {
            return null;
        }

        const html = this.documents.get(document);
        if (!html) {
            return null;
        }

        const ranges = this.lang.findLinkedEditingRanges(document, position, html);

        if (!ranges) {
            return null;
        }

        return { ranges };
    }

    /**
     * Returns true if rename happens at the tag name, not anywhere inbetween.
     */
    private isRenameAtTag(node: Node, offset: number): boolean {
        if (!node.tag) {
            return false;
        }

        const startTagNameEnd = node.start + `<${node.tag}`.length;
        const isAtStartTag = offset > node.start && offset <= startTagNameEnd;
        const isAtEndTag =
            node.endTagStart !== undefined && offset >= node.endTagStart && offset < node.end;
        return isAtStartTag || isAtEndTag;
    }

    private featureEnabled(feature: keyof LSHTMLConfig) {
        return (
            this.configManager.enabled('html.enable') &&
            this.configManager.enabled(`html.${feature}.enable`)
        );
    }
}
