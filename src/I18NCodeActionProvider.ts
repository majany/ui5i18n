import * as vscode from 'vscode';
import { CodeActionProvider } from 'vscode';
import { I18NPropertiesFile } from "i18nparser";
import { I18NDiagnosticType } from './I18NDiagnosticsProvider';
import { computeRecommendedLength } from './RecLengthCalculator';


/**
 * Provides CompletionItems for UI5 I18N texts.
 * CompletionItems are triggered with the keyword "i18n>" 
 */
export class I18NCodeActionProvider implements CodeActionProvider {


    private i18nProperties: I18NPropertiesFile;
    private i18nDiagCollection: vscode.DiagnosticCollection;

    constructor(collection: vscode.DiagnosticCollection, i18nProperties : I18NPropertiesFile) {
        this.i18nDiagCollection = collection;
        this.i18nProperties = i18nProperties;
    }

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        if(!range.isSingleLine){
            return;
        }
        const fileName = document.fileName;
        const i18nDiagnostics = this.i18nDiagCollection.get(document.uri);
        if(i18nDiagnostics){
            const diag = i18nDiagnostics.filter( diag => diag.code === I18NDiagnosticType.underRecLength && range.contains(diag.range));
            if(diag.length > 0){
                const diagLine = diag[0].range.start.line;
                const i18nCommentDefLine = this.i18nProperties.getLine(fileName,diagLine);
                const i18nKeyDefLine = this.i18nProperties.getLine(fileName, diagLine);
                if(i18nCommentDefLine && i18nKeyDefLine){
                    const recLength = computeRecommendedLength(i18nKeyDefLine.text as string);
                    const fix = this.createFix(document, recLength, range, diag[0].range);
                    if(fix){
                        return [fix];
                    }
                }
            }
        }
    }
    createFix(document: vscode.TextDocument, recLength: number, range: vscode.Range | vscode.Selection, diagRange: vscode.Range) : vscode.CodeAction | null {
        const fix = new vscode.CodeAction(`Adjust to recommended length ${recLength}`, vscode.CodeActionKind.QuickFix);
        fix.edit = new vscode.WorkspaceEdit();
        
        const lineOfRange = document.lineAt(range.start.line);
        const defPart = lineOfRange.text.split(":")[0];
        const match = /\d+/.exec(defPart);

        if(!match){
            return null;
        }

        const start = new vscode.Position(range.start.line, match.index);
        const end =  new vscode.Position(range.start.line, match.index + match[0].length);

		fix.edit.replace(document.uri, new vscode.Range(start, end), recLength.toString());
		return fix;
    }
}