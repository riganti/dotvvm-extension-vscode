import { bind } from 'lodash';
import { EOL } from 'os';
import { SyntaxNode } from 'tree-sitter-dotvvm';
import { Range } from 'vscode-html-languageservice';
import {
    Position,
    CompletionList,
    CompletionItemKind,
    CompletionItem,
    InsertTextFormat,
    MarkupKind,
    CompletionItemTag
} from 'vscode-languageserver';
import { isInTag, DotvvmDocument } from '../../../lib/documents';
import { AttributeContext, getAttributeContextAtPosition } from '../../../lib/documents/parseHtml';
import { parseTypeName } from '../../../lib/dotnetUtils';
import type { ResolveControlResult, ResolvedPropertyInfo } from '../../../lib/dotvvmControlResolver';
import * as res from '../../../lib/dotvvmControlResolver';
import { containsPosition, nodeAncestors, nodeToORange, OffsetRange, typeAncestor } from '../../../lib/parserutils';
import { DotvvmSerializedConfig, SerializedConfigSeeker } from '../../../lib/serializedConfigSeeker';
import { Logger } from '../../../logger';
import { falsy, nullish } from '../../../utils';
import { CSSDocument } from '../../css/CSSDocument';
import { getModifierData } from './getModifierData';
import { attributeCanHaveEventModifier } from './utils';

const HTML_COMMENT_START = '<!--';

const componentDocumentationCompletion: CompletionItem = {
    label: '@component',
    insertText: `component${EOL}$1${EOL}`,
    documentation:
        'Documentation for this component. ' +
        'It will show up on hover. You can use markdown and code blocks here',
    insertTextFormat: InsertTextFormat.Snippet,
    kind: CompletionItemKind.Snippet,
    sortText: '-1',
    filterText: 'component',
    preselect: true
};

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

    if (containsPosition(offset, tag?.nameNode) ||
        doc.tree!.nodeAt(offset - 1).type == "tag_name" ||
        node.type == "html_text" && doc.content[offset - 1] == "<") {
        
        context = "tag_start"
        completionTarget =
            containsPosition(offset, tag?.nameNode) ? nodeToORange(tag?.nameNode) :
            doc.tree!.nodeAt(offset - 1).type == "tag_name" ? nodeToORange(doc.tree!.nodeAt(offset - 1)) :
            null

        // rewrite resolved context to the parent element, so that we can get specific allowed node types

        resolvedCx = res.resolveControlOrProperty(config, typeAncestor("html_element", node, e => e.startNode != null && e.startNode.endIndex < offset))
    }

    return {
        node, binding, tag,

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

function getTagCompletions(
    config: SerializedConfigSeeker,
    parentControl: ResolveControlResult | undefined,
    containingProperty: ResolvedPropertyInfo | undefined
): CompletionItem[] {
    let baseType = "DotVVM.Framework.Controls.DotvvmControl"
    if (containingProperty) {
        const pType = containingProperty.kind == "group" ? containingProperty.propertyGroup.type :
                      containingProperty.kind == "property" ? containingProperty.dotvvmProperty.type : null
        if (pType) {
            console.log("Element property type: ", parseTypeName(pType))
        }
        baseType = "DotVVM.Framework.Controls.DotvvmBindableObject"
    }
    const controls = res.listControls(config, baseType)

    console.log("Controls:", controls.map(t => t.tag))
    return controls.map(c => {
        const requiredProperties =
            !c.control.type ? [] :
            Array.from(res.listProperties(config, c.control.type, "Attribute")).filter(p => p.required)

        let i = 1
        const requiredPropertiesSnippet =
            requiredProperties.length == 0 ? "" :
            requiredProperties.map(p => `${p.name}=${p.isCommand ?     '{${' + i++ + ':staticCommand}: $' + i++ + '}' :
                                                     p.onlyBindings ?  '{value: $' + i++ + '}' :
                                                     p.onlyHardcoded ? '"$' + i++ + '"' :
                                                                       '$' + i++}`).join(" ") + " $0"
        
        return <CompletionItem>{
            label: c.tag,
            documentation: c.description,
            insertTextFormat: requiredProperties.length > 0 ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
            insertText: c.tag + " " + requiredPropertiesSnippet,
            kind: c.control.kind == "code" ? CompletionItemKind.Class : CompletionItemKind.Module
        }
    })
}

export function getCompletions(
    config: SerializedConfigSeeker,
    doc: DotvvmDocument,
    position: Position
): CompletionList | null {
    const offset = doc.offsetAt(position);
    
    const cx = decideCompletionContext(config, doc, offset)
    if (!cx) {
        Logger.log("No node found")
        return null;
    }

    function list(l:CompletionItem[]) {
        if (!cx) throw "??"
        if (cx!.appendText) {
            l = l.map(i => i.textEdit != null ? i : { ...i, insertTextFormat: InsertTextFormat.Snippet, insertText: (i.insertText ?? i.label) + "$1" + cx!.appendText })
        }

        if (cx.completionTarget) {
            const range = Range.create(doc.positionAt(cx.completionTarget.start), doc.positionAt(cx.completionTarget.end))
            l = l.map(i => i.textEdit != null ? i : { ...i, textEdit: { range, newText: i.insertText ?? i.label } })
        }

        return CompletionList.create(l)
    }

    Logger.log("Context is ", cx.context,
        (cx.binding && `In binding ${cx.binding.text}`) || '',
        (cx.control && `In control ${cx.control.type?.fullName ?? cx.control.kind}`) || '',
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
        return list(getTagCompletions(config, cx.control, cx.property))
    }

    return null
}
