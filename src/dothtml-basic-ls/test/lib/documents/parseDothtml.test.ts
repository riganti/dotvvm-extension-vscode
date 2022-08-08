import assert from 'assert';
import { NodeOfType, SyntaxNode } from 'tree-sitter-dotvvm';
import { HTMLDocument } from 'vscode-html-languageservice';
import { DotvvmDocument } from '../../../src/lib/documents';
import { parseHtml } from '../../../src/lib/documents/parseHtml';
import { typeChild } from '../../../src/lib/parserutils';

describe('parseHtml', () => {
    function testDocument(markup: string) {
        const document = new DotvvmDocument('file:///hello.svelte', markup);
        return document
    }

    it('finds viewmodel directive', () => {
        const doc = testDocument(`
            @baseType Buuu
            @viewModel My.Object, Assembly
            
            <span class="foo"> </span>
        `)

        const node =doc.tree?.rootNode
        assert.notEqual(null, node)

        const a: SyntaxNode & { type: "directive_general_value" } = null!

        const x = node!.descendantsOfType('directive_viewModel')
        console.log(x)
        assert.equal(1, x.length)
        let typeAssembly = typeChild("directive_assembly_qualified_name", x[0])
        assert.equal("My.Object, Assembly", typeAssembly?.text)
        let fullName = typeChild("cs_type_name", typeAssembly)
        assert.equal("My.Object", fullName?.text)
        assert.equal("Object", fullName!.typeNameNode.text)
    });

});
