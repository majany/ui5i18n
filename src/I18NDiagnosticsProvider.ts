import * as vscode from 'vscode';
import { I18NPropertiesFile, I18nValue, ResultLine } from 'i18nparser';
import { computeRecommendedLength } from "./RecLengthCalculator";

const source = "ui5i18n"

export enum I18NDiagnosticType {
    "underRecLength",
    "parserError",
    "duplicateKey",
    "missingDef",
    "faultyDef",
    "singleQuoteEscape",
    "others"
}

export class I18NDiagnosticsProvider {

    private i18nFileProperties: I18NPropertiesFile;

    public static singleQuoteNotEscaped : RegExp = /[^']'[^']/;
    private containsVariable : RegExp = /[^\\]{\d*}/;   

    constructor(i18nFileProperties: I18NPropertiesFile) {
        this.i18nFileProperties = i18nFileProperties;
    }

    getI18nFileProperties() {
        return this.i18nFileProperties;
    }


    getDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
        var i18nFilePaths = this.i18nFileProperties.getContainedFiles();
        if (!(uri && i18nFilePaths.some(i18nFilePath => i18nFilePath === uri.fsPath))) {
            return [];
        }

        let diagArray: vscode.Diagnostic[] = [];
        this.i18nFileProperties.getKeys().forEach(sKey => {
            const i18nValue = this.i18nFileProperties.get(sKey);

            // only provide diagnostics for requested uri
            if (i18nValue.fileName !== uri.fsPath) {
                return;
            }

            if (i18nValue.duplicateOf) {
                diagArray.push(this.createDuplicateEntryError(i18nValue, uri));
                return;
            }

            if (i18nValue.def) {
                let recommendedLength = computeRecommendedLength(i18nValue.text);
                if (typeof i18nValue.def.length === 'number' && i18nValue.def.length < recommendedLength) {
                    diagArray.push(this.createLengthTooSmallWarning(i18nValue, sKey, recommendedLength));
                }
            } else {
                diagArray.push(this.createMissingDefError(i18nValue, sKey, uri));
            }

            if(I18NDiagnosticsProvider.singleQuoteNotEscaped.test(i18nValue.text) && this.containsVariable.test(i18nValue.text)){
                const singleQuoteOffsetInText = I18NDiagnosticsProvider.singleQuoteNotEscaped.exec(i18nValue.text)?.index ?? 0;
                const singleQuoteOffsetInLine = sKey.length + 2 + singleQuoteOffsetInText;
                diagArray.push({
                    message: sKey + " has a variables but does not escape single quotes",
                    severity: vscode.DiagnosticSeverity.Error,
                    source,
                    code: I18NDiagnosticType.singleQuoteEscape,
                    range: new vscode.Range(new vscode.Position(i18nValue.line, singleQuoteOffsetInLine), new vscode.Position(i18nValue.line, singleQuoteOffsetInLine + 1)),                    
                });
            }

        });

        const errorLines = this.i18nFileProperties.getErrorLines(uri.fsPath) || [];
        errorLines.forEach(line => {
            if (line && line.error) {
                diagArray.push(this.createParserError(line));
            }
        });
        return diagArray;
    }

    private createParserError(line: ResultLine) : vscode.Diagnostic {
        if(!line?.error){
            throw new Error("No parser error found");
        }
        return {
            code: I18NDiagnosticType.parserError,
            source,
            severity: vscode.DiagnosticSeverity.Error,
            message: line.error.message,
            range: new vscode.Range(new vscode.Position(line.line as number, line.error.offset), new vscode.Position(line.line as number, line.error.offset)),
        };
    }

    private createMissingDefError(i18nValue: I18nValue, sKey: string, uri: vscode.Uri): vscode.Diagnostic {
        if (i18nValue.defError) {
            let erroneousDefLine = i18nValue.line - 1;
            let errorRange = new vscode.Range(new vscode.Position(erroneousDefLine, i18nValue.defError.offset), new vscode.Position(erroneousDefLine, i18nValue.defError.offset + 1));
            return {
                code: I18NDiagnosticType.faultyDef,
                message: sKey + " has faulty type definition",
                range: errorRange,
                severity: vscode.DiagnosticSeverity.Error,
                source,
                relatedInformation: [
                    new vscode.DiagnosticRelatedInformation(new vscode.Location(uri, errorRange), i18nValue.defError.message)
                ]
            };
        } else {
            return {
                code: I18NDiagnosticType.missingDef,
                message: sKey + " is missing type definition",
                range: new vscode.Range(new vscode.Position(i18nValue.line, 0), new vscode.Position(i18nValue.line, sKey.length)),
                severity: vscode.DiagnosticSeverity.Error,
                source
            };
        }
    }

    private createLengthTooSmallWarning(i18nKey: I18nValue, sKey: string, recommendedLength: number): vscode.Diagnostic {
        const defLine = i18nKey.line - 1;
        return {
            code: I18NDiagnosticType.underRecLength,
            message: sKey + " length definition should be at least " + recommendedLength,
            range: new vscode.Range(new vscode.Position(defLine, 0), new vscode.Position(defLine, 9)),
            severity: vscode.DiagnosticSeverity.Warning,
            source
        };
    }

    private createDuplicateEntryError(i18nKey: I18nValue, uri: vscode.Uri): vscode.Diagnostic {
        if (!i18nKey.duplicateOf) {
            throw new Error("No duplicate for this entry!");
        }

        const original = this.i18nFileProperties.get(i18nKey.duplicateOf);
        return {
            code: I18NDiagnosticType.duplicateKey,
            message: i18nKey.duplicateOf + " is already defined",
            range: new vscode.Range(new vscode.Position(i18nKey.line, 0), new vscode.Position(i18nKey.line, i18nKey.duplicateOf.length)),
            severity: vscode.DiagnosticSeverity.Error,
            source,
            relatedInformation: [
                new vscode.DiagnosticRelatedInformation(new vscode.Location(
                    uri, new vscode.Range(
                        new vscode.Position(original.line, 0),
                        new vscode.Position(original.line, i18nKey.duplicateOf.length)
                    )
                ),
                    'first definition of ' + i18nKey.duplicateOf)
            ]
        };
    }
}