import { LanguageService, Stylesheet, TextDocument } from 'vscode-css-languageservice';
import { Position } from 'vscode-languageserver';
import { DotvvmDocument, DocumentMapper, ReadableDocument, TagInformation } from '../../lib/documents';

export interface CSSDocumentBase extends DocumentMapper, TextDocument {
    languageId: string;
    stylesheet: Stylesheet;
}

export class CSSDocument extends ReadableDocument implements DocumentMapper {
    readonly version: number;

    public stylesheet: Stylesheet;

    constructor(
        private parent: DotvvmDocument,
        cssLanguage: LanguageService,
        private range: [ number, number ]
    ) {
        if (parent == null)
            throw new Error("parent is null");
        
        super('css');
        
        this.version = parent.version

        this.stylesheet = cssLanguage.parseStylesheet(
            this
        );
    }

    /**
     * Get the fragment position relative to the parent
     * @param pos Position in fragment
     */
    getOriginalPosition(pos: Position): Position {
        const parentOffset = this.range[0] + this.offsetAt(pos);
        return this.parent.positionAt(parentOffset);
    }

    /**
     * Get the position relative to the start of the fragment
     * @param pos Position in parent
     */
    getGeneratedPosition(pos: Position): Position {
        const fragmentOffset = this.parent.offsetAt(pos) - this.range[0];
        return this.positionAt(fragmentOffset);
    }

    /**
     * Returns true if the given parent position is inside of this fragment
     * @param pos Position in parent
     */
    isInGenerated(pos: Position): boolean {
        const [start, end] = this.range
        const offset = this.parent.offsetAt(pos);
        return offset >= start && offset <= end;
    }

    /**
     * Get the fragment text from the parent
     */
    getText(): string {
        return this.parent.getText().slice(...this.range);
    }

    /**
     * Returns the length of the fragment as calculated from the start and end positon
     */
    getTextLength(): number {
        return this.range[1] - this.range[0];
    }

    /**
     * Return the parent file path
     */
    getFilePath(): string | null {
        return this.parent.getFilePath();
    }

    getURL() {
        return this.parent.getURL();
    }
}
