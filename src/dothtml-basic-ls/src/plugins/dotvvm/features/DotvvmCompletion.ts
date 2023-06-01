import { bind } from 'lodash';
import { EOL } from 'os';
import { ErroneousEndTagNode, HtmlElementNode, SelfClosingTagNode, StartTagNode, SyntaxNode } from 'tree-sitter-dotvvm';
import { getDefaultHTMLDataProvider, Range } from 'vscode-html-languageservice';
import {
    Position,
    CompletionList,
    CompletionItemKind,
    CompletionItem,
    InsertTextFormat,
    MarkupKind,
    CompletionItemTag,
    TextEdit
} from 'vscode-languageserver';
import { isInTag, DotvvmDocument } from '../../../lib/documents';
import { AttributeContext, getAttributeContextAtPosition } from '../../../lib/documents/parseHtml';
import { getCollectionElementType, parseTypeName } from '../../../lib/dotnetUtils';
import { createDotvvmControlInfoProvider } from '../../../lib/dotvvmControlInformation';
import type { ResolveControlResult, ResolvedPropertyInfo } from '../../../lib/dotvvmControlResolver';
import * as res from '../../../lib/dotvvmControlResolver';
import { containsPosition, nodeAncestors, nodeToORange, nodeToVsRange, OffsetRange, typeAncestor } from '../../../lib/parserutils';
import { SerializedConfigSeeker } from '../../../lib/serializedConfigSeeker';
import { Logger } from '../../../logger';
import { concatCompletionLists, emptyArray, falsy, nullish } from '../../../utils';
import { DotvvmAttributeCompletion } from './attributeCompletion';
import { DotvvmTagCompletion } from './tagCompletion';

const bindingTypes: CompletionItem[] = [
    [ "value", "Bind a value from a viewmodel. Translated to Javascript, so the value will update immediately when viewmodel changes" ],
    [ "command", "" ],
    [ "resource", "Binds any value accessible server-side. You can bind a resource, viewmodel value. Won't update the binding client-side" ],
    [ "staticCommand", "" ],
].map(([name, description]) => ({
    label: name,
    documentation: description,
    insertText: name + ': ',
}))

export function decideCompletionContext(
    config: SerializedConfigSeeker,
    doc: DotvvmDocument,
    offset: number
) {
    const node = doc.tree?.nodeAt(offset - 1)
    Logger.log("Node stack:", [...nodeAncestors(node)].map(n => n.type).reverse().join(" > "), "at", JSON.stringify(`${doc.content.substring(offset - 5, offset)}[${doc.content[offset]}]${doc.content.substring(offset + 1, offset + 5)}`))
    if (node == null) {
        return null
    }
    let resolvedCx = res.resolveControlOrProperty(config, node)
    const errorNode = typeAncestor('ERROR', node)
    const hasError = errorNode || node?.hasError()
    const binding = typeAncestor(['literal_binding', 'attribute_binding'], node)
    const tag = typeAncestor(["start_tag", "self_closing_tag"], node)
    const attribute = typeAncestor("attribute", node)

    let context = "unknown"
    let completionTarget: null | undefined | OffsetRange = null
    let appendText = ""

    // binding name
    if (containsPosition(offset, binding?.nameNode) ||
        node.type == "binding_name" ||
        (hasError && (['{', '{{'].includes(node.type) || ['{', '{{'].includes(doc.tree!.nodeAt(offset - 1).type)))) {
        context = "binding_start"
        const closingBrace = binding?.lastChild?.type.includes('}') ? binding.lastChild : null
        if (binding?.nameNode) {
            completionTarget = nodeToORange(binding.nameNode)
            completionTarget.end =
                binding.exprNode?.startIndex ?? binding.endIndex - (closingBrace?.text.length ?? 0)
        }
        if (!doc.content.substr(offset-1, 6).includes('}') && (closingBrace == null || closingBrace.isMissing() || closingBrace.text == "")) {
            console.log("Adding missing brace")
            appendText = (binding?.firstChild ?? doc.tree!.nodeAt(offset - 1)).type == "{{" ? "}}" : "}"
        }
    }

    // binding body (currently just sentinel, to not activate other completion types)
    else if (binding) {
        context = "binding_body"
    }

    else if (containsPosition(offset, tag?.nameNode) ||
        doc.tree!.nodeAt(offset - 1).type == "tag_name" ||
        node.type == "html_text" && doc.content[offset - 1] == "<" ||
        (hasError && node.type == "<")) {
        
        context = "tag_start"
        completionTarget =
            containsPosition(offset, tag?.nameNode) ? nodeToORange(tag?.nameNode) :
            doc.tree!.nodeAt(offset - 1).type == "tag_name" ? nodeToORange(doc.tree!.nodeAt(offset - 1)) :
            null

        // rewrite resolved context to the parent element, so that we can get specific allowed node types

        resolvedCx = res.resolveControlOrProperty(config, typeAncestor("html_element", node, e => e.startNode != null && e.startNode.endIndex < offset))
    }
    // attribute/property name
    else if (containsPosition(offset, tag) && !containsPosition(offset, attribute?.valueNode)) {
        context = "attribute_name"
        if (attribute) {
            completionTarget = nodeToORange(attribute.nameNode)
        } else {
            completionTarget = null
        }
    }

    return {
        node, binding, tag, attribute,

        control: resolvedCx?.control,
        property: resolvedCx?.property,

        context,
        completionTarget,
        appendText
    }
}

function getBindingTypes(property: ResolvedPropertyInfo | falsy): CompletionItem[] {
    if (!property || property.kind == "unknown") return bindingTypes

    const descriptor = property.kind == "group" ? property.propertyGroup : property.dotvvmProperty

    if (descriptor.isCommand) {

        let commands = bindingTypes.filter(c => c.label == "command" || c.label == "staticCommand")

        if (descriptor.commandArguments) {
            commands = commands.map(c => ({
                ...c,
                insertText: c.label + ": (" + descriptor.commandArguments!.map(a => a.name).join(", ") + ") => ",
            }))
        }
        return commands
    }

    if (descriptor.onlyHardcoded) {
        return bindingTypes.filter(c => c.label == "resource")
    }

    if (descriptor.onlyBindings) {
        return bindingTypes.filter(c => c.label == "value")
    }

    var allowsAllBindings =
        property.kind == "group" && property.propertyGroup.declaringType == "DotVVM.Framework.Controls.JsComponent" && property.propertyGroup.name == "Props"

    if (allowsAllBindings)
        return bindingTypes

    return bindingTypes.filter(c => c.label == "value" || c.label == "resource")
}


/** Finds the currently open tag, and suggest an end tag for it */
function getCloseTagCompletion(
    node: SyntaxNode,
    offset: number
): CompletionItem[] {

    let openElement = typeAncestor("html_element", node, e => e.startNode != null && e.startNode.endIndex < offset) as HtmlElementNode

    let possibleClosingTag = openElement?.startNode?.nameNode.text

    return possibleClosingTag == null ? [] : [{
        label: '/' + possibleClosingTag,
        insertText: '/' + possibleClosingTag + '>',
        commitCharacters: [ '>' ],
    }]
}

export class DotvvmCompletion {
    tagCompletion: DotvvmTagCompletion;
    attributeCompletion: DotvvmAttributeCompletion;
    constructor(public config: SerializedConfigSeeker) {
        const controlInformation = createDotvvmControlInfoProvider(config)
        this.tagCompletion = new DotvvmTagCompletion(config, controlInformation)
        this.attributeCompletion = new DotvvmAttributeCompletion(config, controlInformation, getDefaultHTMLDataProvider())
    }

    
    getCompletions(
        doc: DotvvmDocument,
        position: Position
    ): CompletionList | null {
        const offset = doc.offsetAt(position);
        
        const cx = decideCompletionContext(this.config, doc, offset)
        if (!cx) {
            Logger.log("No node found")
            return null;
        }

        function list(list:CompletionItem[] | CompletionList) {
            let l = "items" in list ? list.items : list
            if (!cx) throw "??"
            if (cx!.appendText) {
                l = l.map(i => i.textEdit != null ? i : { ...i, insertTextFormat: InsertTextFormat.Snippet, insertText: (i.insertText ?? i.label) + "$1" + cx!.appendText })
            }

            if (cx.completionTarget) {
                const range = Range.create(doc.positionAt(cx.completionTarget.start), doc.positionAt(cx.completionTarget.end))
                l = l.map(i => i.textEdit != null ? i : { ...i, textEdit: { range, newText: i.insertText ?? i.label } })
            }

            return CompletionList.create(l, "isIncomplete" in list ? list.isIncomplete : false)
        }

        Logger.log("Context is ", cx.context,
            (cx.binding && `In binding ${cx.binding.text}`) || '',
            (cx.control && `In control ${cx.control.kind == "html" ? "html " + cx.control.name : cx.control.type?.fullName ?? cx.control.kind}`) || '',
            (cx.property && `In property ${cx.property.kind == 'property' ? cx.property.dotvvmProperty.name :
                                        cx.property.kind == 'group' ? cx.property.propertyGroup.name + ':' + cx.property.member :
                                        '<unknown>'}`) || '',
            (cx.completionTarget && `Completing range ${cx.completionTarget.start}-${cx.completionTarget.end}`) || ''
        )

        if (cx.context == "binding_start") {
            return list(getBindingTypes(cx.property))
        }

        if (cx.context == "binding_body") {
            return null // Sorry, not supported atm
        }

        if (cx.context == "tag_start") {
            return concatCompletionLists(
                list(this.tagCompletion.getTagCompletions(cx.tag, cx.control, cx.property)),
                getCloseTagCompletion(cx.node, offset)
            )
        }

        if (cx.context == "attribute_name") {
            return list(this.attributeCompletion.getAttributeCompletions(cx.attribute, cx.control, cx.tag))
        }

        return null
    }
}
