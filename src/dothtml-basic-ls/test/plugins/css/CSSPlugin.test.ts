import * as assert from 'assert';
import {
    Range,
    Position,
    Hover,
    CompletionItem,
    CompletionItemKind,
    TextEdit,
    CompletionContext,
    SelectionRange,
    CompletionTriggerKind
} from 'vscode-languageserver';
import { DocumentManager, DotvvmDocument } from '../../../src/lib/documents';
import { CSSPlugin } from '../../../src/plugins';
import { LSConfigManager } from '../../../src/ls-config';
import { pathToUrl } from '../../../src/utils';
import { FileType, getCSSLanguageService, LanguageServiceOptions } from 'vscode-css-languageservice';

describe('CSS Plugin', () => {
    function setup(content: string, lsOptions?: LanguageServiceOptions) {
        const document = new DotvvmDocument('file:///hello.dothtml', content);
        const docManager = new DocumentManager(() => document);
        const pluginManager = new LSConfigManager();
        const plugin = new CSSPlugin(
            docManager,
            pluginManager,
            [
                {
                    name: '',
                    uri: pathToUrl(process.cwd())
                }
            ],
            getCSSLanguageService(lsOptions)
        );
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    describe('provides hover info', () => {
        it('for normal css', () => {
            const { plugin, document } = setup('<style>h1 {}</style>');

            assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 8)), <Hover>{
                contents: [
                    { language: 'html', value: '<h1>' },
                    '[Selector Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity): (0, 0, 1)'
                ],
                range: Range.create(0, 7, 0, 9)
            });

            assert.strictEqual(plugin.doHover(document, Position.create(0, 10)), null);
        });

        it('for style attribute', () => {
            const { plugin, document } = setup('<div style="height: auto;"></div>');
            assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 13)), <Hover>{
                contents: {
                    kind: 'markdown',
                    value:
                        'Specifies the height of the content area,' +
                        " padding area or border area \\(depending on 'box\\-sizing'\\)" +
                        ' of certain boxes\\.\n' +
                        '\nSyntax: &lt;viewport\\-length&gt;\\{1,2\\}\n\n' +
                        '[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/height)'
                },
                range: Range.create(0, 12, 0, 24)
            });
        });

        it('not for style attribute with binding', () => {
            const { plugin, document } = setup('<div style="{value:        }"></div>');
            assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 13)), null);
        });
    });

    describe('provides completions', () => {
        it('for normal css', async () => {
            const { plugin, document } = setup('<style></style>');

            const completions = await plugin.getCompletions(document, Position.create(0, 7), {
                triggerCharacter: '.'
            } as CompletionContext);
            assert.ok(
                Array.isArray(completions && completions.items),
                'Expected completion items to be an array'
            );
            assert.ok(completions!.items.length > 0, 'Expected completions to have length');

            assert.deepStrictEqual(completions!.items.find(i => i.label == ":active"), <CompletionItem>{
                label: ':active',
                kind: CompletionItemKind.Function,
                insertTextFormat: undefined,
                documentation: {
                    kind: 'markdown',
                    value: 'Applies while an element is being activated by the user\\. For example, between the times the user presses the mouse button and releases it\\.\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/:active)'
                },
                textEdit: TextEdit.insert(Position.create(0, 7), ':active'),
                tags: []
            });
        });

        it('for style attribute', async () => {
            const { plugin, document } = setup('<div style="display: n"></div>');
            const completions = await plugin.getCompletions(document, Position.create(0, 22), {
                triggerKind: CompletionTriggerKind.Invoked
            } as CompletionContext);
            assert.deepStrictEqual(
                completions?.items.find((item) => item.label === 'none'),
                <CompletionItem>{
                    insertTextFormat: undefined,
                    kind: 12,
                    label: 'none',
                    documentation: {
                        kind: 'markdown',
                        value: 'The element and its descendants generates no boxes\\.'
                    },
                    sortText: ' ',
                    tags: [],
                    textEdit: {
                        newText: 'none',
                        range: {
                            start: {
                                line: 0,
                                character: 21
                            },
                            end: {
                                line: 0,
                                character: 22
                            }
                        }
                    }
                }
            );
        });

        it('for empty style attribute', async () => {
            const { plugin, document } = setup('<div style=""></div>');
            const completions = await plugin.getCompletions(document, Position.create(0, 12), {
                triggerKind: CompletionTriggerKind.Invoked
            } as CompletionContext);
            assert.deepStrictEqual(
                completions?.items.filter((item) => item.label.length <= 3).map(i => i.label).sort(),
                ["all", "alt", "gap", "pad", "src", "top"]
            );
        });


        it('not for style attribute with binding', async () => {
            const { plugin, document } = setup('<div style="{value:         }"></div>');
            assert.deepStrictEqual(
                await plugin.getCompletions(document, Position.create(0, 21)),
                null
            );
        });

    });

    describe('provides diagnostics', () => {
        it('- everything ok', () => {
            const { plugin, document } = setup('<style>h1 {color:blue;}</style>');

            const diagnostics = plugin.getDiagnostics(document);

            assert.deepStrictEqual(diagnostics, []);
        });

        it('- has error', () => {
            const { plugin, document } = setup('<style>h1 {iDunnoDisProperty:blue;}</style>');

            const diagnostics = plugin.getDiagnostics(document);

            assert.deepStrictEqual(diagnostics, [
                {
                    code: 'unknownProperties',
                    message: "Unknown property: 'iDunnoDisProperty'",
                    range: {
                        end: {
                            character: 28,
                            line: 0
                        },
                        start: {
                            character: 11,
                            line: 0
                        }
                    },
                    severity: 2,
                    source: 'css'
                }
            ]);
        });
    });

    describe('provides document symbols', () => {
        it('for normal css', () => {
            const { plugin, document } = setup('<style>h1 {color:blue;}</style>');

            const symbols = plugin.getDocumentSymbols(document);

            assert.deepStrictEqual(symbols, [
                {
                    containerName: 'style',
                    kind: 5,
                    location: {
                        range: {
                            end: {
                                character: 23,
                                line: 0
                            },
                            start: {
                                character: 7,
                                line: 0
                            }
                        },
                        uri: 'file:///hello.dothtml'
                    },
                    name: 'h1'
                }
            ]);
        });
   });

    it('provides selection range', () => {
        const { plugin, document } = setup('<style>h1 {}</style>');

        const selectionRange = plugin.getSelectionRange(document, Position.create(0, 11));

        assert.deepStrictEqual(selectionRange, <SelectionRange>{
            parent: {
                parent: {
                    parent: undefined,
                    range: {
                        end: {
                            character: 12,
                            line: 0
                        },
                        start: {
                            character: 7,
                            line: 0
                        }
                    }
                },
                range: {
                    end: {
                        character: 12,
                        line: 0
                    },
                    start: {
                        character: 10,
                        line: 0
                    }
                }
            },
            range: {
                end: {
                    character: 11,
                    line: 0
                },
                start: {
                    character: 11,
                    line: 0
                }
            }
        });
    });

    it('return null for selection range when not in style', () => {
        const { plugin, document } = setup('<script></script>');

        const selectionRange = plugin.getSelectionRange(document, Position.create(0, 10));

        assert.equal(selectionRange, null);
    });
});
