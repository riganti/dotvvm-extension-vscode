import { forEach } from 'lodash';
import TreeSitter from 'tree-sitter';
import dotvvmLang, { Tree } from 'tree-sitter-dotvvm';
import { Position, TextDocumentContentChangeEvent } from 'vscode-languageserver';
import {  } from 'superstring'
import { WritableDocument } from './documents';
import { log } from 'console';


const dotvvmParser = new TreeSitter()
dotvvmParser.setLanguage(dotvvmLang)

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

export function getParser(id: string): TreeSitter | undefined {
	switch (id) {
		case 'dotvvm':
			return dotvvmParser
		default:
			return
	}
}

export function typeChild(type: string, node: TreeSitter.SyntaxNode | undefined | null): TreeSitter.SyntaxNode | undefined {
	if (node == null)
		return

	let child = node.firstChild
	while (child != null) {
		if (child.type == type)
			return child
		child = child.nextSibling
	}
}

export class ParsedTree {
	tree: TreeSitter.Tree;
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
		public parser: TreeSitter,
		public source: string) {
		const sw = stopwatch()
		this.tree = parser.parse(source)
		// sw.log("Initial parse")
	}

	reparse(newSource: string) {
		const sw = stopwatch()
		this.tree = this.parser.parse(newSource)
		this.source = newSource
		// sw.log("re-parse")
	}

	update(edits: TreeSitter.Edit[], newSource: string) {
		const sw = stopwatch()
		for (const e of edits) {
			this.tree.edit(e)
		}
		const oldTree = this.tree
		this.tree = this.parser.parse(newSource, oldTree)
		// sw.log("edit-parse")
	}
}
