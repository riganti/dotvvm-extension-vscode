// TODO haha, it's not that simple

import { Logger } from "../logger"
import { nullish } from "../utils"

export type DotnetType = {
	namespace: string
	name: string
	assembly: string | null
	fullName: string
} & (
	| { kind: "simple" }
	| { kind: "generic", typeArgs: DotnetType[] }
	| { kind: "array", elementType: DotnetType, dimension: number }
	| { kind: "reference", elementType: DotnetType }
	| { kind: "pointer", elementType: DotnetType }
)

// https://docs.microsoft.com/en-us/dotnet/framework/reflection-and-codedom/specifying-fully-qualified-type-names#grammar-for-type-names

function parseCore(t: string): { type: DotnetType, rest: string } | null {
	const startMatch = /^(?<fullname>((?<namespace>[\w._0-9]+)\.)?(?<name>[\w_0-9+`<>]+))(, *(?<assembly>[^\]]*))?/.exec(t);

	if (!startMatch || !startMatch.groups) {
		return null
	}
	const { namespace, name, assembly } = startMatch.groups;
	const rest = t.substring(startMatch[0].length);
	const type: DotnetType = {
		namespace: namespace ?? '',
		name,
		assembly: assembly?.trim(),
		fullName: startMatch.groups.fullname,
		kind: "simple"
	}
	return parseSuffixes(type, rest)
}

function parseSuffixes(type: DotnetType, rest: string): { type: DotnetType, rest: string } | null {
	rest = rest.trimStart();
	const { namespace, name, assembly, fullName } = type
	const arrayQualifier = /^\[[.*,0-9…]*\]/.exec(rest)
	if (rest == '' || rest.startsWith(']')) {
		// matched to the end - simple type name
		return {
			rest,
			type
		}
	}
	// array
	else if (arrayQualifier) {
		type = { kind: "array", namespace, assembly,
			elementType: type,
			dimension: arrayQualifier[0].split(',').length,
			name: `${name}${arrayQualifier[0]}`,
			fullName: `${fullName}${arrayQualifier[0]}`
		}
		return parseSuffixes(type, rest.substring(arrayQualifier[0].length))
	}

	// reference / ptr
	else if (rest.startsWith('&') || rest.startsWith('*')) {
		type = {
			kind: rest[0] == '&' ? "reference" : "pointer",
			namespace,
			assembly,
			elementType: type,
			name: `${name}${rest[0]}`,
			fullName: `${fullName}${rest[0]}`
		}
		return parseSuffixes(type, rest.substring(1))
	}

	// generic
	else if (rest.startsWith('[[')) {
		console.assert(rest.includes(']]'), "Generic type arguments without end ]]: " + rest)

		const typeArgs = []
		let rest2 = rest.substring(2)
		while (true) {
			const parsedArg = parseCore(rest2)
			if (!parsedArg) {
				Logger.log(`parseCore failed with this thing: ${rest2}`)
				return null
			}
			typeArgs.push(parsedArg.type)
			rest2 = parsedArg.rest.trimStart()

			if (rest2.startsWith('],[')) {
				rest2 = rest2.substring(3)
			} else {
				console.assert(rest2.startsWith(']]'), "Invalid generic type arguments: " + rest2)
				rest2 = rest2.substring(2)
				break
			}
		}

		type = {
			kind: "generic",
			namespace,
			assembly,
			typeArgs,
			name: `${name}[${typeArgs.map(t => '[' + t.name + ']').join(',')}]`,
			fullName: `${fullName}[${typeArgs.map(t => '[' + t.fullName + ']').join(',')}]`
		}
		return parseSuffixes(type, rest2)
	}

	else if (rest.startsWith(',')) {
		const m = /(, *(?<assembly>[^\]]*))/.exec(rest)!
		// assembly name
		type = { ...type, assembly: assembly + m.groups!.assembly }
		rest = rest.substring(m[0].length)
		return parseSuffixes(type, rest)
	} else {
		Logger.log(`Invalid rest: ${rest}`)
		return null
	}
}

export function parseTypeName(t: string): DotnetType | null {
	const parsed = parseCore(t)
	if (!parsed) {
		return null
	}
	console.assert(parsed.rest == '', "Something remained after parsing type name: " + parsed.rest)
	return parsed.type
}

const specializedCollectionTypes: { [k: string]: DotnetType } = {
	"DotVVM.Framework.Controls.PostBackHandlerCollection": parseTypeName("DotVVM.Framework.Controls.PostBackHandler, DotVVM.Framework")!
}

const genericCollectionTypes = new Set(["IEnumerable`1", "IEnumerator`1", "ICollection`1", "IList`1", "IReadOnlyList`1", "IReadOnlyCollection`1", "List`1", "Collection`1"])

export function getCollectionElementType(t: string | DotnetType | nullish): DotnetType | null {
	if (!t) {
		return null
	}
	if (typeof t == 'string') {
		t = parseTypeName(t)
		if (!t) throw new Error("Invalid type name: " + t)
	}

	if (t.kind == "array") {
		return t.elementType
	}
	if (t.kind == 'simple') {
		if (t.fullName in specializedCollectionTypes) {
			return specializedCollectionTypes[t.fullName]
		} else {
			return null
		}
	}

	if (t.kind == 'generic' && genericCollectionTypes.has(t.name)) {
		return t.typeArgs[0]
	}

	return null
}


export const KnownDotnetTypes = {
	HtmlGenericControl: parseTypeName('DotVVM.Framework.Controls.HtmlGenericControl, DotVVM.Framework')!,
	DotvvmControl: parseTypeName('DotVVM.Framework.Controls.DotvvmControl, DotVVM.Framework')!,
	DotvvmBindableObject: parseTypeName('DotVVM.Framework.Controls.DotvvmBindableObject, DotVVM.Framework')!,
}
