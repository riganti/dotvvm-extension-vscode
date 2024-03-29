import { forEach } from 'lodash';
import type { NodeOfType, PickType, SyntaxNode, SyntaxType, Tree } from 'tree-sitter-dotvvm';
import { Position, TextDocumentContentChangeEvent, Range as VsCodeRange } from 'vscode-languageserver';
import { WritableDocument } from './documents';
import { log } from 'console';
import TreeSitter from 'tree-sitter'
import type WebTreeSitter from 'web-tree-sitter'
import { nullish } from '../utils';

let parserLoadPromise: Promise<void> | null = null;

try {
	var TreeSitterClass = require('tree-sitter');
	var dotvvmLang: any = require('tree-sitter-dotvvm');

	var dotvvmParser: (TreeSitter | WebTreeSitter) = new TreeSitterClass()
	dotvvmParser.setLanguage(dotvvmLang)

} catch(err) {
	console.warn("Could not initialize tree-sitter:", err)
	// console.warn("Will use the WASM version, if that works...");

	// parserLoadPromise = (async() => {
	// 	try {
	// 		const Parser: typeof import("web-tree-sitter") = require('web-tree-sitter')
	// 		await Parser.init()

	// 		const l = dotvvmLang = await Parser.Language.load(require.resolve('tree-sitter-dotvvm/tree-sitter-dotvvm.wasm'))
	// 		dotvvmParser = new Parser()
	// 		dotvvmParser.setLanguage(l)
	// 		console.log("Loaded WASM tree-sitter")
	// 	}
	// 	catch (e) {
	// 		console.error("Could not initialize web-tree-sitter:", e)
	// 	}
	// })()
}

// https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax
// See ^ if you are wondering what the hell is this :)
const styleNodeQuery =
	!dotvvmLang ? null :
	new TreeSitter.Query(dotvvmLang, `[
		(style_element content: (_) @content)
		(attribute name: (attribute_name_html "style") value: (_) @content)
	]`)

export async function init() {
	await parserLoadPromise

	console.log("Parser init complete.")
}

export function stopwatch() {
	const start = process.hrtime()

	return {
		stop() {
			const end = process.hrtime()
			const elapsedMs = (end[0] - start[0]) * 1000 + (end[1] - start[1]) / 1e6
			return elapsedMs
		},
		log(...msg: any[]) {
			const time = this.stop()
			console.log(...msg, "elapsed: ", `${time/1000 | 0}:${(time%1000).toFixed(2)}s`)
		}
	}
}

export function getParser(id: string): TreeSitter | WebTreeSitter | undefined {
	switch (id) {
		case 'dotvvm':
			return dotvvmParser
		default:
			return
	}
}

export function typeChild<T extends SyntaxType>(type: T, node: SyntaxNode | undefined | null): NodeOfType<T> | undefined {
	if (node == null)
		return

	let child = node.firstChild
	while (child != null) {
		if (child.type == type)
			return child as NodeOfType<T>
		child = child.nextSibling
	}
}

export function* nodeAncestors(node: SyntaxNode | undefined | null): Iterable<SyntaxNode> {
	while (node != null) {
		yield node
		node = node.parent
	}
}

export function typeAncestor<T extends SyntaxType>(type: T | T[], node: SyntaxNode | undefined | null, condition: nullish | ((n: NodeOfType<T>) => boolean) = null): NodeOfType<T> | undefined {
	if (node == null)
		return

	const set = new Set<string>(type instanceof Array ? type : [type])

	let a: SyntaxNode | null = node
	while (a != null) {
		if (set.has(a.type) && (condition == null || condition(a as NodeOfType<T>)))
			return a as NodeOfType<T>
		a = a.parent
	}
}

export function containsPosition(position: Position | number, node: SyntaxNode | null | undefined): boolean {
	if (node == null)
		return false
	if (typeof position == "number")
		return node.startIndex <= position && node.endIndex >= position

	throw "Not implemented"
}

export function nodeToVsRange(node: SyntaxNode): VsCodeRange
export function nodeToVsRange(node: SyntaxNode | null | undefined): VsCodeRange | null
export function nodeToVsRange(node: SyntaxNode | null | undefined): VsCodeRange | null {
    if (node == null)
        return null
    return VsCodeRange.create(
        node.startPosition.row,
        node.startPosition.column,
        node.endPosition.row,
        node.endPosition.column
    )
}

export type OffsetRange = { start: number, end: number }
export function nodeToORange(node: SyntaxNode): OffsetRange
export function nodeToORange(node: SyntaxNode | null | undefined): OffsetRange | null
export function nodeToORange(node: SyntaxNode | null | undefined): OffsetRange | null {
	if (node == null)
		return null
	return { start: node.startIndex, end: node.endIndex }
}


export class ParsedTree {
	tree: Tree;
	// get rootNode() { return this.tree.rootNode as dotvvmLang.SyntaxNode }
	get rootNode() { return this.tree.rootNode }

	nodeAt(position: Position | number) {
		if (typeof position === 'number') {
			return this.rootNode.descendantForIndex(position)
		} else {
			const point = { row: position.line, column: position.character }
			return this.rootNode.descendantForPosition(point, { row: position.line, column: position.character })
		}
	}

	query(query: TreeSitter.Query) {
		return query.matches(this.rootNode as any)
	}

	findStyleNodes(): SyntaxNode[] {
		if (styleNodeQuery == null)
			return []
		return this.query(styleNodeQuery)
			.map(m => m.captures.find(c => c.name == 'content')?.node)
			.filter(n => n != null) as SyntaxNode[]
	}

	constructor(
		public parser: TreeSitter | WebTreeSitter,
		public source: string) {
		if (source == null)
			throw new Error("source is null")
		const sw = stopwatch()
		this.tree = <Tree>parser.parse(source)
		// sw.log("Initial parse")
	}

	reparse(newSource: string) {
		const sw = stopwatch()
		this.tree = <Tree>this.parser.parse(newSource)
		this.source = newSource
		// sw.log("re-parse")
	}

	update(edits: TreeSitter.Edit[], newSource: string) {
		const sw = stopwatch()
		for (const e of edits) {
			this.tree.edit(e)
		}
		const oldTree = this.tree
		this.tree = <Tree>this.parser.parse(newSource, <any> oldTree)
		// sw.log("edit-parse")
	}
}
