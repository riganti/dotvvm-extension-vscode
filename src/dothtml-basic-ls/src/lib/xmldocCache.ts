
type ParsedMemberDocumentation = {
	summary: string
}

type ParsedAssemblyDocumentation = {
	types: {
		[typeName: string]: ParsedMemberDocumentation
	}
}

let xmlDocumentationCache: Record<string, ParsedAssemblyDocumentation> = {};

export function getXmlDocumentation(assemblyName: string): ParsedAssemblyDocumentation | null {
	return null
}
