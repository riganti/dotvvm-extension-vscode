// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { activateLS } from './lsinit';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log("VS Code is running Node ", process.version)
	activateLS(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
