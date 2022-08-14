import { groupBy, uniqBy, uniqWith } from "lodash";
import { IAttributeData, IHTMLDataProvider, ITagData, IValueData, MarkupContent } from "vscode-html-languageservice";
import { parseTypeName } from "../../lib/dotnetUtils";
import * as res from "../../lib/dotvvmControlResolver";
import { CodeControlRegistrationInfo, ControlRegistrationInfo, DotvvmControlInfo, DotvvmPropertyGroupInfo, DotvvmPropertyInfo, MarkupControlRegistrationInfo, SerializedConfigSeeker } from "../../lib/serializedConfigSeeker";
import { choose, unique, uniqueBy } from "../../utils";

const boolValues = [ { name: "true" }, { name: "false" }];

const defaultControlProperties: IAttributeData[] = [
	{ name: "DataContext", description: "a data context for the control and its children. All value and command bindings are evaluated in context of this value.", values: [{ name: "{value: _this.$1}" }] },
	{ name: "IncludeInPage", description: "whether the control is included in the DOM of the page. \n\n Essentially wraps Knockout's 'if' binding.", values: [{ name: "{value: true}" }] },	
	{ name: "RenderSettings.Mode", description: "", values: [{ name: "Client" }, { name: "Server" }] }
]

const defaultHtmlProperties: IAttributeData[] = defaultControlProperties.concat([
	{ name: "Visible", description: "whether the control is visible - set's  `display: none` style.", values: [{ name: "{value: true}" }] },
	{ name: "ID", description: "Sets control id", values: [] },
	{ name: "Class-$1", description: "Adds the specified CSS class, when the value is true", values: [ { name: "{value: true}" }] },
	{ name: "Style-$1", description: "", values: [] },
	{ name: "Validator.Value", description: "a binding that points to the validated value.", values: [] },
	{ name: "Validator.HideWhenValid", description: "whether the control should be hidden even for valid values.", values: boolValues },
	{ name: "Validator.InvalidCssClass", description: "the name of CSS class which is applied to the control when it is not valid.", values: [] },
	{ name: "Validator.SetToolTipText", description: "whether the title attribute should be set to the error message.", values: boolValues },
	{ name: "Validator.ShowErrorMessageText", description: "whether the error message text should be displayed.", values: boolValues },
	{ name: 'Events.Click', description: '', values: [ { name: "{staticCommand: s.Something()}" } ] },
    { name: 'Events.DoubleClick', description: '', values: [ { name: "{staticCommand: s.Something()}" } ] },
])

const defaultMarkupControlProperties = defaultHtmlProperties.concat([
])

export class DothtmlDataProvider implements IHTMLDataProvider {
	constructor(public config: SerializedConfigSeeker)
	{
	}

	getId(): string {
		return "dotvvm"
	}
	isApplicable(languageId: string): boolean {
		return languageId == "dotvvm"
	}
	provideTags(): ITagData[] {
		return []
		// return this.config.cached("tags", c => {
		// 	const controlTypes = choose(unique(c.flatMap(c => Object.keys(c.controls))), parseTypeName)
		// 	// console.log("Control types:", controlTypes)
		// 	const markupMapping = c.flatMap(c => c.config.markup.controls)
		// 	const markupControls =
		// 		choose(markupMapping, m => "tagName" in m ? m : null)
		// 		.map(c => <ITagData>{
		// 			name: c.tagPrefix + ":" + c.tagName,
		// 			description: "Markup control " + c.src
		// 		})

		// 	const byNamespace = groupBy(choose(markupMapping, m => "namespace" in m ? m : null), m => m.namespace)

		// 	const mappedControls =
		// 		choose(controlTypes, c => {
		// 			const prefix =
		// 				byNamespace[c.namespace]?.find(m => m.assembly == c.assembly)?.tagPrefix ??
		// 				byNamespace[c.namespace]?.[0]?.tagPrefix
		// 			if (prefix == null)
		// 			{
		// 				// console.log("Control has no registration?", c)
		// 				return null
		// 			}
		// 			return <ITagData>{
		// 				name: prefix ? prefix + ":" + c.name : c.name,
		// 				description: "Control " + c.namespace + "." + c.name,
		// 			}
		// 		})
		// 	// console.log("Asked for tags, got", markupControls.map(m => m.name), "and ", mappedControls.map(m => m.name))

		// 	return uniqueBy(markupControls.concat(mappedControls), c => c.name)
		// })
	}
	provideAttributes(tag: string): IAttributeData[] {
		if (tag.indexOf(':') < 0) {
			return defaultHtmlProperties
		}

		const control = res.resolveControl(this.config, tag)
		if (control == null) {
			return []
		}

		if (control.type == null) {
			if (control.kind == "markup") {
				return defaultMarkupControlProperties
			}
			return defaultControlProperties
		}

		const properties =
			Array.from(res.listProperties(this.config, control.type, "Attribute"))
				.map(p => <IAttributeData>{
					name: p.mappingName ?? p.name,
					description: [
						p.type != "System.String" ? "Type: " + parseTypeName(p.type)?.name : "",
						p.fromCapability ? "From " + parseTypeName(p.fromCapability)?.name : "",
						p.mappingMode == "Both" ? "Can be used as inner element" : "",
						p.required ? "**Required**" : "",
						p.isActive ? "Active" : "",
						p.isCompileTimeOnly ? "Compile-Time" : "",
					].filter(x => x).join(" | "),

					values: p.type == "System.Boolean" ? boolValues : []
				})
		// console.log(tag, "Properties: ", properties.map(p => p.name))

		return properties
	}
	provideValues(tag: string, attribute: string): IValueData[] {
		return [ ]
	}

}
