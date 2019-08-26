import * as vscode from 'vscode';
// import * as properties from "java-properties";
import * as i18nProps from "i18nparser";

let i18nTextTypes = require("../src/i18nTextTypes");

export async function activate(context: vscode.ExtensionContext) {
	let config = vscode.workspace.getConfiguration("ui5i18n");
	const i18nglob = config.get("i18nGlobPattern") as string;
	const i18nFileProperties = new i18nProps.I18NPropertiesFile();
	const uris = await vscode.workspace.findFiles(i18nglob);
	const collection = vscode.languages.createDiagnosticCollection('ui5i18n');

	function addFile(uri: vscode.Uri) {

		let error = i18nFileProperties.addFile(uri.fsPath);
		if (error) {
			console.log("failed parsing " + vscode.workspace.asRelativePath(uri.fsPath));

			let match = error.message.match(/at line (\d+) col (\d+):/) as string[];
			let line = +match[1] - 1;
			let column = +match[2];

			collection.set(uri, [{
				code: '',
				message: error.message,
				range: new vscode.Range(new vscode.Position(line, column), new vscode.Position(line, column)),
				severity: vscode.DiagnosticSeverity.Error,
				source: 'ui5i18n'
			}]);
		} else {
			updateDiagnostics(uri, collection);
		}
	}

	async function addFiles() {
		const uris = await vscode.workspace.findFiles(i18nglob);
		i18nFileProperties.clear();
		uris.forEach(addFile);
		console.log(i18nFileProperties.getKeys().length);
	}
	await addFiles();
	// track changes to i18n files (cleare and reread all)
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
			if (range && text.startsWith("i18n>")) {
				prefix = "";
			}

			if (range && (text.startsWith("i18n>") || text.startsWith("i18n"))) {
				let textExists = false;
				// show existing i18n properties
				let i18nCompletionItems = i18nFileProperties.getKeys().map((key: string) => {
					let item = new vscode.CompletionItem(prefix + key, vscode.CompletionItemKind.Field);
					let keyInfo = i18nFileProperties.get(key);
					item.detail = keyInfo.text;
					item.documentation = formatCompletionItemDocumentation(keyInfo);
					// check if input text exists
					textExists = textExists || (prefix === "" && key === text.slice(5));
					return item;
				});

				// input text is not an existing i18n property --> show template completion item
				if (prefix === "" && text.length > 7 && vscode.CompletionTriggerKind.Invoke === context.triggerKind && !textExists) {
					let newPropertyName = text.slice(5);
					let placeholder = new vscode.CompletionItem(newPropertyName, vscode.CompletionItemKind.Snippet);
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
	let createi18nTextCommand = vscode.commands.registerCommand('ui5i18n.createI18nText', async (i18nFileUri: vscode.Uri, textKey: string) => {
		vscode.env.clipboard.writeText(textKey);
		await vscode.commands.executeCommand("vscode.openFolder", i18nFileUri);
	});

	function updateDiagnostics(uri: vscode.Uri, collection: vscode.DiagnosticCollection): void {
		if (uri && uris.some(uri => uri.fsPath === uri.fsPath)) {
			//TODO: filter by file uri
			let diagArray: vscode.Diagnostic[] = [];
			i18nFileProperties.getKeys().forEach(sKey => {
				let i18nKey = i18nFileProperties.get(sKey);

				if (i18nKey.fileName !== uri.fsPath) {
					return;
				}

				if(i18nKey.def){
					if(i18nKey.def.length !== null && i18nKey.def.length <= i18nKey.text.length){
						let defLine = i18nKey.line - 1;
						diagArray.push({
							code: '',
							message: sKey + " length definition should be at least " + (i18nKey.text.length + 1),
							range: new vscode.Range(new vscode.Position(defLine, 0), new vscode.Position(defLine, 9)),
							severity: vscode.DiagnosticSeverity.Warning,
							source: 'ui5i18n'
						});
					}
				} else {
					diagArray.push({

						code: '',
						message: sKey + " is missing type definition",
						range: new vscode.Range(new vscode.Position(i18nKey.line, 0), new vscode.Position(i18nKey.line, sKey.length)),
						severity: vscode.DiagnosticSeverity.Error,
						source: 'ui5i18n'
					});
				}
			});

			collection.set(uri, diagArray);
		} else {
			collection.set(uri, []);
		}
	}


	context.subscriptions.push(createi18nTextCommand);
	context.subscriptions.push(itemprovider);
	context.subscriptions.push(i18nFileWatcher);
	// context.subscriptions.push(editorchangelistener);
}

function formatCompletionItemDocumentation(keyInfo: i18nProps.i18nValue): string {
	let res = "";
	if (keyInfo.def) {
		res += keyInfo.def.text.trim() + "\n";
		let typeName = i18nTextTypes[keyInfo.def.type];
		res += "type:\t" + typeName + " (" + keyInfo.def.type + ")" + "\n";
		if (keyInfo.def.length) {
			res += "length:\t" + keyInfo.text.length + " (max " + keyInfo.def.length + ")";
			if (keyInfo.text.length >= keyInfo.def.length) {
				res += " ⚠️\n";
			} else {
				res += "\n";
			}
		}
		res += "file:\t\t" + vscode.workspace.asRelativePath(keyInfo.fileName) + ", line " + (keyInfo.line + 1) + "\n";
	} else {
		res += "Definition is missing! ❌\n";
		res += "file: " + vscode.workspace.asRelativePath(keyInfo.fileName) + ", line " + (keyInfo.line + 1) + "\n";
	}

	return res;
}

export function deactivate() {}