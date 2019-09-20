import * as vscode from 'vscode';
import { CompletionItemProvider } from 'vscode';
import { I18NPropertiesFile, i18nValue } from "i18nparser";
import { I18nTextTypes } from "./i18nTextTypes";

export const I18NCompletionitemProviderDocumentSelector: vscode.DocumentSelector = {
    language: "xml",
    pattern: "**/*.xml",
    scheme: "file"
};

export const triggerCharacters: string[] = [">", "n"];

export class I18NCompletionItemProvider implements CompletionItemProvider {

    i18nProperties: I18NPropertiesFile;
    mainI18nFileUri: vscode.Uri;

    readonly TRIGGER_PREFIX: string = "i18n>";
    readonly TRIGGER_PREFIX_NO_CHEV: string = "i18n";

    constructor(i18nProperties: I18NPropertiesFile, mainI18nFileUri: vscode.Uri) {
        this.i18nProperties = i18nProperties;
        this.mainI18nFileUri = mainI18nFileUri;
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z0-9>_]+/);
        const wordText = document.getText(wordRange);
        let i18nCompletionItems : vscode.CompletionItem[] = [];

        // removes i18n> prefix from completion items when i18n> was already typed
        let completionItemPrefix = this.TRIGGER_PREFIX;
        if (wordRange && wordText.startsWith(this.TRIGGER_PREFIX)) {
            completionItemPrefix = "";
        }

        if (wordRange && (wordText.startsWith(this.TRIGGER_PREFIX) || wordText.startsWith(this.TRIGGER_PREFIX_NO_CHEV))) {
            let textExists = false;
            // show existing i18n properties
            i18nCompletionItems = this.i18nProperties.getKeys().map((key: string) => {
                let completionItem = new vscode.CompletionItem(completionItemPrefix + key, vscode.CompletionItemKind.Field);
                let keyInfo = this.i18nProperties.get(key);
                completionItem.detail = keyInfo.text;
                completionItem.documentation = this.formatCompletionItemDocumentation(keyInfo);
                // check if input text exists
                textExists = textExists || (completionItemPrefix === "" && key === wordText.slice(5));
                return completionItem;
            });

            // input text is not an existing i18n property --> show template completion item
            if (completionItemPrefix === "" && wordText.length > 7 && vscode.CompletionTriggerKind.Invoke === context.triggerKind && !textExists) {
                let newPropertyName = wordText.slice(5);
                let placeholder = new vscode.CompletionItem(newPropertyName, vscode.CompletionItemKind.Snippet);
                placeholder.detail = "Create i18n property";
                placeholder.documentation = "Opens the main i18n.properties file and copies the name into the clipboard";
                placeholder.command = {
                    command: "ui5i18n.createI18nText",
                    arguments: [this.mainI18nFileUri, newPropertyName],
                    title: ""
                };
                i18nCompletionItems.push(placeholder);
            }
        }
        return i18nCompletionItems;
    }


    private formatCompletionItemDocumentation(keyInfo: i18nValue): string {
        let res = "";
        if (keyInfo.def) {
            res += keyInfo.def.text.trim() + "\n";
            let typeName = I18nTextTypes[keyInfo.def.type];
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

}