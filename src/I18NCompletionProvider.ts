import * as vscode from 'vscode';
import { CompletionItem } from 'vscode';
import { CompletionItemProvider } from 'vscode';
import { I18NPropertiesFile, I18nValue } from "i18nparser";
import { I18nTextTypes } from "./i18nTextTypes";
import { computeRecommendedLength } from "./RecLengthCalculator";


/**
 * Provides CompletionItems for UI5 I18N texts.
 * CompletionItems are triggered with the keyword "i18n>" 
 */
export class I18NCompletionItemProvider implements CompletionItemProvider {

    /**
     * Characters to be used in the registration of the CompletionItemProvider
     */
    static TRIGGER_CHARS: string[] = [">", "n"];
    /**
     * The DocumentSelector to be used in the registration of the CompletionItemProvider
     */
    static DOCUMENT_SELECTOR: vscode.DocumentSelector = [{
        language: "xml",
        pattern: "**/*.xml",
        scheme: "file"
    }, {
        language: "javascript",
        pattern: "**/*.js",
        scheme: "file"
    }, {
        language: "json",
        pattern: "**/*.json",
        scheme: "file"
    }];

    static WORD_PATTERN = /[A-Za-z0-9>_|.]+/;
    static WOR_PATTERN_WITH_COLONS = /[A-Za-z0-9>_|."']+/;
    static WORD_PATTERN_WITHIN_CURLY = /{{\s*[A-Za-z0-9_|.]*\s*}}/;

    private i18nProperties: I18NPropertiesFile;
    private mainI18nFileUri: vscode.Uri;

    private readonly TRIGGER_PREFIX: string = "i18n>";
    private readonly TRIGGER_PREFIX_NO_CHEV: string = "i18n";

    constructor(i18nProperties: I18NPropertiesFile, mainI18nFileUri: vscode.Uri) {
        this.i18nProperties = i18nProperties;
        this.mainI18nFileUri = mainI18nFileUri;
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        let i18nCompletionItems: CompletionItem[] = [];

        const wordRange = document.getWordRangeAtPosition(position, I18NCompletionItemProvider.WORD_PATTERN);
        const wordText = document.getText(wordRange);

        const isJavascriptFile = document.languageId === "javascript";
        const wasInvoked = context.triggerKind === vscode.CompletionTriggerKind.Invoke;
        const isInColons = this.isTextInColons(document, position);
        const isWithTriggerPrefix = wordText.startsWith(this.TRIGGER_PREFIX);
        const isWithTriggerPrefixNoChev = wordText.startsWith(this.TRIGGER_PREFIX_NO_CHEV);
        const isTextInDoubleCurly = this.isTextInDoubleCurly(document, position);

        if (wordRange && (isTextInDoubleCurly || isWithTriggerPrefix || isWithTriggerPrefixNoChev || (wasInvoked && isInColons && isJavascriptFile))) {
            // show existing i18n properties
            let showItemWithTriggerPrefix = !isTextInDoubleCurly && (isInColons && !isWithTriggerPrefixNoChev || isWithTriggerPrefix);
            i18nCompletionItems = this.getCompletionItems(wordText, wasInvoked, isJavascriptFile, showItemWithTriggerPrefix, position, document);
        }
        return i18nCompletionItems;
    }

    private getCompletionItems(wordText: string, showI18nCreateSnippet: boolean, useKeyAsInsertText: boolean, showItemWithTriggerPrefix: boolean, position: vscode.Position, document: vscode.TextDocument): CompletionItem[] {
        const i18nCompletionItems: CompletionItem[] = [];

        const getCompletionItemLabel = (key: string) => { return (showItemWithTriggerPrefix ? (this.TRIGGER_PREFIX + key) : key); };

        this.i18nProperties.getKeys().forEach((key: string) => {
            const keyInfo = this.i18nProperties.get(key);
            if (keyInfo.duplicateOf) {
                // skip if it is duplicate
                return;
            }

            let completionItemLabel = getCompletionItemLabel(key);
            const completionItem = new CompletionItem(completionItemLabel, vscode.CompletionItemKind.Field);
            completionItem.detail = keyInfo.text;
            completionItem.documentation = this.formatCompletionItemDocumentation(keyInfo);
            // check if input text exists
            // completionItem.filterText = "\"{{" + completionItem.label;

            const start = document.getWordRangeAtPosition(position, I18NCompletionItemProvider.WORD_PATTERN);
            // if(start){
            //     completionItem.range = new vscode.Range(start.start, position);
            // }


            if (useKeyAsInsertText) {
                completionItem.insertText = key;
            }
            i18nCompletionItems.push(completionItem);
        });

        const wordTextWithoutPrefix = wordText.startsWith(this.TRIGGER_PREFIX) ? wordText.slice(this.TRIGGER_PREFIX.length) : wordText;
        const textExists = !!this.i18nProperties.get(wordTextWithoutPrefix);

        // input text is not an existing i18n property --> show template completion item
        if (!textExists && showI18nCreateSnippet && wordTextWithoutPrefix.length > 2 && wordTextWithoutPrefix !== "i18n") {
            const placeholder = this.createPlaceHolderCompletionItem(wordTextWithoutPrefix);
            i18nCompletionItems.push(placeholder);
        }
        return i18nCompletionItems;
    }

    private createPlaceHolderCompletionItem(newPropertyName: string): CompletionItem {
        let placeholder = new CompletionItem(newPropertyName, vscode.CompletionItemKind.Snippet);
        placeholder.detail = "Create i18n property";
        placeholder.documentation = "Opens the main i18n.properties file and copies the name into the clipboard";
        placeholder.command = {
            command: "ui5i18n.createI18nText",
            arguments: [this.mainI18nFileUri, newPropertyName],
            title: ""
        };
        return placeholder;
    }


    private formatCompletionItemDocumentation(keyInfo: I18nValue): string {
        let res = "";
        if (keyInfo.def) {
            res += keyInfo.def.text.trim() + "\n";
            let typeName = I18nTextTypes[keyInfo.def.type];
            res += "type:\t" + typeName + " (" + keyInfo.def.type + ")" + "\n";
            if (keyInfo.def.length) {
                res += "length:\t" + keyInfo.text.length + " (max " + keyInfo.def.length + ")";
                if (keyInfo.def.length < computeRecommendedLength(keyInfo.text)) {
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

    private isTextInColons(document: vscode.TextDocument, position: vscode.Position) {
        const wordRangeWithColon = document.getWordRangeAtPosition(position, I18NCompletionItemProvider.WOR_PATTERN_WITH_COLONS);
        const wordTextWithColon = document.getText(wordRangeWithColon);
        const rBeginsOrEndsWithColon = /^['"].*['"]$/;
        return rBeginsOrEndsWithColon.test(wordTextWithColon);
    }

    private isTextInDoubleCurly(document: vscode.TextDocument, position: vscode.Position) {
        const wordRangeWithinCurly = document.getWordRangeAtPosition(position, I18NCompletionItemProvider.WORD_PATTERN_WITHIN_CURLY);
        return wordRangeWithinCurly && !!document.getText(wordRangeWithinCurly);
    }

}