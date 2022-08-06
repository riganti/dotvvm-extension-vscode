// TODO haha, it's not that simple

export type DotnetType = {
	namespace: string
	name: string
	assembly: string
}

export function parseTypeName(t: string): DotnetType | null {
	const m = /^((?<namespace>[\w._0-9]+)\.)?(?<name>[\w_0-9]+)(, (?<assembly>.*))?$/.exec(t);

	if (!m || !m.groups) {
		console.log("Can't parse type ", t)
		return null
	}

	return {
		namespace: m.groups.namespace || '',
		name: m.groups.name,
		assembly: m.groups.assembly || ''
	}
}
