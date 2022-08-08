import { forEach } from 'lodash';
import type { NodeOfType, PickType, SyntaxNode, SyntaxType, Tree } from 'tree-sitter-dotvvm';
import { Position, TextDocumentContentChangeEvent } from 'vscode-languageserver';
import { WritableDocument } from './documents';
import { log } from 'console';
import type TreeSitter from 'tree-sitter'
import type WebTreeSitter from 'web-tree-sitter'

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

export class ParsedTree {
	tree: Tree;
	// get rootNode() { return this.tree.rootNode as dotvvmLang.SyntaxNode }
	get rootNode() { return this.tree.rootNode }

	nodeAt(position: Position | number) {
		if (typeof position === 'number') {
			return this.rootNode.descendantForIndex(position)
		} else {
			return this.rootNode.descendantForPosition({ row: position.line, column: position.character })
		}
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
