'use babel';
const {Disposable, CompositeDisposable, TextEditor} = require('atom');
const etch = require('etch');
const $ = etch.dom;
const fs = require('fs-plus');
const {score} = require('fuzzaldrin');

export default class YamlHelperView {

  constructor(serializedState, props) {
    this.props = props;
    this.selectedIndex = 0;
    this.results = [];
    this.resultItems = [];
    etch.initialize(this);
    this.handleEvents();

    this.activeItemSubscription = atom.workspace.onDidChangeActivePaneItem(()=> {
      this.updateFileInfoLabel();
      this.performSearch();
    });
    this.updateFileInfoLabel();

    this.disposables = new CompositeDisposable();
    this.disposables.add(this.registerAtomCommands());
  }

  refreshSelectedItem = ()=> {
    const resultItems = this.refs.resultsList.children;
    for(let i = 0; i < resultItems.length; i++) {
      const resultItem = resultItems[i];
      if(i === this.selectedIndex) {
        resultItem.classList.add('selected');
      } else {
        resultItem.classList.remove('selected');
      }
    }
  }

  selectNext = ()=> {
    if(this.selectedIndex >= this.results.length - 1) {
      return;
    }
    this.selectedIndex++;
    this.refreshSelectedItem();
  }

  selectPrevious = ()=> {
    if(this.selectedIndex <= 0) {
      return;
    }
    this.selectedIndex--;
    this.refreshSelectedItem();
  }

  handleEditorCancel = (e)=> {
    console.log('handle editor cancel');
    if(this.props.handleEditorCancel) {
      this.props.handleEditorCancel(e);
    }
    e.stopPropagation();
  }

  registerAtomCommands () {
    console.log('register commands');
    return global.atom.commands.add(this.element, {
      'core:move-up': (e) => {
        this.selectPrevious();
        e.stopPropagation()
      },
      'core:move-down': (e) => {
        this.selectNext();
        e.stopPropagation()
      },
      'core:confirm': (e) => {
        this.confirm();
        e.stopPropagation()
      }
    });
  }

  confirm = ()=> {
    const selectedIndex = this.selectedIndex;
    if(selectedIndex < 0 || selectedIndex > this.results.length - 1) {
      return;
    }
    const result = this.results[selectedIndex];
    this.goToResult(result);
  }

  onShow = ()=> {
    const queryEditor = this.refs.queryEditor;
    queryEditor.element.focus();
    queryEditor.selectAll();
  }

  resizeStarted = ()=> {
    document.addEventListener('mousemove', this.resizeYamlHelper)
    document.addEventListener('mouseup', this.resizeStopped)
  }

  resizeStopped = ()=> {
    document.removeEventListener('mousemove', this.resizeYamlHelper)
    document.removeEventListener('mouseup', this.resizeStopped)
  }

  resizeYamlHelper = ({pageX, which})=> {
    if(which !== 1) {
      return this.resizeStopped();
    }

    width = this.element.offsetWidth + this.element.getBoundingClientRect().left - pageX
    this.element.style.width = width + 'px';
  }

  render = ()=> {
    return (
    $.div({tabIndex: -1, className: 'yaml-helper'},
      $.header({className: 'header'},
        $.div({ref: 'fileInfoLabel', className: 'header-item file-info'},
          'Find in file'
        )
      ),
      $.section({className: 'input-block find-container'},
        $.div({className: 'input-block-item input-block-item--flex editor-container'},
          $(TextEditor, {
            ref: 'queryEditor',
            mini: true,
            placeholderText: 'Fuzzy search for path'
          })
        )
      ),
      $.section({className: 'results-block'},
        $.div({className: 'select-list'},
          $.ol({className: 'results-list list-group', ref: 'resultsList'})
        )
      ),
      $.div({className: 'yaml-helper-resize-handle', ref: 'resizeHandle'})
    ));
  }

  performSearch = ()=> {
    this.results = []
    const query = this.getQuery();

    if(query.length === 0) {
      this.updateResultsList();
      return;
    }
    const grammerName = this.getActiveTextEditorGrammarName();
    if(grammerName != 'YAML') {
      this.updateResultsList();
      return;
    }

    this.results = this.getQueryResults();
    this.updateResultsList();
    this.selectedIndex = 0;
    this.refreshSelectedItem();
  }

  updateResultsList = ()=> {
    const results = this.results;
    const resultsList = this.refs.resultsList;
    resultsList.innerHTML = '';
    if(results.length === 0) {
      resultsList.innerHTML = '<li>No matches found</li>';
      return;
    }
    for(let i = 0; i < results.length; i++) {
      const result = results[i];
      const resultItem = document.createElement('li');
      resultItem.classList.add('result-item')
      const lineNumberElement = document.createElement('span');
      lineNumberElement.classList.add('line-number');
      lineNumberElement.classList.add('text-subtle');
      lineNumberElement.textContent = result.lineIndex + 1;
      resultItem.appendChild(lineNumberElement);
      const previewElement = document.createElement('span');
      lineNumberElement.classList.add('preview');
      previewElement.textContent = result.path;
      resultItem.appendChild(previewElement);

      resultItem.addEventListener('click', ()=> {
        this.selectedIndex = i;
        this.refreshSelectedItem();
        this.goToResult(result);
      });
      resultsList.appendChild(resultItem);
    }
  }

  goToResult = (result)=> {
      const activeTextEditor = this.getActiveTextEditor();
      const lineText = activeTextEditor.lineTextForBufferRow(result.lineIndex);
      const separatorIndex = lineText.indexOf(':');
      let xPosition = 0;
      if(separatorIndex !== -1) {
        xPosition = separatorIndex + 1;
      }
      activeTextEditor.setCursorBufferPosition([result.lineIndex, xPosition]);
      const workspaceElement = atom.views.getView(atom.workspace);
      workspaceElement.focus();
  }

  getQueryResults = ()=> {
    const query = this.getQuery();
    const activeTextEditor = this.getActiveTextEditor();
    const lineCount = activeTextEditor.getLineCount();
    if(!activeTextEditor || activeTextEditor.isEmpty()) {
      return [];
    }

    let indentSize = 2;
    for(let i = 0; i < lineCount; i++) {
      const lineText = activeTextEditor.lineTextForBufferRow(i);
      const spaceCount = lineText.search(/\S|$/);
      if(spaceCount > 0) {
        indentSize = spaceCount;
        break;
      }
    }

    let currentPath = [];
    let prevSpaceCount = 0;
    let prevKey = undefined;
    const results = [];
    const lineScoreTreshold = 0.01;
    for(let i = 0; i < lineCount; i++) {
      const lineText = activeTextEditor.lineTextForBufferRow(i);
      const spaceCount = lineText.search(/\S|$/);
      const separatorIndex = lineText.indexOf(':');
      if(separatorIndex === -1) {
        continue;
      }
      const key = lineText.substring(spaceCount, separatorIndex);
      if(key.length === 0) {
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
      prevSpaceCount = spaceCount;
      prevKey = key;

      let lineScore = score(path, query);
      if(lineScore < lineScoreTreshold) {
        continue;
      }
      results.push({
        lineIndex: i,
        lineScore: lineScore,
        path: path
      });
    }
    results.sort(function(a, b) {
      return b.lineScore - a.lineScore;
    });
    return results;
  }

  getQuery = ()=> {
    const query = this.refs.queryEditor.getText();
    return query.trim();
  }

  getActiveTextEditorGrammarName = ()=> {
    let grammar = undefined;
    let grammerName = undefined;
    if(this.getActiveTextEditor() && this.getActiveTextEditor().getGrammar) {
      grammar = this.getActiveTextEditor().getGrammar();
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

  handleEvents = ()=> {
    this.refs.resizeHandle.addEventListener('mousedown', this.resizeStarted);
    this.refs.queryEditor.onDidStopChanging(this.performSearch);
  }

  updateFileInfoLabel = ()=> {
    this.refs.fileInfoLabel.textContent = `Find in ${this.getCurrentFilePath()}`;
  }

  getCurrentFilePath = ()=> {
    if(this.getActiveItem() && this.getActiveItem().getTitle) {
      return this.getActiveItem().getTitle();
    }
    return 'file';
  }

  getActiveItem = ()=> {
    return atom.workspace.getActivePaneItem();
  }

  getActiveTextEditor = ()=> {
    return atom.workspace.getActiveTextEditor();
  }

  getElement() {
    return this.element;
  }

  update () {}

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
    this.activeItemSubscription.dispose();
    this.disposables.dispose()
  }
}
