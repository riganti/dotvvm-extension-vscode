import { urlToPath } from '../../utils';
import { WritableDocument } from './DocumentBase';
import { parseHtml } from './parseHtml';
import { HTMLDocument } from 'vscode-html-languageservice';
import { Position, Range } from 'vscode-languageserver';
import type { AttributeNode, HtmlElementNode, ScriptElementNode, StyleElementNode } from 'tree-sitter-dotvvm';
import { typeAncestor } from '../parserutils';
import { Logger } from '../../logger';

export type DothtmlSublanguage =
    | { lang: 'html' }
    | { lang: 'dotvvm-specific' }
    | { lang: 'css' | 'js', range: [ number, number ], element: HtmlElementNode | ScriptElementNode | StyleElementNode | null, attribute?: AttributeNode | null }


export type DotvvmDocumentType = "control" | "page" | "masterpage"
/**
 * Represents a text document contains a svelte component.
 */
export class DotvvmDocument extends WritableDocument {
    html!: HTMLDocument;
    /**
     * Compute and cache directly because of performance reasons
     * and it will be called anyway.
     */
    private path: string | null;

    constructor(public url: string, content: string) {
        super(content, "dotvvm");
        this.path = urlToPath(this.url)
        this.updateDocInfo();
    }

    private updateDocInfo() {
        this.html = parseHtml(this.content);
    }

    determineSublanguage(position: Position | number): DothtmlSublanguage {
        position = this.offsetAt(position)
        let node = this.tree?.nodeAt(position) ?? null;

        while (true) {
            if (!node || node.type === "html_element") {
                return { lang: 'html' };
            }

            if (node.type == "attribute_binding" || node.type == "literal_binding" || node.type.startsWith("cs_")) {
                return { lang: 'dotvvm-specific' };
            }

            if (node.type == 'attribute') {
                const name = node.nameNode.text.toLowerCase()
                let range: [number, number]
                if (node.valueNode) {
                    range = [node.valueNode.startIndex, node.valueNode.endIndex]
                } else {
                    if (node.text.endsWith("'") || node.text.endsWith('"')) {
                        range = [node.endIndex - 1, node.endIndex - 1]
                    } else if (node.text.endsWith('=')) {
                        range = [node.endIndex, node.endIndex]
                    } else {
                        return { lang: 'html' };
                    }
                }

                if (name == 'style' || name.startsWith('on')) {
                    return { lang: name == 'style' ? 'css' : 'js', range, element: typeAncestor("html_element", node)!, attribute: node };
                }
            }

            if (node.type == 'style_element' || node.type == 'script_element') {
                if (position >= node.startNode.endIndex && position <= node.endNode.startIndex) {
                    return {
                        lang: node.type == 'script_element' ? 'js' : 'css',
                        range: [node.startNode.endIndex, node.endNode.startIndex],
                        element: node.parent as any
                    }
                }
            }

            node = node.parent
        }
    }

    findStyleRanges(): (DothtmlSublanguage & { lang: 'css' })[] {
        if (!this.tree) {
            return []
        }
        const nodes = this.tree.findStyleNodes()
        return nodes.map(n => {
            const attribute = n.parent?.type == "attribute" ? n.parent : null
            return { lang: 'css', range: [n.startIndex, n.endIndex], element: typeAncestor(["html_element", "style_element"], n)!, attribute }
        })
    }

    /**
     * Get text content
     */
    getText(range?: Range): string {
        // Currently none of our own methods use the optional range parameter,
        // but it's used by the HTML language service during hover
        if (range) {
            return this.content.substring(this.offsetAt(range.start), this.offsetAt(range.end));
        }
        return this.content;
    }

    /**
     * Returns the file path if the url scheme is file
     */
    getFilePath(): string | null {
        return this.path;
    }

    /**
     * Get URL file path.
     */
    getURL() {
        return this.url;
    }

    get dotvvmType(): DotvvmDocumentType {
        if (this.path?.endsWith(".dotmaster") || this.path?.endsWith(".dotlayout")) {
            return "masterpage"
        }

        const directives =
            this.tree?.rootNode.descendantsOfType("directives")?.[0]
        if (!directives) {
            Logger.log("No directives found in document?", this.path)
        }
        Logger.log(directives?.toString())
        const hasControlDirectives = directives && (
            directives.baseTypeNodes.length > 0 ||
            directives.propertyNodes.length > 0)
        if (this.path?.endsWith(".dotcontrol") || hasControlDirectives) {
            return "control"
        }
        return "page"
    }
}
