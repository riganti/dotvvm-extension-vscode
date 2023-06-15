import * as assert from 'assert';
import {
    Range,
    Position,
    Hover,
    CompletionItem,
    TextEdit,
    CompletionItemKind,
    InsertTextFormat
} from 'vscode-languageserver';
import { DotvvmPlugin, HTMLPlugin } from '../../../src/plugins';
import { DocumentManager, DotvvmDocument } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';
import { SerializedConfigSeeker } from '../../../src/lib/serializedConfigSeeker';

describe('DotVVM Plugin', () => {
    const configSeeker = new SerializedConfigSeeker(["."])
    function setup(content: string) {
        const contentSplits = content.split('#c#')
        const cursorOffsets: number[] = []
        for (const s of contentSplits) {
            cursorOffsets.push(s.length + (cursorOffsets[cursorOffsets.length - 1] || 0))
        }
        const document = new DotvvmDocument('file:///hello.dothtml', contentSplits.join(''));
        const cursors = cursorOffsets.map(offset =>  ({ offset, position: document.positionAt(offset) }))
        const docManager = new DocumentManager(() => document);
        const pluginManager = new LSConfigManager();
        const plugin = new DotvvmPlugin(configSeeker, pluginManager);
        docManager.openDocument(<any>'some doc');

        return { plugin, document, cursors };
    }

    after(() => {
        configSeeker.dispose()
    })

    it('provides completions', async () => {
        const { plugin, document } = setup('<');

        const completions = await plugin.getCompletions(document, Position.create(0, 1));
        assert.ok(Array.isArray(completions && completions.items));
        assert.ok(completions!.items.length > 0);

        const textBoxCompletion = completions!.items.find(i => i.label === 'dot:TextBox');

        assert.deepStrictEqual(textBoxCompletion, <CompletionItem>{
            documentation: undefined,
            insertText: 'dot:TextBox Text={value: ${1}} $0 />',
            insertTextFormat: 2,
            kind: 7,
            label: 'dot:TextBox'
        });
    });

    it('does not provide completions inside of Binding', async () => {
        const { plugin, document } = setup('<div Content={value:   }');

        const completions = await plugin.getCompletions(document, Position.create(0, 20));
        assert.strictEqual(completions, null);

        const tagCompletion = await plugin.doTagComplete(document, Position.create(0, 20));
        assert.strictEqual(tagCompletion, null);
    });

    it('does provide completions outside of binding', async () => {
        const { plugin, document, cursors: [cursor] } = setup('<div InnerText={value: bla} #c# > ');

        const completions = await plugin.getCompletions(document, cursor.position);
        const visibleCompletion = completions!.items.find(i => i.label === 'Visible');
        assert.deepEqual(visibleCompletion, <CompletionItem>{
            documentation: 'Type: Boolean',
            insertText: 'Visible={${1:value}: ${0}} ',
            insertTextFormat: 2,
            kind: 10,
            label: 'Visible'
        });

        const tagCompletion = plugin.doTagComplete(document, cursor.position);
        assert.strictEqual(tagCompletion, null);
    });

    it('autocloses just opened tag', async () => {
        const { plugin, document, cursors: [cursor] } = setup('<div InnerText={value: bla} >#c#');

        const tagCompletion = plugin.doTagComplete(document, cursor.position);
        assert.strictEqual(tagCompletion, '$0</div>');
    })
    it('autocloses current element', async () => {
        const { plugin, document, cursors: [cursor] } = setup('<body><div InnerText={value: bla} > <img> </#c# </body>');

        console.log(cursor)
        const tagCompletion = plugin.doTagComplete(document, cursor.position);
        assert.strictEqual(tagCompletion, 'div>');
    })

    it('provides self-closing tag completion', async () => {
        const { plugin, document } = setup('<');

        const completions = await plugin.getCompletions(document, Position.create(0, 1));

        const textBoxCompletion = completions!.items.find(i => i.label === 'dot:TextBox');

        assert.deepStrictEqual(textBoxCompletion?.insertText, 'dot:TextBox Text={value: ${1}} $0 />');
    })
    it('provides closing tag completion', async () => {
        const { plugin, document } = setup('<');

        const completions = await plugin.getCompletions(document, Position.create(0, 1));

        const textBoxCompletion = completions!.items.find(i => i.label === 'dot:Repeater');

        assert.deepStrictEqual(textBoxCompletion?.insertText, 'dot:Repeater DataSource={${1:value}: ${2}} >$0</dot:Repeater>');
    })
    it('does not provide closing tag completion when already present', async () => {
        const { plugin, document } = setup('<d\n\n</dot:Repeater>');

        const completions = await plugin.getCompletions(document, Position.create(0, 2));

        const textBoxCompletion = completions!.items.find(i => i.label === 'dot:Repeater');

        assert.deepStrictEqual(textBoxCompletion?.insertText, 'dot:Repeater DataSource={${1:value}: ${2}} >$0');
    })

    // TODO
    // it('provides linked editing ranges', async () => {
    //     const { plugin, document } = setup('<div></div>');

    //     const ranges = plugin.getLinkedEditingRanges(document, Position.create(0, 3));
    //     assert.deepStrictEqual(ranges, {
    //         ranges: [
    //             { start: { line: 0, character: 1 }, end: { line: 0, character: 4 } },
    //             { start: { line: 0, character: 7 }, end: { line: 0, character: 10 } }
    //         ]
    //     });
    // });
});
