import * as vscode from 'vscode';
import * as i18nProps from "i18nparser";
import { I18NCompletionItemProvider } from "./I18NCompletionProvider";
import { I18NHoverProvider } from './I18NHoverProvider';
import { I18NDiagnosticsProvider } from './I18NDiagnosticsProvider';
import { I18NCodeActionProvider } from './I18NCodeActionProvider';

export async function activate(context: vscode.ExtensionContext) {
	let config = vscode.workspace.getConfiguration("ui5i18n");
	const i18nglob = config.get("i18nGlobPattern") as string;
	const i18nFileProperties = new i18nProps.I18NPropertiesFile();
	const uris = await vscode.workspace.findFiles(i18nglob);
	
	const i18nCompletionItemProvider = new I18NCompletionItemProvider(i18nFileProperties, uris[0]);
	const itemProviderDisposable = vscode.languages.registerCompletionItemProvider(I18NCompletionItemProvider.DOCUMENT_SELECTOR, i18nCompletionItemProvider, ...I18NCompletionItemProvider.TRIGGER_CHARS);
	context.subscriptions.push(itemProviderDisposable);
	
	const i18nHoverProvider = new I18NHoverProvider(i18nFileProperties);
	const hoverProviderDisposable = vscode.languages.registerHoverProvider(I18NHoverProvider.DOCUMENT_SELECTOR, i18nHoverProvider);
	context.subscriptions.push(hoverProviderDisposable);
	
	const collection = vscode.languages.createDiagnosticCollection('ui5i18n');
	const i18nDiagnosticsProvider = new I18NDiagnosticsProvider(i18nFileProperties);

	const i18nCodeActionProvider = new I18NCodeActionProvider(collection, i18nFileProperties);
	const codeActionProvider = vscode.languages.registerCodeActionsProvider(I18NCodeActionProvider.DOCUMENT_SELECTOR, i18nCodeActionProvider, I18NCodeActionProvider.METADATA);
	context.subscriptions.push(codeActionProvider);

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
			const fileDiagnostics = i18nDiagnosticsProvider.getDiagnostics(uri);
			collection.set(uri, fileDiagnostics);
		}
	}

	async function addFiles() {
		const uris = await vscode.workspace.findFiles(i18nglob);
		i18nFileProperties.clear();
		uris.forEach(addFile);
		console.log(i18nFileProperties.getKeys().length);
	}
	await addFiles();

	// track changes to i18n files (clear and reread changed file)
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
	context.subscriptions.push(i18nFileWatcher);

	// for internal use in template completion item
	let createi18nTextCommand = vscode.commands.registerCommand('ui5i18n.createI18nText', async (i18nFileUri: vscode.Uri, textKey: string) => {
		vscode.env.clipboard.writeText(textKey);
		await vscode.commands.executeCommand("vscode.openFolder", i18nFileUri);
	});
	context.subscriptions.push(createi18nTextCommand);
}
export function deactivate() { }