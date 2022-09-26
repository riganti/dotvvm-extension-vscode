import { CompletionItem, InsertTextFormat } from "vscode-languageserver-types";
import { DotvvmDocument } from "../../../lib/documents";
import { DotnetType, parseTypeName } from "../../../lib/dotnetUtils";
import { SerializedConfigSeeker } from "../../../lib/serializedConfigSeeker";
import { Logger } from "../../../logger";
import { nullish } from "../../../utils";

const directiveTypes: CompletionItem[] = [
    { label: "viewModel", documentation: "The view model type of the page or control." },
    { label: "js", documentation: "Imports a javascript module into the page, it's controls can be used using `<js:MyComponent prop={value: Prop}>` syntax. Functions may be called using _js.Invoke or _js.InvokeAsync" },
    { label: "masterPage", documentation: "The page where ContentPlaceholders are defined for our Content. See https://www.dotvvm.com/docs/latest/pages/concepts/layout/master-pages" },
    { label: "service", documentation: "Imports a service from IServiceProvider, makes it possible to use in `command`, `staticCommand` and `resource` bindings." },
    { label: "import", documentation: "Imports a namespace (equivalent to C# `using`, or F# `open` keyword). Supports importing a namespace or a type as alias" },


    { label: "baseType", documentation: "The .NET class defining behavior and properties of this markup control." },
    { label: "property", documentation: "Defines a property of this markup control. Syntax: `@property string Test = \"Default Value\"`" },
    { label: "wrapperTag", documentation: "The HTML tag that will be used to wrap the markup control. Syntax: `@wrapperTag div`" },
    { label: "noWrapperTag", documentation: "If present, the markup control won't be wrapped in any HTML tag" },
]

const controlOnlyDirectives = [ "baseType", "property", "wrapperTag", "noWrapperTag" ]
const pageOnlyDirectives = [ "masterPage" ]

function formatCsharpType(type: DotnetType, snippetCounter = { i:1 }): string {
    if (type.kind == "array") {
        return `${formatCsharpType(type.elementType, snippetCounter)}[]`
    } else if (type.kind == "pointer") {
        return `${formatCsharpType(type.elementType, snippetCounter)}*`
    } else if (type.kind == "reference") {
        return `${formatCsharpType(type.elementType, snippetCounter)}&`
    } else if (type.kind == "generic") {
        // nullable
        if (type.fullName.startsWith("System.Nullable`1[[")) {
            return `${formatCsharpType(type.typeArgs[0], snippetCounter)}?`
        }

        // value tuple
        if (type.fullName.startsWith("System.ValueTuple`")) {
            return `(${type.typeArgs.map(t => formatCsharpType(t, snippetCounter)).join(", ")})`
        }

        const name = type.name.replace(/`[0-9]+$/, '')
        return `${name}<${type.typeArgs.map(t => formatCsharpType(t, snippetCounter)).join(", ")}>`
    } else if (type.kind == "simple") {
        const genericArgsM = /`[0-9]+$/.exec(type.fullName)
        if (genericArgsM) {
            // open generics, replace with snippets
            let name = type.fullName.replace(/`(?<num>[0-9]+)$/, '')
            name += "<"
            for (let i = +genericArgsM.groups!.num; i > 0; i--) {
                name += "$" + snippetCounter.i
                snippetCounter.i++
                if (i > 1)
                    name += ", "
            }
            name += ">"
            return name
        }
        return type.fullName
    }

    throw new Error("Unknown type kind: " + type)
}

function typeToCompletionItem(type: string | DotnetType): CompletionItem {
    if (typeof type === "string") {
        const ptype = parseTypeName(type)
        if (!ptype) {
            Logger.error("Could not parse type", type)
            return { label: type }
        }
        type = ptype
    }
    let insertText = formatCsharpType(type)
    return ({
        label: `${type?.name} (${type?.namespace})`,
        insertText,
        insertTextMode: insertText.includes("<$") ? InsertTextFormat.Snippet : InsertTextFormat.PlainText
    })
}

export class DotvvmDirectiveCompletion {
    constructor(public config: SerializedConfigSeeker)
    {
    }

    getDirectiveNames(doc: DotvvmDocument): CompletionItem[] {
        const type = doc.dotvvmType

        Logger.log("Directive completion for", type)

        const items =
            directiveTypes.filter(d => type == "control" ? !pageOnlyDirectives.includes(d.label) : !controlOnlyDirectives.includes(d.label))

        return items.map(i => ({
            ...i,
            insertText: i.label + " ",
            commitCharacters: [ " " ]
        }))
    }

    getViewModelValues(doc: DotvvmDocument): CompletionItem[] {
        var types = this.config.dllSeeker.findImplementations("DotVVM.Framework.ViewModel.IDotvvmViewModel", { public: true, internal: true, nonAbstract: true, instance: true })

        return types.map(t => typeToCompletionItem(t))
    }

    getBaseTypeValues(doc: DotvvmDocument): CompletionItem[] {
        var types = this.config.dllSeeker.findImplementations("DotVVM.Framework.Controls.DotvvmMarkupControl", { public: true, internal: true, nonAbstract: true, instance: true })

        return types.map(t => typeToCompletionItem(t))
    }
}
