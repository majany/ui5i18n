import * as vscode from 'vscode';
import { I18NPropertiesFile } from 'i18nparser';
import { computeRecommendedLength } from "./RecLengthCalculator";

export class I18NDiagnosticsProvider {
    i18nFileProperties: I18NPropertiesFile;


    constructor(i18nFileProperties: I18NPropertiesFile) {
        this.i18nFileProperties = i18nFileProperties;
    }


    getDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
        var i18nFilePaths = this.i18nFileProperties.getContainedFiles();
        if (!(uri && i18nFilePaths.some(i18nFilePath => i18nFilePath === uri.fsPath))) {
            return [];
        }
        let diagArray: vscode.Diagnostic[] = [];
        this.i18nFileProperties.getKeys().forEach(sKey => {
            let i18nKey = this.i18nFileProperties.get(sKey);

            // only provide diagnostics for requested uri
            if (i18nKey.fileName !== uri.fsPath) {
                return;
            }

            if (i18nKey.duplicateOf) {
                const original = this.i18nFileProperties.get(i18nKey.duplicateOf);
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
                let missingDefDiag: vscode.Diagnostic;

                if (i18nKey.defError) {
                    let erroneousDefLine = i18nKey.line - 1;
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

        //get error lines
        let errorLines = this.i18nFileProperties.getErrorLines(uri.fsPath) || [];
        errorLines.forEach(line => {
            if (line && line.error) {
                diagArray.push({
                    code: '',
                    source: 'ui5i18n',
                    severity: vscode.DiagnosticSeverity.Error,
                    message: line.error.message,
                    range: new vscode.Range(new vscode.Position(line.line as number, line.error.offset), new vscode.Position(line.line as number, line.error.offset)),
                } as vscode.Diagnostic);
            }
        });
        return diagArray;
    }
}