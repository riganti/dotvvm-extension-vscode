import sinon from 'sinon';
import * as assert from 'assert';
import { TextDocumentItem, Range } from 'vscode-languageserver-types';
import { DocumentManager, DotvvmDocument } from '../../../src/lib/documents';

describe('Document Manager', () => {
    const textDocument: TextDocumentItem = {
        uri: 'file:///hello.dothtml',
        version: 0,
        languageId: 'dotvvm',
        text: 'Hello, world!'
    };

    const createTextDocument = (textDocument: Pick<TextDocumentItem, 'uri' | 'text'>) =>
        new DotvvmDocument(textDocument.uri, textDocument.text);

    it('opens documents', () => {
        const createDocument = sinon.spy();
        const manager = new DocumentManager(createDocument);

        manager.openDocument(textDocument);

        sinon.assert.calledOnce(createDocument);
        sinon.assert.calledWith(createDocument.firstCall, textDocument);
    });

    it("fails to update if document isn't open", () => {
        const manager = new DocumentManager(createTextDocument);

        assert.throws(() => manager.updateDocument(textDocument, []));
    });

    it('emits a document change event on open and update', () => {
        const manager = new DocumentManager(createTextDocument);
        const cb = sinon.spy();

        manager.on('documentChange', cb);

        manager.openDocument(textDocument);
        sinon.assert.calledOnce(cb);

        manager.updateDocument(textDocument, []);
        sinon.assert.calledTwice(cb);
    });
});
