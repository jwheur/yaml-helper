'use babel';
export function getTextEditorGrammarName(textEditor) {
  let grammar = undefined;
  let grammerName = undefined;
  if(textEditor && textEditor.getGrammar) {
    grammar = textEditor.getGrammar();
  }
  if(grammar) {
    if(grammar.scopeName) {
      grammerName = grammar.scopeName;
    }
    if(grammar.name) {
      grammerName = grammar.name;
    }
  }
  return grammerName;
}

export function forEachYmlPath(textEditor, callback) {
    const lineCount = textEditor.getLineCount();

    let indentSize = 2;
    for(let i = 0; i < lineCount; i++) {
      const lineText = textEditor.lineTextForBufferRow(i);
      const spaceCount = lineText.search(/\S|$/);
      if(spaceCount > 0) {
        indentSize = spaceCount;
        break;
      }
    }

    let currentPath = [];
    let prevSpaceCount = 0;
    let prevKey = undefined;
    let waitForSingleQuote = false;
    let waitForDoubleQuote = false;
    for(let i = 0; i < lineCount; i++) {
      const lineText = textEditor.lineTextForBufferRow(i);
      const spaceCount = lineText.search(/\S|$/);
      const separatorIndex = lineText.indexOf(':');
      const lastNonWhiteSpaceChar = lineText.trim().substr(-1);

      if(waitForSingleQuote && lastNonWhiteSpaceChar === "'") {
        waitForSingleQuote = false;
        continue;
      }
      if(waitForDoubleQuote && lastNonWhiteSpaceChar === '"') {
        waitForDoubleQuote = false;
        continue;
      }
      if(waitForSingleQuote || waitForDoubleQuote) {
        continue;
      }

      // check for yml key
      let hasYmlKey = false;
      if(separatorIndex === lineText.length - 1) {
        hasYmlKey = true;
      }
      // check that the character after the separator is a space
      if(lineText.length > separatorIndex + 1 && lineText[separatorIndex + 1] === ' ') {
        hasYmlKey = true;
      }
      if(separatorIndex === -1) {
        hasYmlKey = false;
      }
      if(!hasYmlKey) {
        continue;
      }

      let ymlValue = lineText.substring(separatorIndex + 1);
      // check for unescaped quotes
      if(ymlValue.indexOf("'") === 1 && lastNonWhiteSpaceChar !== "'") {
        waitForSingleQuote = true;
      }
      if(ymlValue.indexOf('"') === 1 && lastNonWhiteSpaceChar !== '"') {
        waitForDoubleQuote = true;
      }

      const key = lineText.substring(spaceCount, separatorIndex);
      if(key.length === 0) {
        continue;
      }
      if(spaceCount > prevSpaceCount + indentSize) {
        continue;
      }
      if(spaceCount > prevSpaceCount) {
        currentPath.push(prevKey);
      }
      if(spaceCount < prevSpaceCount) {
        const timesToPop = (prevSpaceCount - spaceCount) / indentSize;
        for(let j = 0; j < timesToPop; j++) {
          currentPath.pop();
        }
      }
      let path = key;
      if(currentPath.length > 0) {
        path = currentPath.join('.') + '.' + key;
      }
      const shouldContinue = callback(path, i);
      if(shouldContinue === false) {
        break;
      }
      prevKey = key;
      prevSpaceCount = spaceCount
    }
  }
