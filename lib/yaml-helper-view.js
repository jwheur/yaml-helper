'use babel';
const {CompositeDisposable, TextEditor} = require('atom');
const etch = require('etch');
const $ = etch.dom;
const fs = require('fs-plus');
const {score} = require('fuzzaldrin');
const {getTextEditorGrammarName, forEachYmlPath} = require('./utility');

export default class YamlHelperView {

  constructor(serializedState, props) {
    this.props = props;
    this.selectedIndex = 0;
    this.results = [];
    this.resultItems = [];
    etch.initialize(this);
    this.handleEvents();
    this.resultsTextEditorRef = undefined;

    this.activeItemSubscription = atom.workspace.onDidChangeActivePaneItem(()=> {
      this.updateFileInfoLabel();
      if(this.props.panel && this.props.panel.isVisible()) {
        this.performSearch();
      }
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

  queryEditorHasFocus = ()=> {
    return this.refs.queryEditor.element.hasFocus();
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

  registerAtomCommands () {
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
    const activeTextEditor = this.getActiveTextEditor()
    const grammerName = getTextEditorGrammarName(this.getActiveTextEditor());
    if(grammerName != 'YAML') {
      if(this.queryEditorHasFocus()) {
        this.setInfoLabelText('Active file is not a YAML file')
      }
      return;
    }
    this.resultsTextEditorRef = activeTextEditor
    if(this.getQuery().length === 0) {
      this.results = []
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
      const resultItem = this.createResultItem(result, i);
      resultsList.appendChild(resultItem);
    }
  }

  copyPath(path) {
    atom.clipboard.write(path);
    const notification = atom.notifications.addSuccess('Copied ' + path, { dismissable: true })
    setTimeout(function() {
      notification.dismiss()
    }, 1000)
  }

  createResultItem = (result, index)=> {
    const resultItem = document.createElement('li');
    resultItem.classList.add('result-item');

    const resultContent = document.createElement('span');
    resultContent.classList.add('result-content')
    resultItem.appendChild(resultContent);

    const lineNumberElement = document.createElement('span');
    lineNumberElement.classList.add('line-number');
    lineNumberElement.classList.add('text-subtle');
    lineNumberElement.textContent = result.lineIndex + 1;
    resultContent.appendChild(lineNumberElement);

    const previewElement = document.createElement('span');
    previewElement.classList.add('preview');
    previewElement.textContent = result.path;
    resultContent.appendChild(previewElement);

    const copyButtonElement = document.createElement('span');
    copyButtonElement.classList.add('copy-button');
    copyButtonElement.textContent = '[copy]';
    copyButtonElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyPath(result.path)
    });
    resultItem.appendChild(copyButtonElement);

    resultItem.addEventListener('click', ()=> {
      this.selectedIndex = index;
      this.refreshSelectedItem();
      this.goToResult(result);
    });
    return resultItem;
  }

  goToResult = (result)=> {
      const textEditor = this.resultsTextEditorRef
      if(!textEditor) {
        return;
      }
      const lineText = textEditor.lineTextForBufferRow(result.lineIndex);
      if(!lineText) {
        return;
      }
      const separatorIndex = lineText.indexOf(':');
      let xPosition = 0;
      if(separatorIndex !== -1) {
        xPosition = separatorIndex + 1;
      }
      textEditor.setCursorBufferPosition([result.lineIndex, xPosition]);
      const workspaceElement = atom.views.getView(textEditor);
      workspaceElement.focus();
  }

  getQueryResults = ()=> {
    const query = this.getQuery();
    const activeTextEditor = this.getActiveTextEditor();
    if(!activeTextEditor || activeTextEditor.isEmpty() || query.length == 0) {
      return [];
    }

    const lineCount = activeTextEditor.getLineCount();
    const results = [];
    const lineScoreTreshold = 0.01;
    forEachYmlPath(activeTextEditor, (path, index)=>{
      let lineScore = score(path, query);
      if(lineScore < lineScoreTreshold) {
        return;
      }
      results.push({
        lineIndex: index,
        lineScore: lineScore,
        path: path
      });
    });
    results.sort(function(a, b) {
      return b.lineScore - a.lineScore;
    });
    return results;
  }

  getQuery = ()=> {
    const query = this.refs.queryEditor.getText();
    return query.trim();
  }

  handleEvents = ()=> {
    this.refs.resizeHandle.addEventListener('mousedown', this.resizeStarted);
    this.refs.queryEditor.onDidStopChanging(this.performSearch);
  }

  updateFileInfoLabel = ()=> {
    this.setInfoLabelText(`Find in ${this.getCurrentFilePath()}`);
  }

  setInfoLabelText = (text)=> {
    this.refs.fileInfoLabel.textContent = text;
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
