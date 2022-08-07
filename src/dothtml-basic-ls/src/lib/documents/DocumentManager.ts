import { EventEmitter } from 'events';
import {
    TextDocumentContentChangeEvent,
    TextDocumentItem,
    VersionedTextDocumentIdentifier
} from 'vscode-languageserver';
import { DotvvmDocument } from './Document';
import { normalizeUri } from '../../utils';

export type DocumentEvent = 'documentOpen' | 'documentChange' | 'documentClose';

/**
 * Manages svelte documents
 */
export class DocumentManager {
    private emitter = new EventEmitter();
    private openedInClient = new Set<string>();
    private documents: Map<string, DotvvmDocument> = new Map();
    private locked = new Set<string>();
    private deleteCandidates = new Set<string>();

    constructor(
        private createDocument: (textDocument: Pick<TextDocumentItem, 'text' | 'uri'>) => DotvvmDocument
    ) {}

    openDocument(textDocument: Pick<TextDocumentItem, 'text' | 'uri'>): DotvvmDocument {
        textDocument = { ...textDocument, uri: normalizeUri(textDocument.uri) };

        let document: DotvvmDocument;
        if (this.documents.has(textDocument.uri)) {
            document = this.documents.get(textDocument.uri)!;
            document.setText(textDocument.text);
        } else {
            document = this.createDocument(textDocument);
            this.documents.set(textDocument.uri, document);
            this.notify('documentOpen', document);
        }

        this.notify('documentChange', document);

        return document;
    }

    lockDocument(uri: string): void {
        this.locked.add(normalizeUri(uri));
    }

    markAsOpenedInClient(uri: string): void {
        this.openedInClient.add(normalizeUri(uri));
    }

    getAllOpenedByClient() {
        return Array.from(this.documents.entries()).filter((doc) =>
            this.openedInClient.has(doc[0])
        );
    }

    releaseDocument(uri: string): void {
        uri = normalizeUri(uri);

        this.locked.delete(uri);
        this.openedInClient.delete(uri);
        if (this.deleteCandidates.has(uri)) {
            this.deleteCandidates.delete(uri);
            this.closeDocument(uri);
        }
    }

    closeDocument(uri: string) {
        uri = normalizeUri(uri);

        const document = this.documents.get(uri);
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        this.notify('documentClose', document);

        // Some plugin may prevent a document from actually being closed.
        if (!this.locked.has(uri)) {
            this.documents.delete(uri);
        } else {
            this.deleteCandidates.add(uri);
        }

        this.openedInClient.delete(uri);
    }

    updateDocument(
        textDocument: VersionedTextDocumentIdentifier,
        changes: TextDocumentContentChangeEvent[]
    ) {
        const document = this.documents.get(normalizeUri(textDocument.uri));
        if (!document) {
            throw new Error('Cannot call methods on an unopened document');
        }

        document.applyChanges(changes);

        this.notify('documentChange', document);
    }

    on(name: DocumentEvent, listener: (document: DotvvmDocument) => void) {
        this.emitter.on(name, listener);
    }

    get(uri: string) {
        return this.documents.get(normalizeUri(uri));
    }

    private notify(name: DocumentEvent, document: DotvvmDocument) {
        this.emitter.emit(name, document);
    }
}
