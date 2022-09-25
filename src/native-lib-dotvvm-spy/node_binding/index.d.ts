export class AnalyzerContext {
	constructor(path: string, searchPaths: string[]);

	contextId: number
	dispose(): void
	findImplementations(interface: string, flags: number, limit: number): string[]
}

export function sanityCheck(): boolean
