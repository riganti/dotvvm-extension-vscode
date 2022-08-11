import { urlToPath } from '../../utils';
import { WritableDocument } from './DocumentBase';
import { extractScriptTags, extractStyleTag, extractTemplateTag, TagInformation } from './utils';
import { parseHtml } from './parseHtml';
import { HTMLDocument } from 'vscode-html-languageservice';
import { Range } from 'vscode-languageserver';

/**
 * Represents a text document contains a svelte component.
 */
export class DotvvmDocument extends WritableDocument {
    scriptInfo: TagInformation | null = null;
    moduleScriptInfo: TagInformation | null = null;
    styleInfo: TagInformation | null = null;
    templateInfo: TagInformation | null = null;
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

    /**
     * Returns the language associated to script, style or template.
     * Returns an empty string if there's nothing set.
     */
    getLanguageAttribute(tag: 'script' | 'style' | 'template'): string {
        const attrs =
            (tag === 'style'
                ? this.styleInfo?.attributes
                : tag === 'script'
                ? this.scriptInfo?.attributes || this.moduleScriptInfo?.attributes
                : this.templateInfo?.attributes) || {};
        const lang = attrs.lang || attrs.type || '';
        return lang.replace(/^text\//, '');
    }

    /**
     * Returns true if there's `lang="X"` on script or style or template.
     */
    hasLanguageAttribute(): boolean {
        return (
            !!this.getLanguageAttribute('script') ||
            !!this.getLanguageAttribute('style') ||
            !!this.getLanguageAttribute('template')
        );
    }
}
