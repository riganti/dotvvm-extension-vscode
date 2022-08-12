
// based on https://github.com/Aerijo/linter-tree-sitter/blob/master/lib/linter.js
// MIT Licensed, Copyright (c) 2018 Benjamin Gray

import { nodeToVsRange, ParsedTree } from "./parserutils";
import type { SyntaxType, SyntaxNode, Tree } from 'tree-sitter-dotvvm';
import { Diagnostic, DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver";

export function diagnosticsFromTree(tree: Tree): Diagnostic[] {
	const lintMessages: Diagnostic[] = [];

	collectErrors(tree.rootNode, lintMessages);
	return lintMessages
}
  
function collectErrors(node: SyntaxNode, errors: Diagnostic[]) {
	if (node.hasError()) { // true if any children have errors
		if (node.type === "ERROR") {
			errors.push(error(node));
		} else if (node.startIndex === node.endIndex || node.isMissing()) { // node.isMissing() doesn't appear to work
			errors.push(missing(node));
		}

		for (const child of node.children) {
			collectErrors(child, errors);
		}
	}
}
  
function error(node: SyntaxNode): Diagnostic {
	return {
		severity: DiagnosticSeverity.Error,
		range: nodeToVsRange(node),
		message: "Syntax error in node `" + node.parent?.type + "`" + (node.childCount > 0 ? ", unexpected child nodes [" + node.children.map(x => x.type).join(", ") + "]" : ""),
		source: "tree-sitter-dotvvm",
	}
}
  
function missing(node: SyntaxNode): Diagnostic {
	return {
		severity: DiagnosticSeverity.Warning,
		range: {
			start: { line: node.startPosition.row, character: node.startPosition.column },
			end: { line: node.endPosition.row, character: node.endPosition.column + 1 },
		},
		message: `Warning! Error detected and empty node '${node.type}'`
	}
}
