'use babel';

import YamlHelperView from './yaml-helper-view';
import { CompositeDisposable } from 'atom';

export default {

  yamlHelperView: null,
  panel: null,
  subscriptions: null,

  activate(state) {
    this.yamlHelperView = new YamlHelperView(state.yamlHelperViewState, {
      handleEditorCancel: this.handleEditorCancel
    });
    this.panel = atom.workspace.addRightPanel({
      item: this.yamlHelperView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register commands
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'yaml-helper:show': () => this.show(),
      'yaml-helper:hide': () => this.hide()
    }));

    // this.subscriptions.add(atom.commands.add(this.panel, {
    //   'core:cancel': (e) => this.handleEditorCancel(e),
    //   'core:close': (e) => this.handleEditorCancel(e)
    // }));
  },

  deactivate() {
    this.panel.destroy();
    this.subscriptions.dispose();
    this.yamlHelperView.destroy();
  },

  serialize() {
    return {
      yamlHelperViewState: this.yamlHelperView.serialize()
    };
  },

  show() {
    this.panel.show();
    this.yamlHelperView.onShow();
  },

  hide() {
    this.panel.hide();
  }
};
