import * as _ from "lodash";
import { parse } from "path";
import { AttributeNode, HtmlElementNode, ScriptElementNode, StyleElementNode, SyntaxNode } from "tree-sitter-dotvvm";
import { Logger } from "../logger";
import { choose, emptyArray, emptyObject, nullish, unique, uniqueBy } from "../utils";
import { DotnetType, parseTypeName } from "./dotnetUtils";
import { nodeToORange, OffsetRange, typeAncestor } from "./parserutils";
import { CodeControlRegistrationInfo, DotvvmControlInfo, DotvvmPropertyGroupInfo, DotvvmPropertyInfo, MarkupControlRegistrationInfo, PropertyMappingMode, SerializedConfigSeeker } from "./serializedConfigSeeker";


export type FullControlInfo = DotvvmControlInfo & {
	name: string
	fullName: string
	properties: { readonly [name: string]: Readonly<DotvvmPropertyInfo> },
	propGroups: { readonly [name: string]: Readonly<DotvvmPropertyGroupInfo> },
	capabilities: { readonly [name: string]: Readonly<DotvvmPropertyInfo> },
}

export type ResolveControlResult =
	| { kind: "markup", type: FullControlInfo | null } & MarkupControlRegistrationInfo
	| { kind: "code", type: FullControlInfo } & CodeControlRegistrationInfo
	| { kind: "js-component", type: FullControlInfo, name: string }
	| { kind: "html", type: FullControlInfo, name: string }

export type NamedDotvvmPropertyInfo = { name: string, declaringType: string } & DotvvmPropertyInfo
export type NamedDotvvmPropertyGroupInfo = { name: string, declaringType: string } & DotvvmPropertyGroupInfo

export function getControlLookupTable(config: SerializedConfigSeeker) {
	return config.cached("control-lookup", c => {
		const controls = c.flatMap(c => c.config.markup.controls)

		const markupControls = new Map<string, MarkupControlRegistrationInfo>()
		const controlPrefix = new Map<string, CodeControlRegistrationInfo[]>()
		for (const c of controls) {
			if ("tagName" in c) {
				markupControls.set(c.tagName, c)
			} else {
				let list = controlPrefix.get(c.tagPrefix)
				if (list == null)
					controlPrefix.set(c.tagPrefix, list = [])
				if (list.some(l => "namespace" in l && l.namespace === c.namespace && l.assembly === c.assembly))
					continue
				list.push(c)
			}
		}

		return {
			markupControls,
			controlPrefix
		}
	})
}

export function findControl(config: SerializedConfigSeeker, type: string | DotnetType | nullish): undefined | FullControlInfo {
	if (type == null) return

	const t = typeof type == 'string' ? parseTypeName(type) : type
	if (!t) return

	for (const c of Object.values(config.configs)) {
		if (c.controls && t.fullName in c.controls) {
			return {
				...c.controls[t.fullName],
				fullName: t.fullName,
				name: t.name,
				properties: c.properties[t.fullName] ?? emptyObject,
				propGroups: c.propertyGroups[t.fullName] ?? emptyObject,
				capabilities: c.capabilities[t.fullName] ?? emptyObject
			}
		}
	}
}

export function resolveControl(config: SerializedConfigSeeker, name: string): ResolveControlResult | undefined {
	if (name.startsWith('js:'))
		return { kind: "js-component", type: findControl(config, "DotVVM.Framework.Controls.JsComponent")!, name: name.substring(3) }

	if (!name.includes(':'))
		return { kind: "html", type: findControl(config, "DotVVM.Framework.Controls.HtmlGenericControl")!, name: name }

	const table = getControlLookupTable(config)
	const markupControl = table.markupControls.get(name)
	if (markupControl)
		return { kind: "markup", type: null, ...markupControl }

	const [prefix, className] = name.split(":")
	const codeControlReg =
		table.controlPrefix.get(prefix)
			?.find(c => findControl(config, c.namespace + "." + className))

	
	if (codeControlReg) {
		const type = findControl(config, codeControlReg.namespace + "." + className)!
		return { kind: "code", type, ...codeControlReg }
	}

	console.log("Unknown control: " + name, "didn't find any of", table.controlPrefix.get(prefix)?.map(c => c.namespace + "." + className))
}

export type ResolvedControlInfo = {
	kind: "markup" | "code",
	type: DotnetType | null
}

function elementName(e: HtmlElementNode | ScriptElementNode | StyleElementNode): string {
	const t = e.type
	if (t === "script_element")
		return "script"
	if (t === "style_element")
		return "style"
	return e.startNode?.nameNode.text ?? e.selfClosingNode?.nameNode.text ?? "unknown"
}

export type ControlListResult = {
	tag: string
	control: ResolveControlResult & { kind: "markup" | "code" }
	description?: string
}
export function listAllControls(config: SerializedConfigSeeker): ControlListResult[] {
	return config.cached("all-controls", c => {
		const controlTypes = choose(unique(c.flatMap(c => Object.keys(c.controls))), parseTypeName)
		// console.log("Control types:", controlTypes)
		const markupMapping = c.flatMap(c => c.config.markup.controls)
		const markupControls: ControlListResult[] =
			choose(markupMapping, m => "tagName" in m ? m : null)
			.map(c => ({
				tag: c.tagPrefix + ":" + c.tagName,
				control: {
					kind: "markup",
					description: `Markup control from ${c.src}`,
					type: findControl(config, "DotVVM.Framework.Controls.DotvvmMarkupControl")!,
					...c
				}
			}))

		const byNamespace = _.groupBy(choose(markupMapping, m => "namespace" in m ? m : null), m => m.namespace)

		const mappedControls: ControlListResult[] =
			choose(controlTypes, type => {
				const c =
					byNamespace[type.namespace]?.find(m => m.assembly == type.assembly) ??
					byNamespace[type.namespace]?.[0]
				if (c?.tagPrefix == null)
				{
					// console.log("Control has no registration?", c)
					return null
				}
				return {
					tag: c.tagPrefix + ":" + type.name,
					control: { kind: "code", type: findControl(config, type)!, ...c },
					// description: "Control " + c.namespace + "." + c.name, // TODO: fetch doccomments
				}
			})
		// console.log("Asked for tags, got", markupControls.map(m => m.name), "and ", mappedControls.map(m => m.name))

		return uniqueBy(markupControls.concat(mappedControls), c => c.tag) as any
	})
}

export function listControls(config: SerializedConfigSeeker, baseType: string | nullish): ControlListResult[] {
	baseType = baseType && (parseTypeName(baseType)?.fullName ?? baseType)

	const all = listAllControls(config)
	if (!baseType && baseType == "DotVVM.Framework.Controls.DotvvmBindableObject")
		return all

	return all.filter(c => {
		if (c.control.type == null && baseType == "DotVVM.Framework.Controls.DotvvmControl")
			return true;

		let base = c.control.type
		while (base != null) {
			if (base.fullName == baseType)
				return true
			if (base.interfaces && base.interfaces.some(i => parseTypeName(i)?.fullName == baseType))
				return true
			base = findControl(config, base.baseType) ?? null
		}

		return false
	})
}

export type ResolvedPropertyInfo =
	| { kind: "property", dotvvmProperty: NamedDotvvmPropertyInfo }
	| { kind: "group", propertyGroup: NamedDotvvmPropertyGroupInfo, member: string }
	| { kind: "unknown", name: string }

function getDotvvmProperty(config: SerializedConfigSeeker, control: FullControlInfo, name: string): NamedDotvvmPropertyInfo | undefined {
	if (name.includes('.')) {
		return getDotvvmPropertyByFullName(config, name)
	}
	const baseControl = control.baseType && findControl(config, control.baseType)
	if (name in control.properties)
		return { name, declaringType: control.fullName, ...control.properties[name] }
	return baseControl ? getDotvvmProperty(config, baseControl, name) : undefined
}

function getDotvvmPropertyByFullName(config: SerializedConfigSeeker, name: string): NamedDotvvmPropertyInfo | undefined {
	const [controlName, propertyName] = name.split(".")
	
	for (const c of Object.values(config.configs)) {
		const fullControlName =
			Object.keys(c.properties)
				.find(cName => cName.endsWith("." + controlName) && propertyName in c.properties[cName])
		if (fullControlName) {
			return {
				name: propertyName,
				declaringType: fullControlName,
				...c.properties[fullControlName][propertyName]
			}
		}
	}
}

export function findProperty(config: SerializedConfigSeeker, control: FullControlInfo, propertyName: string): NamedDotvvmPropertyInfo | undefined {
	for (const [name, p] of Object.entries(control.properties)) {
		if (name == propertyName)
			return { ...p, name, declaringType: control.fullName }
	}
	const baseControl = control.baseType && findControl(config, control.baseType)
	if (baseControl)
		return findProperty(config, baseControl, propertyName)
	
}

export function* listProperties(config: SerializedConfigSeeker, control: FullControlInfo, context: PropertyMappingMode | null = null): Iterable<NamedDotvvmPropertyInfo> {
	for (const [name, p] of Object.entries(control.properties)) {
		if (isCompatibleMappingMode(p.mappingMode, context))
		yield { ...p, name, declaringType: control.fullName }
	}
	const baseControl = control.baseType && findControl(config, control.baseType)
	if (baseControl)
		yield* listProperties(config, baseControl, context)
}

export function listAttachedProperties(config: SerializedConfigSeeker, context: PropertyMappingMode | null = null): Map<string, NamedDotvvmPropertyInfo[]> {
	const p = Object.values(config.configs).flatMap(function (c) {
		let typeList: [string, NamedDotvvmPropertyInfo[]][] =[]
		for (const [typeName, props] of Object.entries(c.properties)) {
			let list: NamedDotvvmPropertyInfo[] = []
			for (const [name, prop] of Object.entries(props)) {
				if (prop.isAttached && isCompatibleMappingMode(prop.mappingMode, context))
					list.push({ ...prop, name, declaringType: typeName })
			}
			if (list.length > 0)
				typeList.push([typeName, list])
		}
		return typeList
	})

	return new Map(Array.from(p))
}

export function* listPropertyGroups(config: SerializedConfigSeeker, control: FullControlInfo, context: PropertyMappingMode | null = null): Iterable<NamedDotvvmPropertyGroupInfo> {
	const baseControl = control.baseType && findControl(config, control.baseType)
	for (const [n, pg] of Object.entries(control.propGroups))
	{
		if (isCompatibleMappingMode(pg.mappingMode, context))
			yield { ...pg, name: n, declaringType: control.fullName }
	}
	if (baseControl)
		yield* listPropertyGroups(config, baseControl, context)
}

function isCompatibleMappingMode(propMode: PropertyMappingMode | null | undefined, context: PropertyMappingMode | null): boolean {
	if (context == null || context == "Exclude")
		return true
	propMode ??= "Attribute"
	if (context == "Attribute")
		return propMode == "Attribute" || propMode == "Both"
	if (context == "InnerElement")
		return propMode == "InnerElement" || propMode == "Both"
	if (context == "Both")
		return propMode == "Both"

	throw Error("Unknown context: " + context)
}

export function resolveControlProperty(config: SerializedConfigSeeker, control: FullControlInfo | string | null | undefined, name: string, context: PropertyMappingMode | null = null): ResolvedPropertyInfo {
	if (name.includes('.')) {
		const p = getDotvvmPropertyByFullName(config, name)
		if (p)
			return { kind: "property", dotvvmProperty: p }
		return { kind: "unknown", name }
	}

	if (typeof control == "string")
		control = resolveControl(config, control)?.type
	
	if (control == null)
		return { kind: "unknown", name }
	
	const p = getDotvvmProperty(config, control, name)
	if (p && isCompatibleMappingMode(p.mappingMode, context)) {
		return { kind: "property", dotvvmProperty: p }
	}

	const pgs = [...listPropertyGroups(config, control, context)]
	const prefixes = _.sortBy(unique(pgs.flatMap(pg => pg.prefixes ?? pg.prefix ?? [])), p => p.length)

	const matchingPrefix = prefixes.find(p => name.startsWith(p))
	if (matchingPrefix != null) {
		const propertyGroup = pgs.find(pg => pg.prefix == matchingPrefix || pg.prefixes?.includes(matchingPrefix))!
		const member = name.substring(matchingPrefix.length)
		return { kind: "group", propertyGroup, member }
	}

	return { kind: "unknown", name }
}


export function resolveControlOrProperty(
	config: SerializedConfigSeeker,
	node: SyntaxNode | nullish,
): {
	control: ResolveControlResult
	property?: ResolvedPropertyInfo
	propertyValueRange?: OffsetRange
	controlContentRange?: OffsetRange
	controlAttributesRange?: OffsetRange
	isElementProperty?: boolean
} | null {
	if (node == null) return null

	let attribute: AttributeNode | undefined
	let element: HtmlElementNode | ScriptElementNode | StyleElementNode | undefined

	let p: SyntaxNode | null = node
	while (p) {
		const type = p.type
		if (type == "attribute") {
			attribute ??= p as AttributeNode
		} else if (type == "html_element" || type == "script_element" || type == "style_element") {
			element ??= p
			break
		} else if ((type == "start_tag" || type == "self_closing_tag") && p.hasError()) {
			// often we are after an attribute, but still want to complete values for that specific attribute

			attribute ??= p.attributeNodes.filter(a => a.startIndex < node.startIndex).at(-1)
		}
		p = p.parent
	}

	if (element == null)
		return null

	const controlContentRange: OffsetRange | undefined =
		element.startNode && element.endNode && { start: element.startNode.endIndex, end: element.endNode.startIndex }

	const controlAttributesRange: OffsetRange | undefined =
		element.startNode && { start: element.startNode.nameNode.endIndex, end: element.startNode.endIndex - 1 }

	const elName = elementName(element)
	let control: ResolveControlResult | undefined
	if (element.type != "html_element") // script or style
		control = resolveControl(config, elName)
	else if (elName?.includes(":")) {
		control = resolveControl(config, elName)
	} else {
		// probably html element, unless there it's InnerElement property of the parent control

		property: do {// break target
			const parentElement = typeAncestor("html_element", element.parent)
			Logger.log("considering html_element ", node.text, "to be a inner element property")
			if (parentElement == null) break property
			
			const parentName = elementName(parentElement)
			Logger.log(`parentName=${parentName}, elName=${elName}`)
			if (!parentName.includes(':') && !elName.includes('.')) break property

			const parentControl = resolveControl(config, parentName)
			Logger.log(`parentControl=${parentControl?.type?.fullName}`)
			if (parentControl?.type == null) break property

			const elementProperty = resolveControlProperty(config, parentControl.type, elName, "InnerElement")
			if (elementProperty.kind == "unknown") {
				Logger.log("unknown property ", elName, " of control ", parentName)
				break property
			}

			// to be a valid property, all element before it must also be properties

			// TODO: move this check into a validation phase, this is just annoying
			// if (!parentControl.type.withoutContent || parentControl.type.defaultContentProperty != null)
			// {
			// 	let sibling: SyntaxNode | null = element
			// 	while (sibling = sibling.previousNamedSibling) {
			// 		if (sibling.type == "html_comment" || sibling.type == "dotvvm_comment")
			// 			continue

			// 		if (sibling.type != "html_element")
			// 			break property

			// 		const siblingName = elementName(sibling)
			// 		if (siblingName.includes(':'))
			// 			break property
			// 		if (siblingName.includes('.'))
			// 			continue // skip the resolve, this has to be a property anyway
			// 		if (!resolveControlProperty(config, parentControl.type, siblingName, "InnerElement"))
			// 			break property
			// 	}
			// }

			return {
				control: parentControl,
				property: elementProperty,
				controlContentRange: { start: parentElement.startNode!.endIndex, end: parentElement.endNode!.startIndex },
				propertyValueRange: controlContentRange,
				isElementProperty: true
			}
		} while (false)

		control = resolveControl(config, elName)
	}

	if (control == null)
		return null


	if (attribute == null) {
		return {
			control, controlContentRange, controlAttributesRange
		}
	}
	
	const property = resolveControlProperty(config, control.type, attribute.nameNode.text, "Attribute")
	
	return {
		control,
		property,
		propertyValueRange: nodeToORange(attribute?.valueNode) ?? undefined,
		controlContentRange,
		controlAttributesRange,
	}
}
