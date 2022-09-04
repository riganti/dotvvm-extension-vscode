import { SerializedConfigSeeker } from "./serializedConfigSeeker"
import * as res from './dotvvmControlResolver';
import { emptyObject } from "../utils";

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
}

const predefinedProperties: { [c: string]: PropertyCompletionInfo } = {
	"DotVVM.Framework.Controls.TextBox.Text": {
		bindingTypes: ["value"],
		autocompleteBinding: "value"
	}
}


export function createDotvvmControlInfoProvider(
	config: SerializedConfigSeeker
) {
	if (!config) throw new Error("config is required")

	function getPropertyCompletionInfo(
		prop: res.NamedDotvvmPropertyInfo
	): PropertyCompletionInfo {
		const noValue = prop.type == "System.Boolean" && prop.defaultValue === false
		const onlyBindings = prop.onlyBindings
		const bindingTypes =
			prop.isCommand ? [ "staticCommand", "command" ] :
			prop.onlyHardcoded ? [ "resource" ] :
			[ "value", "resource" ];
		const autocompleteBinding =
			prop.isCommand ? "staticCommand" :
			prop.onlyBindings ? "value" : undefined;
		const hasQuotes = undefined // TODO

		const autocompleteValue =
			prop.type == "System.Boolean" && prop.defaultValue === true ? "false" :
			undefined

		const predefined = predefinedProperties[prop.declaringType + '.' + prop.name]
		return { noValue, onlyBindings, bindingTypes, autocompleteBinding, autocompleteValue, hasQuotes, ...predefined }
	}
	function getAttributeCompletionInfo(
		prop: res.ResolvedPropertyInfo
	): PropertyCompletionInfo {
		if (prop.kind == 'unknown')
			return {}

		if (prop.kind == 'group') {
			return {}//TODO property groups
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
		getPropertyCompletionInfo
	}
}

export type DotvvmControlInfoProvider = ReturnType<typeof createDotvvmControlInfoProvider>
