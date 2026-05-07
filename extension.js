const vscode = require('vscode');

function findMatchingParen(text, openPos) {
    let depth = 0;
    for (let i = openPos; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function tryExpandLine(line) {
    const trimmed = line.trim();

    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return line;
    }

    const indent = line.match(/^(\s*)/)[1];

    const ifMatch = /^((?:}\s*)?(?:else\s+)?if\s*)\(/.exec(trimmed);
    if (!ifMatch) return line;

    const parenStart = ifMatch[1].length;
    const parenEnd = findMatchingParen(trimmed, parenStart);
    if (parenEnd === -1) return line;

    const afterCondition = trimmed.slice(parenEnd + 1).trim();

    if (afterCondition.startsWith('{')) return line;
    if (!afterCondition.endsWith(';') || afterCondition.includes('{')) return line;

    const condition = trimmed.slice(0, parenEnd + 1);
    const bodyIndent = indent + '    ';

    return `${indent}${condition} {\n${bodyIndent}${afterCondition}\n${indent}}`;
}

function expandIfBlocks(text) {
    return text.split('\n').map(tryExpandLine).join('\n');
}

async function applyTransform(editor) {
    const doc = editor.document;
    const text = doc.getText();
    const transformed = expandIfBlocks(text);
    if (transformed === text) return;

    const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(text.length)
    );
    await editor.edit(editBuilder => editBuilder.replace(fullRange, transformed));
}

function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('if-expander.expand', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            await applyTransform(editor);
            vscode.window.showInformationMessage('If Expander: bloques expandidos.');
        })
    );

    context.subscriptions.push(
        vscode.workspace.onWillSaveTextDocument(async (event) => {
            const config = vscode.workspace.getConfiguration('if-expander');
            if (!config.get('expandOnSave', true)) return;

            const lang = event.document.languageId;
            if (lang !== 'apex' && lang !== 'javascript') return;

            const editor = vscode.window.visibleTextEditors.find(
                e => e.document === event.document
            );
            if (editor) await applyTransform(editor);
        })
    );
}

function deactivate() {}

module.exports = { activate, deactivate };
