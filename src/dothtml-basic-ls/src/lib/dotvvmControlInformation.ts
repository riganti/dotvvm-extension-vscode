import { SerializedConfigSeeker } from "./serializedConfigSeeker"
import * as res from './dotvvmControlResolver';
import { emptyObject } from "../utils";
import { parseTypeName } from "./dotnetUtils";

export type ControlCompletionInfo = {
	/** true if we don't expect any content of this control */
	selfClosing?: boolean
	/** List of properties which are automatically added right when the user chooses this control */
	autoProperties?: string[]
}

export type PropertyCompletionInfo = {
	/** if the property likely won't have any value (i.e. it's boolean with default=false) */
	noValue?: boolean
	/** if the property can only contain value and it's likely to need quotes */
	hasQuotes?: boolean
	/** if there must be binding - we will add `={}` */
	onlyBindings?: boolean
	/** which bindings are supported in this property */
	bindingTypes?: string[]
	/** which binding should be automatically added. For example for TextBox.Text we'll auto-add ={value: $1} */
	autocompleteBinding?: string

	autocompleteValue?: string
}


const predefinedControls: { [c: string]: ControlCompletionInfo } = {
	"DotVVM.Framework.Controls.Button": {
		autoProperties: ["Click"]
	},
	"DotVVM.Framework.Controls.LinkButton": {
		autoProperties: ["Click"]
	},
	"DotVVM.Framework.Controls.DataPager": {
		autoProperties: ["DataSet"]
	},
	"DotVVM.Framework.Controls.CheckBox": {
		autoProperties: ["Checked"],
		selfClosing: true
	},
	"DotVVM.Framework.Controls.ContentPlaceHolder": {
		autoProperties: ["ID"],
		selfClosing: true
	},
	"DotVVM.Framework.Controls.SpaContentPlaceHolder": {
		autoProperties: ["ID"],
		selfClosing: true
	},
	"DotVVM.Framework.Controls.Content": {
		autoProperties: ["ContentPlaceHolderID"]
	},
	"DotVVM.Framework.Controls.EmptyData": {
		autoProperties: ["DataSource"]
	},
	"DotVVM.Framework.Controls.HtmlLiteral": {
		autoProperties: ["Html"],
		selfClosing: true
	},
	"DotVVM.Framework.Controls.Literal": {
		autoProperties: ["Text"],
	},
	"DotVVM.Framework.Controls.Validator": {
		autoProperties: ["Value"],
		selfClosing: true
	},
}

const predefinedProperties: { [c: string]: PropertyCompletionInfo } = {
	"DotVVM.Framework.Controls.TextBox.Text": {
		onlyBindings: true,
		bindingTypes: ["value"],
		autocompleteBinding: "value"
	},
	"DotVVM.Framework.Controls.Literal.Text": {
		onlyBindings: true
	},
	"DotVVM.Framework.Controls.RenderSettings.Mode": {
		autocompleteValue: "Server" // Client is default
	}
}

const predefinedPGroups: { [c: string]: PropertyCompletionInfo } = {
	"DotVVM.Framework.Controls.HtmlGenericControl.CssClasses": {
		onlyBindings: true,
		bindingTypes: ["value", "resource"],
		autocompleteBinding: "value"
	},
	"DotVVM.Framework.Controls.HtmlGenericControl.CssStyles": {
		onlyBindings: true,
		bindingTypes: ["value", "resource"],
		autocompleteBinding: "value"
	},
	"DotVVM.Framework.Controls.JsComponent.Props": {
		onlyBindings: false,
		bindingTypes: ["value", "resource", "command", "staticCommand"],
		autocompleteBinding: "value"
	},
}

const bindingTypeMapping: { [c: string]: string[] } = {
	"IBinding": ["value", "resource", "staticCommand", "command"],
	"IValueBinding": ["value"],
	"IValueBinding`1": ["value"],
	"ICommandBinding": ["staticCommand", "command"],
	"ICommandBinding`1": ["staticCommand", "command"],
	"IStaticValueBinding": ["value", "resource"],
	"IStaticValueBinding`1": ["value", "resource"],
	"IStaticCommandBinding": ["staticCommand"],
	"IStaticCommandBinding`1": ["staticCommand"],
}

export function createDotvvmControlInfoProvider(
	config: SerializedConfigSeeker
) {
	if (!config) throw new Error("config is required")

	function getPropertyCompletionInfo(
		prop: res.NamedDotvvmPropertyInfo | (res.NamedDotvvmPropertyGroupInfo & { defaultValue?: any }),
		isGroup = false
	): PropertyCompletionInfo {
		if (prop?.type == null) throw new Error("Missing property type")
		const predefined =
			isGroup ? predefinedPGroups[prop.declaringType + '.' + prop.name]
				    : predefinedProperties[prop.declaringType + '.' + prop.name]
		
		const type = parseTypeName(prop.type)
		const isBindingType = (type?.nongenericName ?? type?.name ?? "") in bindingTypeMapping

		const noValue = prop.type == "System.Boolean" && prop.defaultValue === false
		const onlyBindings = predefined?.onlyBindings || isBindingType || Boolean(prop.onlyBindings) || prop.isCommand || (!prop.onlyHardcoded && isGroup && prop.type == "System.Boolean")
		const bindingTypes =
			predefined?.bindingTypes ?? (
			isBindingType ? bindingTypeMapping[type?.nongenericName ?? type?.name!] :
			prop.isCommand ? [ "staticCommand", "command" ] :
			prop.onlyHardcoded ? [ "resource" ] :
			[ "value", "resource" ]);
		const autocompleteBinding =
			prop.isCommand ? "staticCommand" :
			prop.onlyBindings ? "value" :
			onlyBindings && bindingTypes.length > 0 ? bindingTypes[0] :
			undefined;

		const hasQuotes =
			prop.type == "System.String" || prop.type == "System.Object" || type?.kind == "array"

		const autocompleteValue =
			prop.type == "System.Boolean" && prop.defaultValue === true ? "false" :
			undefined

		return { noValue, onlyBindings, bindingTypes, autocompleteBinding, autocompleteValue, hasQuotes, ...predefined }
	}
	function getPropertyGroupCompletionInfo(
		pg: res.NamedDotvvmPropertyGroupInfo
	): PropertyCompletionInfo {
		return getPropertyCompletionInfo(pg, true)
	}
	function getAttributeCompletionInfo(
		prop: res.ResolvedPropertyInfo
	): PropertyCompletionInfo {
		if (prop.kind == 'unknown')
			return {}

		if (prop.kind == 'group') {
			return getPropertyGroupCompletionInfo(prop.propertyGroup)
		}

		return getPropertyCompletionInfo(prop.dotvvmProperty)

	}
	function getControlCompletionInfo(
		control: res.ResolveControlResult
	): ControlCompletionInfo {
		if (!control.type) {
			return {}
		}

		let predefined =
			control.type.fullName in predefinedControls
				? predefinedControls[control.type.fullName]
				: {}

		const requiredProperties = new Set<string>()
		for (const p of res.listProperties(config, control.type)) {
			if (p.required) {
				requiredProperties.add(p.name)
			}

			// properties which 
			if (p.dataContextChange && p.name == control.type.defaultContentProperty) {
				for (const pp of p.dataContextChange?.flatMap(c => c.PropertyDependsOn ?? [])) {
					requiredProperties.add(pp)
				}
			}
		}
		const autoProperties = Array.from(requiredProperties)

		const selfClosing = control.type.withoutContent && !control.type.defaultContentProperty

		return { selfClosing, autoProperties, ...predefined } // predefined is last - it has precedence
	}
	return {
		getControlCompletionInfo,
		getAttributeCompletionInfo,
		getPropertyCompletionInfo,
		getPropertyGroupCompletionInfo,
	}
}

export type DotvvmControlInfoProvider = ReturnType<typeof createDotvvmControlInfoProvider>
