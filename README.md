# ui5i18n vscode extension

Gives basic support for i18n.properties files in ui5 applications.

## Features

1. Snippets for properties files for every text type supported in ui5 (e.g. XBUT, XTIT, ...)
2. Auto Completion in XML/JS files for i18n properties defined in your project. Type "i18n" to trigger it.
3. Typing a new property name allows to directly jump to the i18n.properties file with the name in the clipboard.
4. Provides Diagnostics when:
    * type definition of i18n key is missing in preceding line
    * defined length is shorter than recommended
    * when a line could not be parsed