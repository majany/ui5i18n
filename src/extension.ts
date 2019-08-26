import * as vscode from 'vscode';
import * as properties from "java-properties";

export async function activate(context: vscode.ExtensionContext) {
	let config = vscode.workspace.getConfiguration("ui5i18n");
	const i18nglob = config.get("i18nGlobPattern") as string; 
	const i18nFileProperties  = new properties.PropertiesFile();

	const uris = await vscode.workspace.findFiles(i18nglob);

	function addFile(uri: vscode.Uri){ 
		i18nFileProperties.addFile(uri.fsPath); 
	}

	async function addFiles() {
		const uris = await vscode.workspace.findFiles(i18nglob);
		i18nFileProperties.reset();
		uris.forEach(addFile);
		console.log(i18nFileProperties.getKeys().length);
	}
	await addFiles();

	// track changes to i18n files (reread all)
	const i18nFileWatcher = vscode.workspace.createFileSystemWatcher("**/i18n.properties"); // config value does not work
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

			// removes i18n> prefix from completion items when i18n> was already typed
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
						// check if input text exists
						textExists = textExists || (prefix === "" && key === text.slice(5));
						return item;
					});

					// input text is not an existing i18n property --> show template completion item
					if(prefix === "" && text.length > 7 && vscode.CompletionTriggerKind.Invoke === context.triggerKind && !textExists ){
						let newPropertyName = text.slice(5);
						let placeholder = new vscode.CompletionItem(newPropertyName , vscode.CompletionItemKind.Snippet);
						placeholder.detail = "Create i18n property";
						placeholder.documentation = "Opens the main i18n.properties file and copies the name into the clipboard";
						placeholder.command = {
							command: "ui5i18n.createI18nText",
							arguments: [uris[0], newPropertyName],
							title: ""
						};
						i18nCompletionItems.push(placeholder);
					}
					return i18nCompletionItems;
			}
			return [];
		}
	}, ">", "n");
	
	// for internal use in template completion item
	let createi18nTextCommand = vscode.commands.registerCommand('ui5i18n.createI18nText', async (i18nFileUri : vscode.Uri, textKey: string) => {
		vscode.env.clipboard.writeText(textKey);
		await vscode.commands.executeCommand("vscode.openFolder", i18nFileUri);
	});

	const annotationDecoration: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType({
		after: {
			margin: '0 0 0 3em',
			textDecoration: 'none'
		},
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
	});

	let editorchangelistener = vscode.window.onDidChangeTextEditorSelection((e: vscode.TextEditorSelectionChangeEvent) => {
		let activeEditor = vscode.window.activeTextEditor;
		if(activeEditor && e.textEditor === activeEditor && activeEditor.document.languageId === "properties"){
			activeEditor.setDecorations(annotationDecoration, []);
			let activeLine = activeEditor.selection.active.line;
			let decorOp: vscode.DecorationOptions = {
				renderOptions: {
					after: {
						contentText: "my super number 2",
						color: new vscode.ThemeColor("textLink.foreground")
					}
				},
				range: activeEditor.document.validateRange(
					new vscode.Range(activeLine, Number.MAX_SAFE_INTEGER, activeLine, Number.MAX_SAFE_INTEGER)
				)
			};
			activeEditor.setDecorations(annotationDecoration, [
				decorOp
			]);
		}
	});


	context.subscriptions.push(createi18nTextCommand);
	context.subscriptions.push(itemprovider);
	context.subscriptions.push(i18nFileWatcher);
	context.subscriptions.push(editorchangelistener);
}

export function deactivate() {}