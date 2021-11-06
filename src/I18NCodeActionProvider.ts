import * as vscode from 'vscode';
import { CodeActionProvider } from 'vscode';
import { I18NPropertiesFile } from "i18nparser";
import { I18NDiagnosticsProvider, I18NDiagnosticType } from './I18NDiagnosticsProvider';
import { computeRecommendedLength } from './RecLengthCalculator';


/**
 * Provides CompletionItems for UI5 I18N texts.
 * CompletionItems are triggered with the keyword "i18n>" 
 */
export class I18NCodeActionProvider implements CodeActionProvider {

    static DOCUMENT_SELECTOR: vscode.DocumentSelector = [{
        language: "properties",
        scheme: "file",
        pattern: "**/*.properties"
    }];

    static METADATA: vscode.CodeActionProviderMetadata = {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    };

    private i18nProperties: I18NPropertiesFile;
    private i18nDiagCollection: vscode.DiagnosticCollection;

    constructor(collection: vscode.DiagnosticCollection, i18nProperties: I18NPropertiesFile) {
        this.i18nDiagCollection = collection;
        this.i18nProperties = i18nProperties;
    }

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        if (!range.isSingleLine) {
            return;
        }

        const fileName = document.fileName;
        const i18nDiagnostics = this.i18nDiagCollection.get(document.uri);
        const fixes: vscode.CodeAction[] = [];
        if (!i18nDiagnostics) {
            return fixes;
        }

        const findDiagInRange = (code: I18NDiagnosticType): vscode.Diagnostic | null => {
            const underRecLengthDiags = i18nDiagnostics.filter(diag => diag.code === code && diag.range.contains(range));
            return underRecLengthDiags.length === 1 ? underRecLengthDiags[0] : null;
        }

        const underRecLengthDiag = findDiagInRange(I18NDiagnosticType.underRecLength);
        if (underRecLengthDiag) {
            const diagLine = underRecLengthDiag.range.start.line;
            const i18nCommentDefLine = this.i18nProperties.getLine(fileName, diagLine);
            const i18nKeyDefLine = this.i18nProperties.getLine(fileName, diagLine + 1); // line after assignmentdef is always key definition
            if (i18nCommentDefLine && i18nKeyDefLine) {
                const recLength = computeRecommendedLength(i18nKeyDefLine.text as string);
                const fix = this.createUnderRecLengthFix(document, diagLine, recLength);
                if (fix) {
                    fixes.push(fix);
                }
            }
        }

        const singleQuoteDiag = findDiagInRange(I18NDiagnosticType.singleQuoteEscape);
        if (singleQuoteDiag) {
            const diagLine = singleQuoteDiag.range.start.line;
            const i18nKeyDefLine = this.i18nProperties.getLine(fileName, diagLine);
            if (i18nKeyDefLine) {
                fixes.push(this.createFixForSingleQuoteError(document, diagLine))
            }
        }

        return fixes;
    }

    createFixForSingleQuoteError(document: vscode.TextDocument, diagLine: number): vscode.CodeAction {
        const fix = new vscode.CodeAction("Escape single quotes", vscode.CodeActionKind.QuickFix);
        fix.edit = new vscode.WorkspaceEdit();
        const diagLineContent = document.lineAt(diagLine);
        const matchAllSingleQuotes = new RegExp(I18NDiagnosticsProvider.singleQuoteNotEscaped, "g");
        const regexpResultMatches = [...diagLineContent.text.matchAll(matchAllSingleQuotes)];
        regexpResultMatches.forEach(match => {
            if (match.index) {
                fix.edit?.insert(document.uri, new vscode.Position(diagLine, match.index + 1), "'");
            }
        });

        return fix;
    }

    createUnderRecLengthFix(document: vscode.TextDocument, diagLine: number, recLength: number): vscode.CodeAction | null {
        const fix = new vscode.CodeAction(`Adjust to recommended length ${recLength}`, vscode.CodeActionKind.QuickFix);
        fix.edit = new vscode.WorkspaceEdit();

        const lineOfRange = document.lineAt(diagLine);
        const defPart = lineOfRange.text.split(":")[0];
        const match = /\d+/.exec(defPart);

        if (!match) {
            return null;
        }

        const start = new vscode.Position(diagLine, match.index);
        const end = new vscode.Position(diagLine, match.index + match[0].length);

        fix.edit.replace(document.uri, new vscode.Range(start, end), recLength.toString());
        return fix;
    }
}