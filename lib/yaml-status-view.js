'use babel';
const {CompositeDisposable} = require('atom');
const etch = require('etch');
const $ = etch.dom;
const {getTextEditorGrammarName, forEachYmlPath} = require('./utility');

export default class YamlStatusView {

  constructor(serializedState, props) {
    this.props = props;
    etch.initialize(this);
    this.setStatusText('--');
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.workspace.onDidChangeActivePaneItem(()=> {
      this.registerTextEditorSubscriptions();
    }));
    this.registerTextEditorSubscriptions();
  }

  copyPath(path) {
    atom.clipboard.write(path);
    const notification = atom.notifications.addSuccess('Copied ' + path, { dismissable: true })
    setTimeout(function() {
      notification.dismiss()
    }, 1000)
  }

  registerTextEditorSubscriptions = ()=> {
    const activeTextEditor = this.getActiveTextEditor()
    if(!activeTextEditor) {
      return;
    }
    this.updateStatusInfoLabel();
    if(this.activeEditorChangeSubscription) {
      this.activeEditorChangeSubscription.dispose();
    }
    this.activeEditorChangeSubscription = activeTextEditor.onDidStopChanging(()=> {
      this.updateStatusInfoLabel();
    });
    if(this.activeEditorCursorChangeSubscription) {
      this.activeEditorChangeSubscription.dispose();
    }
    this.activeEditorCursorChangeSubscription = activeTextEditor.onDidChangeCursorPosition(()=> {
      this.updateStatusInfoLabel();
    });
    this.refs.copyLabel.addEventListener('click', (e) => {
      this.copyPath(this.getCurrentCursorYmlPath())
    });
  }

  render = ()=> {
    return (
    $.div({tabIndex: -1, className: 'yaml-helper-status-view inline-block'},
      $.div({className: 'yaml-status-info-label', ref: 'statusInfoLabel'}),
      $.div({className: 'yaml-status-copy-label', ref: 'copyLabel'}, '[copy]')
    ));
  }

  updateStatusInfoLabel = ()=> {
    if(!this.props.parent) {
      return;
    }
    const grammerName = getTextEditorGrammarName(this.getActiveTextEditor());
    if(grammerName != 'YAML') {
      this.setStatusText('--');
      return;
    }

    this.setStatusText(this.getCurrentCursorYmlPath());
  }

  getCurrentCursorYmlPath = ()=> {
    const activeTextEditor = this.getActiveTextEditor();
    if(!activeTextEditor || activeTextEditor.isEmpty()) {
      return '--';
    }
    const lineCount = activeTextEditor.getLineCount();
    const cursorRow = activeTextEditor.getCursorBufferPosition().row;
    let cursorPath = '--';
    let prevPath = '--';
    forEachYmlPath(activeTextEditor, (path, i)=> {
      if(i < cursorRow) {
        prevPath = path;
        return;
      }
      cursorPath = path;
      if(i > cursorRow) {
        cursorPath = prevPath;
      }
      return false;
    });
    return cursorPath;
  }

  setStatusText = (text)=> {
    this.refs.statusInfoLabel.textContent = text;
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
    this.subscriptions.dispose();
    this.disposables.dispose()
  }
}
