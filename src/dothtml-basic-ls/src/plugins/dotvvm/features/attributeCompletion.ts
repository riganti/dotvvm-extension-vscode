import { DotvvmDocument } from "../../../lib/documents";
import { DotvvmControlInfoProvider } from "../../../lib/dotvvmControlInformation";
import { SerializedConfigSeeker } from "../../../lib/serializedConfigSeeker";
import { Position,
	CompletionList,
	CompletionItemKind,
	CompletionItem,
	InsertTextFormat,
	MarkupKind,
	CompletionItemTag,
	TextEdit,
	Command
} from 'vscode-languageserver';
import { ResolveControlResult } from "../../../lib/dotvvmControlResolver";
import { AttributeNode, SelfClosingTagNode, StartTagNode, SyntaxNode } from "tree-sitter-dotvvm";
import * as res from '../../../lib/dotvvmControlResolver';
import { IHTMLDataProvider } from 'vscode-html-languageservice'
import { createPropertySnippet, getBaseHtmlElement, htmlGenerateDocumentation, propertyCompletionKind } from "./completionHelpers";
import { parseTypeName } from "../../../lib/dotnetUtils";

function generateDescription(
	p: res.NamedDotvvmPropertyInfo | res.NamedDotvvmPropertyGroupInfo) {
	return [
		p.type != "System.String" ? "Type: " + parseTypeName(p.type)?.name : "",
		p.fromCapability ? "From " + parseTypeName(p.fromCapability)?.name : "",
		p.mappingMode == "Both" ? "Can be used as inner element" : "",
		"required" in p && p.required ? "**Required**" : "",
		"isActive" in p && p.isActive ? "Active" : "",
		"isCompileTimeOnly" in p && p.isCompileTimeOnly ? "Compile-Time" : "",
	].filter(x => x).join(" | ")
}

export class DotvvmAttributeCompletion
{
	constructor(
		public config: SerializedConfigSeeker,
		private controlInformation: DotvvmControlInfoProvider,
		private htmlInfo: IHTMLDataProvider
	)
	{
	}

	/** Places HTML attribute completions into the `results` Map. */
	private getHtmlAttributeCompletions(
		results: Map<string, CompletionItem>,
		control: ResolveControlResult | undefined,
		controlNode: StartTagNode | SelfClosingTagNode | undefined,
		prefixes: string[]
	) {
		let htmlElement: string | null = controlNode?.nameNode?.text.toLowerCase() ?? "div"
		if (htmlElement.includes(":")) {
			htmlElement = getBaseHtmlElement(control?.type, controlNode!, prefixes[0])
		}
		if (htmlElement == null) {
			return
		}

		const editorSupportsMarkdown = true // TODO: get from client, vscode always supports it

		for (const attr of this.htmlInfo.provideAttributes(htmlElement)) {
			// find a free prefix, i.e. prefer to use "class", but suggest "html:class" if Class property exists
			const prefix = prefixes.find(p => !results.has(p + attr.name))
			if (prefix == null) {
				continue // can't use this attribute due to conflicts
			}
			const attrName = prefix + attr.name
			let insertText
			if (attr.valueSet == 'v') {
				insertText = attrName + " " // no value
			} else if (attr.name == "charset") {
				insertText = attrName + '=utf-8 ' // no questions :)
			} else if (
				!["id", "name", "type"].includes(attr.name) &&
				(attr.valueSet == null || ['handler', 'target'].includes(attr.valueSet))) {
				// likely long values, other valueSets are enumerations (such as input types), so quotes are not needed.
				// likewise, id, name and type should not contain spaces or are likely to contain a binding
				insertText = attrName + '="$0"'
			} else {
				insertText = attrName + '=$0'
			}
			results.set(attrName, {
				label: attrName,
				kind: attr.valueSet === 'handler' ? CompletionItemKind.Function : CompletionItemKind.Value,
				documentation: htmlGenerateDocumentation(attr, undefined, editorSupportsMarkdown),
				insertTextFormat: InsertTextFormat.Snippet,
				insertText
			})
		}
	}

	/** Suggests possible attributes on the control
	 * @param attributeNode The syntax node being completed, if the attribute node already exists
	 * @param control The control type (if it was resolved)
	 * @param tagNode The element syntax node being completed
	 */
	public getAttributeCompletions(
		attributeNode: AttributeNode | undefined,
		control: ResolveControlResult | undefined,
		tagNode: StartTagNode | SelfClosingTagNode | undefined,
	): CompletionList {
		const controlType = control?.type ?? res.findControl(this.config, "DotVVM.Framework.Controls.HtmlGenericControl")!
		const existingName = attributeNode?.nameNode.text ?? ""

		const result = new Map<string, CompletionItem>()
		const existingAttributes = new Map<string, AttributeNode>(
			tagNode?.attributeNodes.map(a => [a.nameNode.text.toLowerCase(), a]) ?? []
		)

		const properties = res.listProperties(this.config, controlType, "Attribute")
		const propGroups = res.listPropertyGroups(this.config, controlType, "Attribute")
		const attachedProperties = res.listAttachedProperties(this.config, "Attribute")

		for (const p of properties) {
			if (existingAttributes.has(p.name.toLowerCase())) continue

			const info = this.controlInformation.getPropertyCompletionInfo(p)

			result.set(p.name.toLowerCase(), {
				label: p.name,
				documentation: generateDescription(p), // TODO: xml doc
				insertTextFormat: InsertTextFormat.Snippet,
				insertText: createPropertySnippet(p.name, info, { i: 1, allowFinal: true }),
				kind: propertyCompletionKind(info)
			})
		}

		for (const [control, props] of attachedProperties) {
			const controlName = control.split(".").pop()!
			// filter out types with many attached properties
			// suggest only `TypeName.`, unless the user has written already the type name
			if (props.length >= 4 && !existingName.toLowerCase().startsWith(controlName.toLowerCase())) {
				result.set(controlName.toLowerCase() + ".", {
					label: controlName,
					labelDetails: { detail: `... ${props.length} properties: ${props.slice(0, 20).map(p => p.name).join(", ")}` },
					kind: CompletionItemKind.Class,
					insertText: controlName + ".",
					insertTextFormat: InsertTextFormat.Snippet,
					command: Command.create("Trigger Suggest", "editor.action.triggerSuggest")
				})

				continue
			}

			for (const p of props) {
				const name = controlName + "." + p.name
				if (result.has(name.toLowerCase()) || existingAttributes.has(name.toLowerCase())) continue

				const info = this.controlInformation.getPropertyCompletionInfo(p)
				result.set(name.toLowerCase(), {
					label: name,
					documentation: generateDescription(p), // TODO: xml doc
					insertTextFormat: InsertTextFormat.Snippet,
					insertText: createPropertySnippet(name, info, { i: 1, allowFinal: true }),
					kind: propertyCompletionKind(info)
				})
			}
		}

		// Property groups go last, because in case of name conflict, DotVVM prefers the normal properties
		for (const pGroup of propGroups) {
			const info = this.controlInformation.getPropertyGroupCompletionInfo(pGroup)
			const primaryPrefix = pGroup.prefix ?? pGroup.prefixes?.[0]
			if (pGroup.name.endsWith("Attributes")) {
				this.getHtmlAttributeCompletions(result, control, tagNode, pGroup.prefixes ?? [ pGroup.prefix ?? "" ])
			} else {
				const label = `${primaryPrefix}...`
				result.set(label.toLowerCase(), {
					label,
					labelDetails: { detail: `(${pGroup.name})` },
					documentation: generateDescription(pGroup), // TODO: xml doc
					kind: propertyCompletionKind(info),
					// Generate a snippet like `Param-$1="$2"` for property groups where we don't know the possible values
					insertText: createPropertySnippet(primaryPrefix + "$1", info, { i: 2, allowFinal: true }),
					insertTextFormat: InsertTextFormat.Snippet,
				})
			}
		}

		return CompletionList.create(
			[...result.values()],
			// // this makes VSCode refresh the tags on every keystroke
			// // it's necessary in order to make the endEdit work, otherwise the edit range get's outdated
			// true
		)
	}}
