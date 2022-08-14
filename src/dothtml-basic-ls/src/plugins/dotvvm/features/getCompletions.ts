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
    MarkupKind
} from 'vscode-languageserver';
import { isInTag, DotvvmDocument } from '../../../lib/documents';
import { AttributeContext, getAttributeContextAtPosition } from '../../../lib/documents/parseHtml';
import { resolveControlOrProperty, ResolvedPropertyInfo } from '../../../lib/dotvvmControlResolver';
import { containsPosition, nodeAncestors, nodeToORange, OffsetRange, typeAncestor } from '../../../lib/parserutils';
import { DotvvmSerializedConfig, SerializedConfigSeeker } from '../../../lib/serializedConfigSeeker';
import { falsy, nullish } from '../../../utils';
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
    console.log("Node stack:", [...nodeAncestors(node)].map(n => n.type).reverse().join(" > "))
    if (node == null) {
        return null
    }
    const resolvedCx = resolveControlOrProperty(config, node)
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

export function getCompletions(
    config: SerializedConfigSeeker,
    doc: DotvvmDocument,
    position: Position
): CompletionList | null {
    const offset = doc.offsetAt(position);
    
    const cx = decideCompletionContext(config, doc, offset)
    if (!cx) {
        console.log("No node found")
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

    console.log("Context is ", cx.context,
        (cx.binding && `In binding ${cx.binding.text}`) || '',
        (cx.control && `In control ${cx.control.type?.fullName ?? cx.control.kind}`) || '',
        (cx.property && `In property ${cx.property.kind == 'property' ? cx.property.dotvvmProperty.name :
                                       cx.property.kind == 'group' ? cx.property.propertyGroup.name + ':' + cx.property.member :
                                       '<unknown>'}`) || ''
    )

    if (cx.context == "binding_start") {
        return list(getBindingTypes(cx.property))
    }

    return null
}
