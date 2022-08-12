import { doComplete as doEmmetComplete } from 'vscode-emmet-helper';
import {
    Color,
    ColorInformation,
    ColorPresentation,
    CompletionContext,
    CompletionList,
    CompletionTriggerKind,
    Diagnostic,
    Hover,
    Position,
    Range,
    SymbolInformation,
    CompletionItem,
    CompletionItemKind,
    SelectionRange,
    WorkspaceFolder
} from 'vscode-languageserver';
import {
    DotvvmDocument,
    DocumentManager,
    mapColorPresentationToOriginal,
    mapCompletionItemToOriginal,
    mapRangeToGenerated,
    mapSymbolInformationToOriginal,
    mapObjWithRangeToOriginal,
    mapHoverToParent,
    mapSelectionRangeToParent,
    isInTag,
    DothtmlSublanguage
} from '../../lib/documents';
import { LSConfigManager, LSCSSConfig } from '../../ls-config';
import {
    ColorPresentationsProvider,
    CompletionsProvider,
    DiagnosticsProvider,
    DocumentColorsProvider,
    DocumentSymbolsProvider,
    HoverProvider,
    SelectionRangeProvider
} from '../interfaces';
import { CSSDocument, CSSDocumentBase } from './CSSDocument';
import { GlobalVars } from './global-vars';
import { getIdClassCompletion } from './features/getIdClassCompletion';
import { AttributeContext, getAttributeContextAtPosition } from '../../lib/documents/parseHtml';
import { StyleAttributeDocument } from './StyleAttributeDocument';
import { getDocumentContext } from '../documentContext';
import { LanguageService, newCSSDataProvider } from 'vscode-css-languageservice';

export class CSSPlugin
    implements
        HoverProvider,
        CompletionsProvider,
        DiagnosticsProvider,
        DocumentColorsProvider,
        ColorPresentationsProvider,
        DocumentSymbolsProvider,
        SelectionRangeProvider
{
    __name = 'css';
    private configManager: LSConfigManager;
    private workspaceFolders: WorkspaceFolder[];
    private triggerCharacters = ['.', ':', '-', '/'];
    private globalVars = new GlobalVars();

    constructor(
        docManager: DocumentManager,
        configManager: LSConfigManager,
        workspaceFolders: WorkspaceFolder[],
        private cssLanguage: LanguageService
    ) {
        this.workspaceFolders = workspaceFolders;
        this.configManager = configManager;
        this.updateConfigs();

        this.globalVars.watchFiles(this.configManager.get('css.globals'));
        this.configManager.onChange((config) => {
            this.globalVars.watchFiles(config.get('css.globals'));
            this.updateConfigs();
        });
    }

    private getCSSDoc(document: DotvvmDocument, position: Position | number): CSSDocument | StyleAttributeDocument | null {
        const langInfo = document.determineSublanguage(position);
        if (langInfo.lang != 'css') {
            return null
        }
        return this.createCSSDoc(document, langInfo);
    }

    private createCSSDoc(document: DotvvmDocument, langInfo: DothtmlSublanguage & { lang: "css" | "js" }) {
        if (langInfo.attribute) {
            return new StyleAttributeDocument(document, ...langInfo.range, this.cssLanguage);
        }

        return new CSSDocument(document, this.cssLanguage, langInfo.range);
    }


    getSelectionRange(document: DotvvmDocument, position: Position): SelectionRange | null {
        if (!this.featureEnabled('selectionRange')) {
            return null;
        }
        const cssDocument = this.getCSSDoc(document, position);
        if (!cssDocument) { return null }

        const [range] = this.cssLanguage.getSelectionRanges(
            cssDocument,
            [cssDocument.getGeneratedPosition(position)],
            cssDocument.stylesheet
        );

        if (!range) {
            return null;
        }

        return mapSelectionRangeToParent(cssDocument, range);
    }

    getDiagnostics(document: DotvvmDocument): Diagnostic[] {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        // validate all <style> and style="" attributes

        return this.collectFromAllCssDocuments(document, cssDocument => {
            return this.cssLanguage
                .doValidation(cssDocument, cssDocument.stylesheet)
                .map((diagnostic) => mapObjWithRangeToOriginal(cssDocument, diagnostic));

        })
    }

    doHover(document: DotvvmDocument, position: Position): Hover | null {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        const cssDocument = this.getCSSDoc(document, position);
        if (!cssDocument || !cssDocument.isInGenerated(position)) { return null }

        return this.doHoverInternal(cssDocument, position);
    }
    private doHoverInternal(cssDocument: CSSDocumentBase, position: Position) {
        const hoverInfo = this.cssLanguage.doHover(
            cssDocument,
            cssDocument.getGeneratedPosition(position),
            cssDocument.stylesheet
        );
        return hoverInfo ? mapHoverToParent(cssDocument, hoverInfo) : hoverInfo;
    }

    async getCompletions(
        document: DotvvmDocument,
        position: Position,
        completionContext?: CompletionContext
    ): Promise<CompletionList | null> {
        const triggerCharacter = completionContext?.triggerCharacter;
        const triggerKind = completionContext?.triggerKind;
        const isCustomTriggerCharacter = triggerKind === CompletionTriggerKind.TriggerCharacter;

        if (
            isCustomTriggerCharacter &&
            triggerCharacter &&
            !this.triggerCharacters.includes(triggerCharacter)
        ) {
            return null;
        }

        if (!this.featureEnabled('completions')) {
            return null;
        }

        const cssDocument = this.getCSSDoc(document, position);

        if (!cssDocument || !cssDocument.isInGenerated(position)) {
            return null
        }
        return this.getCompletionsInternal(document, position, cssDocument) as any;

        // TODO: completion for id, class
        // return getIdClassCompletion(cssDocument, attributeContext);
    }

    private async getCompletionsInternal(
        document: DotvvmDocument,
        position: Position,
        cssDocument: CSSDocumentBase
    ) {
        const lang = this.cssLanguage;
        let emmetResults: CompletionList = {
            isIncomplete: false,
            items: []
        };
        if (
            this.configManager.getConfig().css.completions.emmet &&
            this.configManager.getEmmetConfig().showExpandedAbbreviation !== 'never'
        ) {
            lang.setCompletionParticipants([
                {
                    onCssProperty: (context) => {
                        if (context?.propertyName) {
                            emmetResults =
                                <CompletionList>doEmmetComplete(
                                    cssDocument,
                                    cssDocument.getGeneratedPosition(position),
                                    'css',
                                    this.configManager.getEmmetConfig()
                                ) || emmetResults;
                        }
                    },
                    onCssPropertyValue: (context) => {
                        if (context?.propertyValue) {
                            emmetResults =
                                <CompletionList>doEmmetComplete(
                                    cssDocument,
                                    cssDocument.getGeneratedPosition(position),
                                    'css',
                                    this.configManager.getEmmetConfig()
                                ) || emmetResults;
                        }
                    },
                }
            ]);
        }

        const results = await lang.doComplete2(
            cssDocument,
            cssDocument.getGeneratedPosition(position),
            cssDocument.stylesheet,
            getDocumentContext(cssDocument.uri, this.workspaceFolders)
        );
        return CompletionList.create(
            this.appendGlobalVars(
                [...(results ? results.items : []), ...emmetResults.items].map((completionItem) =>
                    mapCompletionItemToOriginal(cssDocument, <CompletionItem>completionItem)
                )
            ),
            // Emmet completions change on every keystroke, so they are never complete
            emmetResults.items.length > 0
        );
    }

    private appendGlobalVars(items: CompletionItem[]): CompletionItem[] {
        // Finding one value with that item kind means we are in a value completion scenario
        const value = items.find((item) => item.kind === CompletionItemKind.Value);
        if (!value) {
            return items;
        }

        const additionalItems: CompletionItem[] = this.globalVars
            .getGlobalVars()
            .map((globalVar) => ({
                label: `var(${globalVar.name})`,
                sortText: '-',
                detail: `${globalVar.filename}\n\n${globalVar.name}: ${globalVar.value}`,
                kind: CompletionItemKind.Value
            }));
        return [...items, ...additionalItems];
    }

    getDocumentColors(document: DotvvmDocument): ColorInformation[] {
        if (!this.featureEnabled('documentColors')) {
            return [];
        }

        return this.collectFromAllCssDocuments(document, cssDocument => {
            return this.cssLanguage
                .findDocumentColors(cssDocument, cssDocument.stylesheet)
                .map((colorInfo) => mapObjWithRangeToOriginal(cssDocument, colorInfo));

        })
    }

    getColorPresentations(document: DotvvmDocument, range: Range, color: Color): ColorPresentation[] {
        if (!this.featureEnabled('colorPresentations')) {
            return [];
        }

        const cssDocument = this.getCSSDoc(document, range.start);
        if (
            !cssDocument ||
            (!cssDocument.isInGenerated(range.start) && !cssDocument.isInGenerated(range.end))
        ) {
            return [];
        }

        return this.cssLanguage
            .getColorPresentations(
                cssDocument,
                cssDocument.stylesheet,
                color,
                mapRangeToGenerated(cssDocument, range)
            )
            .map((colorPres) => mapColorPresentationToOriginal(cssDocument, colorPres));
    }

    getDocumentSymbols(document: DotvvmDocument): SymbolInformation[] {
        if (!this.featureEnabled('documentColors')) {
            return [];
        }

        return this.collectFromAllCssDocuments(document, cssDoc => {
            // we don't want symbols from style attributes
            if (cssDoc instanceof StyleAttributeDocument)
                return []

            return this.cssLanguage
                .findDocumentSymbols(cssDoc, cssDoc.stylesheet)
                .map((symbol) => {
                    if (!symbol.containerName) {
                        return {
                            ...symbol,
                            containerName: 'style'
                        };
                    }

                    return symbol;
                })
                .map((symbol) => mapSymbolInformationToOriginal(cssDoc, symbol));

        })
    }

    private collectFromAllCssDocuments<T>(document: DotvvmDocument, f: (d: CSSDocument | StyleAttributeDocument) => T[]): T[] {
        const styleRanges = document.findStyleRanges();
        return styleRanges.flatMap(r => {
            const cssDocument = this.createCSSDoc(document, r);
            return f(cssDocument);
        })
    }

    private updateConfigs() {
        this.cssLanguage.configure(this.configManager.getCssConfig());
    }

    private featureEnabled(feature: keyof LSCSSConfig) {
        return (
            this.configManager.enabled('css.enable') &&
            this.configManager.enabled(`css.${feature}.enable`)
        );
    }
}
