import * as vscode from 'vscode';
// import * as properties from "java-properties";
import * as i18nProps from "i18nparser";
import { I18NCompletionItemProvider, I18NCompletionitemProviderDocumentSelector, triggerCharacters } from "./I18NCompletionProvider";
import { computeRecommendedLength } from "./RecLengthCalculator";

export async function activate(context: vscode.ExtensionContext) {
	let config = vscode.workspace.getConfiguration("ui5i18n");
	const i18nglob = config.get("i18nGlobPattern") as string;
	const i18nFileProperties = new i18nProps.I18NPropertiesFile();
	const uris = await vscode.workspace.findFiles(i18nglob);
	const collection = vscode.languages.createDiagnosticCollection('ui5i18n');

	let i18nCompletionItemProvider = new I18NCompletionItemProvider(i18nFileProperties, uris[0]);
	const itemprovider = vscode.languages.registerCompletionItemProvider(I18NCompletionitemProviderDocumentSelector, i18nCompletionItemProvider, ...triggerCharacters);
	context.subscriptions.push(itemprovider);

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

	// for internal use in template completion item
	let createi18nTextCommand = vscode.commands.registerCommand('ui5i18n.createI18nText', async (i18nFileUri: vscode.Uri, textKey: string) => {
		vscode.env.clipboard.writeText(textKey);
		await vscode.commands.executeCommand("vscode.openFolder", i18nFileUri);
	});
	context.subscriptions.push(createi18nTextCommand);

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
	context.subscriptions.push(i18nFileWatcher);
}

export function deactivate() {}