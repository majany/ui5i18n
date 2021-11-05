import * as assert from 'assert';
import { before } from 'mocha';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as ui5i18n from '../../extension';

suite('Extension Test Suite', () => {
	before(() => {
		vscode.window.showInformationMessage('Start all tests.');
	});

	test('Should be active in a ui5 application containing ui5.yaml file', () => {
		const extension = vscode.extensions.getExtension("majany.ui5i18n");
		const isActive = extension && extension.isActive;
		assert.ok(isActive);
	});

	test("Should show i18n hovers in xml files", async () => {
		const uris = await vscode.workspace.findFiles("**/App.view.xml");
		const xmlFile = uris[0];
		await vscode.commands.executeCommand("vscode.openFolder", xmlFile);
		// await new Promise( (resolve, reject) => setTimeout(() => {
		// 	resolve();
		// }, 5000));
		const hovers = await vscode.commands.executeCommand("vscode.executeHoverProvider", xmlFile, new vscode.Position(3, 72)) as vscode.Hover[];
		assert.strictEqual(hovers.length, 1);
	});//.timeout(10000);
});
