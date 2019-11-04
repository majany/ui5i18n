import * as vscode from 'vscode';
import { I18NPropertiesFile } from 'i18nparser';
import { I18NCompletionItemProvider } from './I18NCompletionProvider';


export class I18NDefinitionProvider implements vscode.DefinitionProvider {

    static DOCUMENT_SELECTOR: vscode.DocumentSelector = [{
        language: "xml",
        pattern: "**/*.xml",
        scheme: "file"
    }, {
        language: "javascript",
        pattern: "**/*.js",
        scheme: "file"
    }];

    private i18nProperties: I18NPropertiesFile;

    constructor(i18nProperties: I18NPropertiesFile) {
        this.i18nProperties = i18nProperties;
    }

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location | vscode.Location[] | vscode.LocationLink[]> {
        const wordRange = document.getWordRangeAtPosition(position, I18NCompletionItemProvider.WORD_PATTERN);
        const key = document.getText(wordRange);

        const i18nParsedKey = this.i18nProperties.get(key);
        if (i18nParsedKey) {
            const definitionFileUri = vscode.Uri.file(i18nParsedKey.fileName);
            return new vscode.Location(definitionFileUri,
                new vscode.Range(
                    new vscode.Position(i18nParsedKey.line, 0),
                    new vscode.Position(i18nParsedKey.line, key.length)
                )
            );
        }
    }
}