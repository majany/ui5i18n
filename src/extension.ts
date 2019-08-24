import * as vscode from 'vscode';
import * as properties from "java-properties";

export async function activate(context: vscode.ExtensionContext) {
	console.log('active!');
	const i18nglob = "**/i18n.properties"; // TODO: make configurable

	const i18nFileProperties  = new properties.PropertiesFile();
	const addFile = (uri: vscode.Uri) => { 
		i18nFileProperties.addFile(uri.fsPath); 
	};
	const addFiles = async () => {
		const uris = await vscode.workspace.findFiles(i18nglob);
		i18nFileProperties.reset();
		uris.forEach(addFile);
		console.log(i18nFileProperties.getKeys().length);
	};
	addFiles();

	// track changes to i18n files
	const i18nFileWatcher = vscode.workspace.createFileSystemWatcher(i18nglob);
	i18nFileWatcher.onDidChange(addFiles);
	i18nFileWatcher.onDidCreate(addFiles);
	i18nFileWatcher.onDidDelete(addFiles);

	const itemprovider = vscode.languages.registerCompletionItemProvider({
		language: "xml",
		pattern: "**/*.xml",
		scheme: "file"
	}, {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			let range = document.getWordRangeAtPosition(position);
			let text = document.getText(range);
			if(range && (text.startsWith("i18n") || text.startsWith("i18"))){
					return i18nFileProperties.getKeys().map((key: string) => {
						let item = new vscode.CompletionItem(`i18n>${key}`, vscode.CompletionItemKind.Field);
						item.detail = i18nFileProperties.getLast(key);
						return item;
					});
			}
			return [];
		}
	}, "n", "8", "1");

	context.subscriptions.push(itemprovider);
	context.subscriptions.push(i18nFileWatcher);
}

export function deactivate() {}