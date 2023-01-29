import { SelfClosingTagNode, StartTagNode } from "tree-sitter-dotvvm"
import { CompletionItemKind, IAttributeData, ITagData, IValueData } from "vscode-html-languageservice"
import { MarkupContent } from "vscode-languageserver-protocol"
import { PropertyCompletionInfo } from "../../../lib/dotvvmControlInformation"
import { FullControlInfo, ResolvedControlInfo } from "../../../lib/dotvvmControlResolver"
import { nullish } from "../../../utils"

export function getBaseHtmlElement(
	control: FullControlInfo | nullish,
	element: StartTagNode | SelfClosingTagNode,
	prefix: string = ""): string | null {
	let renderWrapperTag: boolean | null = null
	for (const attr of element.attributeNodes) {
		const name = attr.nameNode.text.toLowerCase()
		if (name == prefix + "wrappertag" || name == prefix + "wrappertagname" || name == prefix + "tagname") {
			return attr.valueNode?.text ?? "div"
		}

		if (name == prefix + "renderwrappertag") {
			if (attr.valueNode?.text.toLowerCase() == "false") {
				return null
			} else {
				renderWrapperTag = true
			}
		}
	}
	const fullName = control?.fullName
	const basicName = element.nameNode.text?.split(":", 2)[1]?.toLowerCase()
	if (basicName == "textbox" || fullName == "DotVVM.Framework.Controls.TextBox") {
		return "input"
	}
	if (basicName == "literal" || fullName == "DotVVM.Framework.Controls.Literal") {
		return "span"
	}
	if (basicName == "button" || fullName == "DotVVM.Framework.Controls.Button") {
		return "button"
	}
	if (basicName == "routelink" || fullName == "DotVVM.Framework.Controls.RouteLink") {
		return "a"
	}
	if (basicName == "linkbutton" || fullName == "DotVVM.Framework.Controls.LinkButton") {
		return "button"
	}
	if (fullName == "DotVVM.Framework.Controls.GridView") {
		return "table"
	}

	if (fullName == "DotVVM.Framework.Controls.RoleView" || fullName == "DotVVM.Framework.Controls.EnvironmentView" || fullName == "DotVVM.Framework.Controls.AuthenticatedView") {
		// by default no wrapper tag is rendered
		if (renderWrapperTag !== true) {
			return null
		}
		return "div"
	}

	return "div"
}

// From vscode-html-languageservice/src/languageFacts/dataProvider.ts
export function htmlGenerateDocumentation(item: ITagData | IAttributeData | IValueData, settings: { documentation?: boolean; references?: boolean; } = {}, doesSupportMarkdown: boolean): MarkupContent | undefined {
	const result: MarkupContent = {
		kind: doesSupportMarkdown ? 'markdown' : 'plaintext',
		value: ''
	};

	if (item.description && settings.documentation !== false) {
		if (typeof item.description == "string") {
			result.value += item.description;
		} else if (typeof item.description?.value == "string") {
			result.value += item.description.value;
		}
	}

	if (item.references && item.references.length > 0 && settings.references !== false) {
		if (result.value.length) {
			result.value += `\n\n`;
		}
		if (doesSupportMarkdown) {
			result.value += item.references.map(r => {
				return `[${r.name}](${r.url})`;
			}).join(' | ');
		} else {
			result.value += item.references.map(r => {
				return `${r.name}: ${r.url}`;
			}).join('\n');
		}
	}

	if (result.value == '') {
		return undefined;
	}

	return result;
}

export function propertyCompletionKind(prop: PropertyCompletionInfo): CompletionItemKind {
	if (prop.bindingTypes?.includes("value")) {
		return CompletionItemKind.Property
	}
	if (prop.bindingTypes?.includes("command") || prop.bindingTypes?.includes("staticCommand")) {
		return CompletionItemKind.Event
	}
	return CompletionItemKind.Field
}

export function createPropertySnippet(name: string, prop: PropertyCompletionInfo, counter: { i: number, allowFinal?: boolean }): string {
	let result = name
	if (prop.noValue) {
		return result + " "
	}

	function valueIndex() {
		if (counter.allowFinal) {
			counter.allowFinal = false
			return 0
		} else {
			return counter.i++
		}
	}

	result += "="
	if (prop.onlyBindings === true || prop.autocompleteBinding) {
		if (prop.autocompleteBinding && prop.bindingTypes?.length == 1)
			result += ("{" + prop.autocompleteBinding + ": ${" + valueIndex() + "}}")

		else if (prop.autocompleteBinding)
			result += ("{${" + counter.i++ + ":" + prop.autocompleteBinding + "}: ${" + valueIndex() + "}}")

		else 
			result += "{$" + valueIndex() + "}"

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
		return result + '"' + "$" + valueIndex() + '" '

	return result + "$" + valueIndex() + " "
}
