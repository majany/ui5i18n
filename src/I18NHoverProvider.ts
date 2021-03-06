import * as vscode from 'vscode';
import { HoverProvider } from "vscode";
import { I18NPropertiesFile, I18nValue } from 'i18nparser';

export class I18NHoverProvider implements HoverProvider {


    static DOCUMENT_SELECTOR : vscode.DocumentSelector = [{
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

    static JSON_WORD_PATTERN = /[A-Za-z0-9_|.]+/;

    i18nProperites: I18NPropertiesFile;

    constructor(i18nProperties : I18NPropertiesFile){
        this.i18nProperites = i18nProperties;
    }

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        let wordRange;
        if(document.languageId === "json"){
            wordRange = document.getWordRangeAtPosition(position, I18NHoverProvider.JSON_WORD_PATTERN);
        } else {
            wordRange = document.getWordRangeAtPosition(position);
        }
        const hoveredWord = document.getText(wordRange);

        const i18nProperty = this.i18nProperites.get(hoveredWord);

        if(i18nProperty){
            const hoverText = this.formatI18nProperty(i18nProperty);
            return new vscode.Hover(hoverText);
        }
    }

    formatI18nProperty(i18nProperty: I18nValue){
        return i18nProperty.text;
    }
    
}