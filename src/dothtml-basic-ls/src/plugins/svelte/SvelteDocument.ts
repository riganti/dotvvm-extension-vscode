import { TraceMap } from '@jridgewell/trace-mapping';
import type { compile } from 'svelte/compiler';
import { CompileOptions } from 'svelte/types/compiler/interfaces';
import { PreprocessorGroup, Processed } from 'svelte/types/compiler/preprocess/types';
import { Position } from 'vscode-languageserver';
import {
    Document,
    DocumentMapper,
    extractScriptTags,
    extractStyleTag,
    FragmentMapper,
    IdentityMapper,
    isInTag,
    offsetAt,
    positionAt,
    SourceMapDocumentMapper,
    TagInformation
} from '../../lib/documents';

export type SvelteCompileResult = ReturnType<typeof compile>;

export enum TranspileErrorSource {
    Script = 'Script',
    Style = 'Style'
}

type PositionMapper = Pick<DocumentMapper, 'getGeneratedPosition' | 'getOriginalPosition'>;

/**
 * Represents a text document that contains a svelte component.
 */
export class SvelteDocument {
    public script: TagInformation | null;
    public moduleScript: TagInformation | null;
    public style: TagInformation | null;
    public languageId = 'svelte';
    public version = 0;
    public uri = this.parent.uri;

    constructor(private parent: Document) {
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

export class SvelteFragmentMapper implements PositionMapper {
    static createStyle(originalDoc: Document, transpiled: string, processed: Processed[]) {
        return SvelteFragmentMapper.create(
            originalDoc,
            transpiled,
            originalDoc.styleInfo,
            extractStyleTag(transpiled),
            processed
        );
    }

    static createScript(originalDoc: Document, transpiled: string, processed: Processed[]) {
        const scriptInfo = originalDoc.scriptInfo || originalDoc.moduleScriptInfo;
        const maybeScriptTag = extractScriptTags(transpiled);
        const maybeScriptTagInfo =
            maybeScriptTag && (maybeScriptTag.script || maybeScriptTag.moduleScript);

        return SvelteFragmentMapper.create(
            originalDoc,
            transpiled,
            scriptInfo,
            maybeScriptTagInfo || null,
            processed
        );
    }

    private static create(
        originalDoc: Document,
        transpiled: string,
        originalTagInfo: TagInformation | null,
        transpiledTagInfo: TagInformation | null,
        processed: Processed[]
    ) {
        const sourceMapper =
            processed.length > 0
                ? SvelteFragmentMapper.createSourceMapper(processed, originalDoc)
                : new IdentityMapper(originalDoc.uri);

        if (originalTagInfo && transpiledTagInfo) {
            const sourceLength = originalTagInfo.container.end - originalTagInfo.container.start;
            const transpiledLength =
                transpiledTagInfo.container.end - transpiledTagInfo.container.start;
            const diff = sourceLength - transpiledLength;

            return new SvelteFragmentMapper(
                { end: transpiledTagInfo.container.end, diff },
                new FragmentMapper(originalDoc.getText(), originalTagInfo, originalDoc.uri),
                new FragmentMapper(transpiled, transpiledTagInfo, originalDoc.uri),
                sourceMapper
            );
        }

        return null;
    }

    private static createSourceMapper(processed: Processed[], originalDoc: Document) {
        return processed.reduce(
            (parent, processedSingle) =>
                processedSingle?.map
                    ? new SourceMapDocumentMapper(
                          createTraceMap(processedSingle.map),
                          originalDoc.uri,
                          parent
                      )
                    : new IdentityMapper(originalDoc.uri, parent),
            <DocumentMapper>(<any>undefined)
        );
    }

    private constructor(
        /**
         * End offset + length difference to original
         */
        public fragmentInfo: { end: number; diff: number },
        /**
         * Maps between full original source and fragment within that original.
         */
        private originalFragmentMapper: DocumentMapper,
        /**
         * Maps between full transpiled source and fragment within that transpiled.
         */
        private transpiledFragmentMapper: DocumentMapper,
        /**
         * Maps between original and transpiled, within fragment.
         */
        private sourceMapper: DocumentMapper
    ) {}

    isInTranspiledFragment(generatedPosition: Position): boolean {
        return this.transpiledFragmentMapper.isInGenerated(generatedPosition);
    }

    getOriginalPosition(generatedPosition: Position): Position {
        // Map the position to be relative to the transpiled fragment
        const positionInTranspiledFragment =
            this.transpiledFragmentMapper.getGeneratedPosition(generatedPosition);
        // Map the position, using the sourcemap, to the original position in the source fragment
        const positionInOriginalFragment = this.sourceMapper.getOriginalPosition(
            positionInTranspiledFragment
        );
        // Map the position to be in the original fragment's parent
        return this.originalFragmentMapper.getOriginalPosition(positionInOriginalFragment);
    }

    /**
     * Reversing `getOriginalPosition`
     */
    getGeneratedPosition(originalPosition: Position): Position {
        const positionInOriginalFragment =
            this.originalFragmentMapper.getGeneratedPosition(originalPosition);
        const positionInTranspiledFragment = this.sourceMapper.getGeneratedPosition(
            positionInOriginalFragment
        );
        return this.transpiledFragmentMapper.getOriginalPosition(positionInTranspiledFragment);
    }
}

/**
 * Wrap preprocessors and rethrow on errors with more info on where the error came from.
 */
function wrapPreprocessors(preprocessors: PreprocessorGroup | PreprocessorGroup[] = []) {
    preprocessors = Array.isArray(preprocessors) ? preprocessors : [preprocessors];
    return preprocessors.map((preprocessor) => {
        const wrappedPreprocessor: PreprocessorGroup = { markup: preprocessor.markup };

        if (preprocessor.script) {
            wrappedPreprocessor.script = async (args: any) => {
                try {
                    return await preprocessor.script!(args);
                } catch (e: any) {
                    e.__source = TranspileErrorSource.Script;
                    throw e;
                }
            };
        }

        if (preprocessor.style) {
            wrappedPreprocessor.style = async (args: any) => {
                try {
                    return await preprocessor.style!(args);
                } catch (e: any) {
                    e.__source = TranspileErrorSource.Style;
                    throw e;
                }
            };
        }

        return wrappedPreprocessor;
    });
}

function createTraceMap(map: any): TraceMap {
    return new TraceMap(normalizeMap(map));

    function normalizeMap(map: any) {
        // We don't know what we get, could be a stringified sourcemap,
        // or a class which has the required properties on it, or a class
        // which we need to call toString() on to get the correct format.
        if (typeof map === 'string' || map.version) {
            return map;
        }
        return map.toString();
    }
}
