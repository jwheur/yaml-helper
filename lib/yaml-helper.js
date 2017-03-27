'use babel';

import YamlHelperView from './yaml-helper-view';
import YamlStatusView from './yaml-status-view';
import { CompositeDisposable } from 'atom';

export default {

  yamlHelperView: null,
  panel: null,
  subscriptions: null,

  activate(state) {
    this.yamlStatusView = new YamlStatusView(state.yamlHelperViewState, {});
    this.yamlHelperView = new YamlHelperView(state.yamlHelperViewState, {
      handleEditorCancel: this.handleEditorCancel
    });
    this.panel = atom.workspace.addRightPanel({
      item: this.yamlHelperView.getElement(),
      visible: false
    });
    this.yamlHelperView.props.panel = this.panel;

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register commands
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'yaml-helper:toggle': () => this.toggle(),
      'yaml-helper:show': () => this.show(),
      'yaml-helper:hide': () => this.hide(),
      'yaml-helper:toggle-status-bar': () => this.toggleStatusBar()
    }));
  },

  deactivate() {
    this.panel.destroy();
    this.subscriptions.dispose();
    this.yamlHelperView.destroy();
    this.yamlStatusView.destroy();
    if(this.statusBarTile) {
      this.statusBarTile.destroy();
    }
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

  toggle() {
    if(this.yamlHelperView.queryEditorHasFocus()) {
      this.hide();
      return;
    }
    this.show();
  },

  hide() {
    this.panel.hide();
    atom.views.getView(atom.workspace).focus();
  },

  consumeStatusBar(statusBar) {
    this.statusBar = statusBar
  },

  toggleStatusBar() {
    if(this.statusBarTile) {
      this.statusBarTile.destroy();
      this.statusBarTile = undefined;
      this.yamlStatusView.props.parent = undefined;
      return;
    }
    this.statusBarTile = this.statusBar.addLeftTile({item: this.yamlStatusView});
    this.yamlStatusView.props.parent = this.statusBarTile;
    this.yamlStatusView.updateStatusInfoLabel();
  }
};
