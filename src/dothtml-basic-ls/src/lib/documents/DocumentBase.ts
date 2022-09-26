import { TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { Position, Range, TextDocument } from 'vscode-languageserver-textdocument';
import { getParser, OffsetRange, ParsedTree } from '../parserutils';
import { getLineOffsets, offsetAt, positionAt } from './utils';
import type TreeSitter from 'tree-sitter';

/**
 * Represents a textual document.
 */
export abstract class ReadableDocument implements TextDocument {

    constructor(public languageId: string) {
    }
    /**
     * Get the text content of the document
     */
    abstract getText(range?: Range): string;

    /**
     * Returns the url of the document
     */
    abstract getURL(): string;

    /**
     * Returns the file path if the url scheme is file
     */
    abstract getFilePath(): string | null;

    /**
     * Current version of the document.
     */
    public version = 0;

    /**
     * Should be cleared when there's an update to the text
     */
    protected lineOffsets?: number[];

    /**
     * Get the length of the document's content
     */
    getTextLength(): number {
        return this.getText().length;
    }

    /**
     * Get the line and character based on the offset
     * @param offset The index of the position
     */
    positionAt(offset: number): Position {
        return positionAt(offset, this.getText(), this.getLineOffsets());
    }

    rangeWithLen(start: number, length: number): Range {
        return {
            start: this.positionAt(start),
            end: this.positionAt(start + length)
        };
    }

    /**
     * Get the index of the line and character position
     * @param position Line and character position
     */
    offsetAt(position: Position | number): number {
        if (typeof position == "number")
            return position

        return offsetAt(position, this.getText(), this.getLineOffsets());
    }

    private getLineOffsets() {
        if (!this.lineOffsets) {
            this.lineOffsets = getLineOffsets(this.getText());
        }
        return this.lineOffsets;
    }

    /**
     * Implements TextDocument
     */
    get uri(): string {
        return this.getURL();
    }

    get lineCount(): number {
        return this.getText().split(/\r?\n/).length;
    }

    getLastNonWhitespaceIndex(startIndex: number) {
        const text = this.getText();
        for (let i = startIndex; i >= 0; i--) {
            if (!/\s/.test(text[i])) return i
        }
        return 0
    }
    isAtLineEnd(offset: number) {
        const text = this.getText();
        while (text[offset] == ' ' || text[offset] == '\t') {
            offset++
        }
        return text[offset] == '\n' || text[offset] == '\r' || offset == text.length
    }
    isAtLineStart(offset: number) {
        offset = offset - 1
        const text = this.getText();
        while (text[offset] == ' ' || text[offset] == '\t') {
            offset--
        }
        return text[offset] == '\n' || text[offset] == '\r' || offset == 0
    }
}

/**
 * Represents a textual document that can be manipulated.
 */
export abstract class WritableDocument extends ReadableDocument {

    tree: ParsedTree | undefined;

    constructor(
        public content: string,
        languageId: string
    ) {
        super(languageId);

        const parser = getParser(languageId);
        if (parser) {
            try {
                this.tree = new ParsedTree(parser, this.content);
            } catch (e) {
                console.error("Tree-sitter init failed:", e)
            }
        }
    }
    /**
     * Set text content and increase the document version
     */
    setText(text: string) {
        this.content = text;
        this.version++;
        this.lineOffsets = undefined;
        this.tree?.reparse(text);
    }

    #update(text: string, start: number, end: number): void {
        this.lineOffsets = undefined;
        this.content = this.content.slice(0, start) + text + this.content.slice(end)
    }

    applyChanges(changes: TextDocumentContentChangeEvent[]): void {
        const treeEdits: TreeSitter.Edit[] = []
        let reparse = false
        for (const change of changes) {
            let start = 0;
            let end = 0;
            if ('range' in change) {
                start = this.offsetAt(change.range.start);
                end = this.offsetAt(change.range.end);

                const newEnd = start + change.text.length
                const changeLines = change.text.split(/\n/)
                const newEndLine = change.range.start.line + changeLines.length
                const newEndChar =
                    changeLines.length > 1
                        ? changeLines[changeLines.length - 1].length
                        : change.range.start.character + change.text.length

                treeEdits.push({
                    startIndex: start,
                    startPosition: { row: change.range.start.line, column: change.range.start.character },
                    oldEndIndex: end,
                    newEndIndex: newEnd,
                    oldEndPosition: { row: change.range.end.line, column: change.range.end.character },
                    newEndPosition: { row: newEndLine, column: newEndChar },
                })

            } else {
                end = this.getTextLength();
                reparse = true
            }


            this.#update(change.text, start, end);
        }

        if (reparse) {
            this.tree?.reparse(this.content)
        } else {
            this.tree?.update(treeEdits, this.content)
        }

        this.version++
    }
}
