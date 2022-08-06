import { Position } from 'vscode-languageserver';
import {
    Document,
    TagInformation
} from '../../lib/documents';


/**
 * Represents a text document that contains a some DotVVM markup. May be used to cache parsed data
 */
export class DotvvmDocument {
    public script: TagInformation | null;
    public moduleScript: TagInformation | null;
    public style: TagInformation | null;
    public languageId = 'dotvvm';
    public version = 0;
    public uri = this.parent.uri;

    constructor(public parent: Document) {
        this.script = this.parent.scriptInfo;
        this.moduleScript = this.parent.moduleScriptInfo;
        this.style = this.parent.styleInfo;
        this.version = this.parent.version;
    }

    getText() {
        return this.parent.getText();
    }

    getFilePath(): string {
        return this.parent.getFilePath() || '';
    }

    offsetAt(position: Position): number {
        return this.parent.offsetAt(position);
    }
}

