import * as vscode from 'vscode';
// import * as properties from "java-properties";
import * as i18nProps from "i18nparser";

let i18nTextTypes : any = {
    "YACT": "Accessibility (long) ",
    "YBLI": "Bullet list item text ",
    "YDEF": "Definition ",
    "YDES": "Description",
    "YEXP": "Explanation ",
    "YFAA": "FAQ answer",
    "YFAQ": "FAQ",
    "YGLS": "Glossary definition",
    "YINF": "Information",
    "YINS": "Instruction ",
    "YLOG": "Log entry",
    "YMSE": "Error message",
    "YMSG": "Message text (long)",
    "YMSI": "Information message long",
    "YMSW": "Warning message",
    "YTEC": "Technical text",
    "YTIC": "Ticker / Marquee",
    "YTXT": "General text long",
    "XACT": "Accessibility",
    "XALT": "Alternative text",
    "XBCB": "Breadcrumb step",
    "XBLI": "Bullet list item text",
    "XBUT": "Button text",
    "XCAP": "Caption",
    "XCEL": "Cell",
    "XCKL": "Checkbox",
    "XCOL": "Column header",
    "XCRD": "Tabstrip",
    "XDAT": "Data navigation text",
    "XFLD": "Label",
    "XFRM": "Frame",
    "XGLS": "Term",
    "XGRP": "Group title",
    "XHED": "Heading",
    "XLGD": "Legend text ",
    "XLNK": "Hyperlink text",
    "XLOG": "Log entry",
    "XLST": "List box item",
    "XMEN": "Menu header",
    "XMIT": "Menu item",
    "XMSG": "Message text",
    "XRBL": "Radio button",
    "XRMP": "Roadmap step",
    "XROW": "Table row heading",
    "XSEL": "Selection text",
    "XTBS": "Tab strip text",
    "XTIT": "Table title",
    "XTND": "Tree node text",
    "XTOL": "Quick info text",
    "XTXT": "General text"
};

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
					let recommendedLength = computeRecommendedLength(i18nKey.text);
					if(i18nKey.def.length !== null && i18nKey.def.length < recommendedLength){
						let defLine = i18nKey.line - 1;
						diagArray.push({
							code: '',
							message: sKey + " length definition should be at least " + recommendedLength,
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


function computeRecommendedLength(text: string) {
	let tlength: number = 0;
	let enlength = text.length;

	// matrix for recommended length
	if (enlength >= 1 && enlength <= 4) {
		tlength = 10;
	}
	else if (enlength === 5) {
		tlength = 14;
	}
	else if (enlength === 6) {
		tlength = 16;
	}
	else if (enlength === 7) {
		tlength = 18;
	}
	else if (enlength >= 8 && enlength <= 10) {
		tlength = 20;
	}
	else if (enlength === 11) {
		tlength = 22;
	}
	else if (enlength === 12) {
		tlength = 24;
	}
	else if (enlength >= 13 && enlength <= 15) {
		tlength = 26;
	}
	else if (enlength === 16) {
		tlength = 28;
	}
	else if (enlength >= 17 && enlength <= 20) {
		tlength = 32;
	}
	else if (enlength >= 21 && enlength <= 80) {
		tlength = Math.round((enlength + enlength / 100 * 50));
	}
	else {
		tlength = Math.round((enlength + enlength / 100 * 30));
	}
	return tlength;
}

export function deactivate() {}