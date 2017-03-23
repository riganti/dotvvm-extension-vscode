let vscode = require('vscode');
let DotvvmCompletionProvider = require('./completions/DotvvmCompletionProvider');

function activate(context) {
    console.log('Congratulations, DotVVM for Visual Studio Code is installed!');

    var disposable2 = vscode.languages.registerCompletionItemProvider(
        "dotvvm", 
        new DotvvmCompletionProvider(),
        "<", ":", " ", "\n"
    );
    context.subscriptions.push(disposable2);
}
exports.activate = activate;

function deactivate() {
}
exports.deactivate = deactivate;