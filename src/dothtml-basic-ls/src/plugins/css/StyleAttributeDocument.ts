import { LanguageService, Stylesheet } from 'vscode-css-languageservice';
import { Position } from 'vscode-languageserver';
import { DotvvmDocument, DocumentMapper, ReadableDocument } from '../../lib/documents';

const PREFIX = '__ { ';
const SUFFIX = ' ;}';

export class StyleAttributeDocument extends ReadableDocument implements DocumentMapper {
    readonly version : number;
    public stylesheet: Stylesheet;

    constructor(
        private readonly parent: DotvvmDocument,
        private readonly attrStart: number,
        private readonly attrEnd: number,
        cssLanguage: LanguageService
    ) {
        super('css');

        this.version = parent.version;
        this.stylesheet = cssLanguage.parseStylesheet(this);
    }

    /**
     * Get the fragment position relative to the parent
     * @param pos Position in fragment
     */
    getOriginalPosition(pos: Position): Position {
        const parentOffset = this.attrStart + this.offsetAt(pos) - PREFIX.length;
        return this.parent.positionAt(parentOffset);
    }

    /**
     * Get the position relative to the start of the fragment
     * @param pos Position in parent
     */
    getGeneratedPosition(pos: Position): Position {
        const fragmentOffset = this.parent.offsetAt(pos) - this.attrStart + PREFIX.length;
        return this.positionAt(fragmentOffset);
    }

    /**
     * Returns true if the given parent position is inside of this fragment
     * @param pos Position in parent
     */
    isInGenerated(pos: Position): boolean {
        const offset = this.parent.offsetAt(pos);
        return offset >= this.attrStart && offset <= this.attrEnd;
    }

    /**
     * Get the fragment text from the parent
     */
    getText(): string {
        return PREFIX + this.parent.getText().slice(this.attrStart, this.attrEnd) + SUFFIX;
    }

    /**
     * Returns the length of the fragment as calculated from the start and end position
     */
    getTextLength(): number {
        return PREFIX.length + this.attrEnd - this.attrStart + SUFFIX.length;
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
