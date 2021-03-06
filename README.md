# YAML Helper

## Search for an item by its YAML path

Default shortcut: `cmd-y`

![YAML path search](http://oi63.tinypic.com/s13jgm.jpg)

`cmd-y` toggles the search pane.
When this shortcut is invoked, the YAML search pane will be shown.

If the search pane is already shown but the search input is not focused, the search input will be focused.

If the search input is already focused, this shortcut will hide the search pane.

## View your cursor's current YAML path in the status bar

Default shortcut: `cmd-shift-y`

![YAML status bar](http://oi67.tinypic.com/2jcsmci.jpg)

## Shortcuts

```
'atom-workspace':
  'cmd-y': 'yaml-helper:toggle'
  'cmd-alt-y': 'yaml-helper:hide'
  'cmd-shift-y': 'yaml-helper:toggle-status-bar'
```

Similar to all other atom packages, you can customize the shortcuts using your keymap file.
