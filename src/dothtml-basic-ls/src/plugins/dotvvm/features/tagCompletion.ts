import type { EndTagNode, ErroneousEndTagNode, HtmlElementNode, SelfClosingTagNode, StartTagNode } from 'tree-sitter-dotvvm';
import * as res from '../../../lib/dotvvmControlResolver';
import type { ResolveControlResult, ResolvedPropertyInfo } from '../../../lib/dotvvmControlResolver';
import { PropertyMappingMode, SerializedConfigSeeker } from '../../../lib/serializedConfigSeeker';
import { CompletionItem, CompletionItemKind, CompletionList, InsertTextFormat, LRUCache, Range, TextEdit } from 'vscode-languageserver';
import { nodeToVsRange } from '../../../lib/parserutils';
import { getCollectionElementType, parseTypeName } from '../../../lib/dotnetUtils';
import type { nullish } from '../../../utils';
import { DotvvmControlInfoProvider, PropertyCompletionInfo } from '../../../lib/dotvvmControlInformation';
import { createPropertySnippet } from './completionHelpers';

export class DotvvmTagCompletion
{
	constructor(
		public config: SerializedConfigSeeker,
		private controlInformation: DotvvmControlInfoProvider)
	{
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

	private createControlCompletion(
		currentElementNode: StartTagNode | SelfClosingTagNode | undefined,
		tag: string,
		description: string | undefined,
		control: ResolveControlResult,
		endStartingTag: boolean,
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
					return createPropertySnippet(pName, property, counter)
				}).join("")

		const ending =
			endStartingTag && info.selfClosing ? `$0 />` :
			completeEndTag ? `>$0</${tag}>` :
			endStartingTag ? `>$0` : '$0'
		
		return {
			label: tag,
			documentation: description,
			insertTextFormat: InsertTextFormat.Snippet,
			insertText: tag + (requiredPropertiesSnippet ? " " + requiredPropertiesSnippet : "") + ending,
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
	): res.NamedDotvvmPropertyInfo[] {
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
		const potentialEndTags = new Set<string>(
			elementNode?.parent?.namedChildren
				.filter(c => c.type == "erroneous_end_tag" || c.type == "end_tag")
				.map(c => (c as EndTagNode).nameNode.text.toLowerCase()) ?? []
		)
		const isEndMissing = !isSelfClosing && !elementNode?.text.endsWith('>') && (elementNode?.parent as HtmlElementNode).endNode == null
	
		const baseType = this.getExpectedBaseType(containingProperty)
		const noContent = containingProperty == null && parentControl?.type?.withoutContent && containingProperty != null
		const controls = noContent ? [] : res.listControls(this.config, baseType)
		const controlCompletions =
			controls
				.filter(c => c.control.type?.isAbstract !== true)
				.map(c => this.createControlCompletion(elementNode, c.tag, c.description, c.control, isEndMissing, isEndMissing && !potentialEndTags.has(c.tag.toLowerCase())))

		const properties = containingProperty != null ? [] : this.listControlProperties(parentControl, "InnerElement")
		
		const propertyCompletions = properties.map(p => {
			// re-close self closing tags, it doesn't make sense for properties
			const addEndTag = isSelfClosing || isEndMissing && !potentialEndTags.has(p.name.toLowerCase())
			return <CompletionItem>{
				label: p.name,
				// documentation: p.description,
				insertTextFormat: InsertTextFormat.Snippet,
				insertText: p.name + (
					addEndTag ? `>$0</${p.name}>` :
					isEndMissing ? `>$0` :
					'$0'),
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
			// it's necessary in order to make the endEdit work, otherwise the edit range gets outdated
			true
		)
	}
}
