import * as vscode from 'vscode';
import * as properties from "java-properties";

export async function activate(context: vscode.ExtensionContext) {
	const i18nglob = "**/i18n.properties"; // TODO: make configurable
	const i18nFileProperties  = new properties.PropertiesFile();

	// const uris = await vscode.workspace.findFiles(i18nglob);

	function addFile(uri: vscode.Uri){ 
		i18nFileProperties.addFile(uri.fsPath); 
	}

	async function addFiles() {
		const uris = await vscode.workspace.findFiles(i18nglob);
		i18nFileProperties.reset();
		uris.forEach(addFile);
		console.log(i18nFileProperties.getKeys().length);
	}
	addFiles();

	// track changes to i18n files (reread all)
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
			let range = document.getWordRangeAtPosition(position, /[A-Za-z0-9>_]+/);
			let text = document.getText(range);

			let prefix = "i18n>";
			if(range && text.startsWith("i18n>")){
				prefix = "";
			}
			
			if(range && (text.startsWith("i18n>") || text.startsWith("i18n"))){
					let textExists = false;
					// show existing i18n properties
					let i18nCompletionItems = i18nFileProperties.getKeys().map((key: string) => {
						let item = new vscode.CompletionItem(prefix + key, vscode.CompletionItemKind.Field);
						item.detail = i18nFileProperties.getLast(key);
						textExists = textExists || (prefix === "" && key === text.slice(5));
						return item;
					});

					// new i18n property
					// if(prefix === "" && text.length > 7 && vscode.CompletionTriggerKind.Invoke === context.triggerKind && !textExists ){
					// 	let placeholder = new vscode.CompletionItem(text.slice(5) , vscode.CompletionItemKind.Snippet);
					// 	placeholder.detail = "Create i18n property";
					// 	placeholder.command = {
					// 		command: "vscode.openFolder",
					// 		arguments: [uris[0]],
					// 		title: ""
					// 	};
					// 	placeholder.sortText = "z" + placeholder.label;
					// 	i18nCompletionItems.push(placeholder);
					// }
					return i18nCompletionItems;
			}
			return [];
		}
	}, ">", "n");

	context.subscriptions.push(itemprovider);
	context.subscriptions.push(i18nFileWatcher);
}

export function deactivate() {}