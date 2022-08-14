// TODO haha, it's not that simple

export type DotnetType = {
	namespace: string
	name: string
	assembly: string | null
	fullName: string
}

export function parseTypeName(t: string): DotnetType | null {
	const m = /^((?<namespace>[\w._0-9]+)\.)?(?<name>[\w_0-9+`]+)(, (?<assembly>.*))?$/.exec(t);

	if (!m || !m.groups) {
		console.log("Can't parse type ", t)
		return null
	}

	return {
		namespace: m.groups.namespace || '',
		name: m.groups.name,
		assembly: m.groups.assembly || null,
		fullName: m.groups.namespace ? m.groups.namespace + '.' + m.groups.name : m.groups.name
	}
}


export const KnownDotnetTypes = {
	HtmlGenericControl: parseTypeName('DotVVM.Framework.Controls.HtmlGenericControl, DotVVM.Framework')!,
	DotvvmControl: parseTypeName('DotVVM.Framework.Controls.DotvvmControl, DotVVM.Framework')!,
	DotvvmBindableObject: parseTypeName('DotVVM.Framework.Controls.DotvvmBindableObject, DotVVM.Framework')!,
}
