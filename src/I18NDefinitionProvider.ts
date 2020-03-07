import * as vscode from 'vscode';
import { I18NPropertiesFile } from 'i18nparser';


export class I18NDefinitionProvider implements vscode.DefinitionProvider {

    static DOCUMENT_SELECTOR: vscode.DocumentSelector = [{
        language: "xml",
        pattern: "**/*.xml",
        scheme: "file"
    }, {
        language: "javascript",
        pattern: "**/*.js",
        scheme: "file"
    },{
        language: "json",
        pattern: "**/*.json",
        scheme: "file"
    }];

    static JSON_WORD_PATTERN = /[A-Za-z0-9_|.]+/;

    private i18nProperties: I18NPropertiesFile;

    constructor(i18nProperties: I18NPropertiesFile) {
        this.i18nProperties = i18nProperties;
    }

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location | vscode.Location[] | vscode.LocationLink[]> {
        let wordRange;
        if(document.languageId === "json"){
            wordRange = document.getWordRangeAtPosition(position, I18NDefinitionProvider.JSON_WORD_PATTERN);
        } else {
            wordRange = document.getWordRangeAtPosition(position);
        }
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