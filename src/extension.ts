import * as vscode from 'vscode';
// import * as properties from "java-properties";
import * as i18nProps from "i18nparser";
import { I18NCompletionItemProvider } from "./I18NCompletionProvider";
import { computeRecommendedLength } from "./RecLengthCalculator";

export async function activate(context: vscode.ExtensionContext) {
	let config = vscode.workspace.getConfiguration("ui5i18n");
	const i18nglob = config.get("i18nGlobPattern") as string;
	const i18nFileProperties = new i18nProps.I18NPropertiesFile();
	const uris = await vscode.workspace.findFiles(i18nglob);
	const collection = vscode.languages.createDiagnosticCollection('ui5i18n');

	let i18nCompletionItemProvider = new I18NCompletionItemProvider(i18nFileProperties, uris[0]);
	const itemProviderDisposable = vscode.languages.registerCompletionItemProvider(I18NCompletionItemProvider.DOCUMENT_SELECTOR, i18nCompletionItemProvider, ...I18NCompletionItemProvider.TRIGGER_CHARS);
	context.subscriptions.push(itemProviderDisposable);

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
	i18nFileWatcher.onDidChange(uri => {
		i18nFileProperties.removeFile(uri.fsPath);
		addFile(uri);
	});
	i18nFileWatcher.onDidCreate(uri => {
		i18nFileProperties.addFile(uri.fsPath);
	});
	i18nFileWatcher.onDidDelete(uri => {
		i18nFileProperties.removeFile(uri.fsPath);
	});

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

				if (i18nKey.duplicateOf) {
					const original = i18nFileProperties.get(i18nKey.duplicateOf);
					diagArray.push({
						code: '',
						message: i18nKey.duplicateOf + " is already defined",
						range: new vscode.Range(new vscode.Position(i18nKey.line, 0), new vscode.Position(i18nKey.line, i18nKey.duplicateOf.length)),
						severity: vscode.DiagnosticSeverity.Error,
						source: 'ui5i18n',
						relatedInformation: [
							new vscode.DiagnosticRelatedInformation(new vscode.Location(
								uri, new vscode.Range(
									new vscode.Position(original.line, 0),
									new vscode.Position(original.line, i18nKey.duplicateOf.length)
								)
							),
								'first definition of ' + i18nKey.duplicateOf)
						]
					});
					return;
				}

				if (i18nKey.def) {
					let recommendedLength = computeRecommendedLength(i18nKey.text);
					if (i18nKey.def.length !== null && i18nKey.def.length < recommendedLength) {
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
					let missingDefDiag : vscode.Diagnostic;
					
					if(i18nKey.defError){
						let erroneousDefLine = i18nKey.line - 1 ;
						let errorRange = new vscode.Range(new vscode.Position(erroneousDefLine, i18nKey.defError.offset), new vscode.Position(erroneousDefLine, i18nKey.defError.offset + 1));
						missingDefDiag = {
							code: '',
							message: sKey + " has faulty type definition",
							range: errorRange,
							severity: vscode.DiagnosticSeverity.Error,
							source: 'ui5i18n',
							relatedInformation: [
								new vscode.DiagnosticRelatedInformation(new vscode.Location(
									uri, errorRange
								),
									i18nKey.defError.message)
							]
						};
					} else {
						missingDefDiag = {
							code: '',
							message: sKey + " is missing type definition",
							range: new vscode.Range(new vscode.Position(i18nKey.line, 0), new vscode.Position(i18nKey.line, sKey.length)),
							severity: vscode.DiagnosticSeverity.Error,
							source: 'ui5i18n'
						};
					}
					
					diagArray.push(missingDefDiag);
				}
			});

			collection.set(uri, diagArray);
		} else {
			collection.set(uri, []);
		}
	}
	context.subscriptions.push(i18nFileWatcher);
}

export function deactivate() { }