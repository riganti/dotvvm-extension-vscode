import { ErroneousEndTagNode, HtmlElementNode, SelfClosingTagNode, StartTagNode } from 'tree-sitter-dotvvm';
import * as res from '../../../lib/dotvvmControlResolver';
import type { ResolveControlResult, ResolvedPropertyInfo } from '../../../lib/dotvvmControlResolver';
import { PropertyMappingMode, SerializedConfigSeeker } from '../../../lib/serializedConfigSeeker';
import { CompletionItem, CompletionItemKind, CompletionList, InsertTextFormat, LRUCache, Range, TextEdit } from 'vscode-languageserver';
import { nodeToVsRange } from '../../../lib/parserutils';
import { getCollectionElementType, parseTypeName } from '../../../lib/dotnetUtils';
import type { nullish } from '../../../utils';
import { createDotvvmControlInfoProvider, DotvvmControlInfoProvider, PropertyCompletionInfo } from '../../../lib/dotvvmControlInformation';
import { count } from 'console';


export class DotvvmTagCompletion
{
	private controlInformation: DotvvmControlInfoProvider
	constructor(public config: SerializedConfigSeeker)
	{
		this.controlInformation = createDotvvmControlInfoProvider(this.config)
	}

	private getExpectedBaseType(
		containingProperty: ResolvedPropertyInfo | undefined): string {
		let baseType: string | undefined = "DotVVM.Framework.Controls.DotvvmControl"
		
		if (containingProperty) {
			const pType =
				containingProperty.kind == "group" ? containingProperty.propertyGroup.type :
				containingProperty.kind == "property" ? containingProperty.dotvvmProperty.type : null
			if (pType) {
				const t = parseTypeName(pType)

				baseType = (getCollectionElementType(t) ?? t)?.fullName
			}
			baseType ??= "DotVVM.Framework.Controls.DotvvmBindableObject"
		}

		return baseType
	
	}

	private static createPropertySnippet(name: string, prop: PropertyCompletionInfo, counter: { i: number }): string {
		let result = name
		if (prop.noValue) {
			return result + " "
		}

		result += "="
		if (prop.onlyBindings === true || prop.autocompleteBinding) {
			if (prop.autocompleteBinding && prop.bindingTypes?.length == 1)
				result += ("{" + prop.autocompleteBinding + ": ${" + counter.i++ + "}}")

			else if (prop.autocompleteBinding)
				result += ("{${" + counter.i++ + ":" + prop.autocompleteBinding + "}: ${" + counter.i++ + "}}")

			else 
				result += "{$" + counter.i++ + "}"

			return result + " "
		}

		if (prop.autocompleteValue != null) {
			const addQuotes = prop.hasQuotes ?? /\W/.test(prop.autocompleteValue)
			if (addQuotes) result += '"'

			result += "${" + counter.i++ + ":" + prop.autocompleteValue + "}"

			if (addQuotes) result += '"'
			return result + " "
		}

		if (prop.hasQuotes)
			return result + '"' + "$" + counter.i++ + '" '

		return result + "$" + counter.i++ + " "
	}

	private createControlCompletion(
		currentElementNode: StartTagNode | SelfClosingTagNode | undefined,
		tag: string,
		description: string | undefined,
		control: ResolveControlResult,
		completeEndTag: boolean
	): CompletionItem {
		const info = this.controlInformation.getControlCompletionInfo(control)

		// autocomplete all required properties which are not present on the tag
		let counter = {i: 1}
		const requiredPropertiesSnippet =
			info.autoProperties == null || info.autoProperties.length == 0 ? "" :
			info.autoProperties
				.filter(p => currentElementNode?.attributeNodes.find(a => a.nameNode.text.toLowerCase() == p.toLowerCase()) == null)
				.map(pName => {
					const p = res.findProperty(this.config, control.type!, pName)
					if (p == null) return pName + "=$" + counter.i++ + " "
					if (p.mappingMode == "InnerElement") return "" // TODO: auto-add inner elements

					const property = this.controlInformation.getPropertyCompletionInfo(p)
					return DotvvmTagCompletion.createPropertySnippet(pName, property, counter)
				}).join("")

		const ending =
			completeEndTag && info.selfClosing ? `$0 />` :
			completeEndTag ? `>$0</${tag}>` : '$0'
		
		return {
			label: tag,
			documentation: description,
			insertTextFormat: InsertTextFormat.Snippet,
			insertText: tag + " " + requiredPropertiesSnippet + ending,
			kind: control.kind == "code" ? CompletionItemKind.Class : CompletionItemKind.Module
		}
	}

	/** Adds additionalEdits to all completions which changes the current end tag to the new completed one */
	private addEndEdits(
		completions: CompletionItem[],
		elementNode: StartTagNode | SelfClosingTagNode | undefined
		): CompletionItem[] {

		const endTagRange =
			nodeToVsRange((elementNode?.parent as HtmlElementNode).endNode?.nameNode) ??
			nodeToVsRange(((elementNode?.parent as HtmlElementNode)?.children.find(c => c.type == "erroneous_end_tag") as ErroneousEndTagNode)?.nameNode)

		if (!endTagRange) return completions

		const endEdit = (text: string): TextEdit => {
			return { range: endTagRange, newText: text }
		}

		return completions.map(c => ({
			...c,
			additionalTextEdits: [...c.additionalTextEdits ?? [], endEdit(c.label)]
		}))
	
	}

	private listControlProperties(
		parentControl: ResolveControlResult | undefined,
		context: PropertyMappingMode
	) {
		const properties =
			parentControl?.type == null
				? []
				: res.listProperties(this.config, parentControl.type, context)
		const attachedProperties =
			Array.from(res.listAttachedProperties(this.config, context).values())
				.flatMap(a => a)
				.map(p => ({...p, name: parseTypeName(p.declaringType)?.name + '.' + p.name }))

		return Array.from(properties).concat(attachedProperties)
	}


	public getTagCompletions(
		elementNode: StartTagNode | SelfClosingTagNode | undefined,
		parentControl: ResolveControlResult | undefined,
		containingProperty: ResolvedPropertyInfo | undefined
	): CompletionList {

		// when the end tag is missing, we also autocomplete the closing tag
		const isSelfClosing = elementNode?.type == "self_closing_tag" && !elementNode.descendantsOfType("/>")[0].isMissing()
		const isEndMissing = !isSelfClosing && !elementNode?.text.endsWith('>') && (elementNode?.parent as HtmlElementNode).endNode == null
	
		const baseType = this.getExpectedBaseType(containingProperty)
		const noContent = containingProperty == null && parentControl?.type?.withoutContent && containingProperty != null
		const controls = noContent ? [] : res.listControls(this.config, baseType)
		const controlCompletions =
			controls
				.filter(c => c.control.type?.isAbstract !== true)
				.map(c => this.createControlCompletion(elementNode, c.tag, c.description, c.control, isEndMissing))

		const properties = containingProperty != null ? [] : this.listControlProperties(parentControl, "InnerElement")
		

		const propertyCompletions = properties.map(p => {
			return <CompletionItem>{
				label: p.name,
				// documentation: p.description,
				insertTextFormat: InsertTextFormat.Snippet,
				insertText: p.name + (isEndMissing || isSelfClosing ? `>$0</${p.name}>` : '$0'),
				kind: CompletionItemKind.Field
			}
		})

		let completions = [...controlCompletions, ...propertyCompletions]
		if (!isEndMissing) {
			completions = this.addEndEdits(completions, elementNode)
		}
		return CompletionList.create(
			completions,
			// this makes VSCode refresh the tags on every keystroke
			// it's necessary in order to make the endEdit work, otherwise the edit range get's outdated
			true
		)
	}
}
