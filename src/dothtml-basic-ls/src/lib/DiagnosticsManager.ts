import { _Connection, TextDocumentIdentifier, Diagnostic } from 'vscode-languageserver';
import { DocumentManager, DotvvmDocument } from './documents';

export type SendDiagnostics = _Connection['sendDiagnostics'];
export type GetDiagnostics = (doc: TextDocumentIdentifier) => Thenable<Diagnostic[]>;

export class DiagnosticsManager {
    constructor(
        private sendDiagnostics: SendDiagnostics,
        private docManager: DocumentManager,
        private getDiagnostics: GetDiagnostics
    ) {}

    updateAll() {
        this.docManager.getAllOpenedByClient().forEach((doc) => {
            this.update(doc[1]);
        });
    }

    async update(document: DotvvmDocument) {
        const diagnostics = await this.getDiagnostics({ uri: document.getURL() });
        this.sendDiagnostics({
            uri: document.getURL(),
            diagnostics
        });
    }

    removeDiagnostics(document: DotvvmDocument) {
        this.sendDiagnostics({
            uri: document.getURL(),
            diagnostics: []
        });
    }
}
