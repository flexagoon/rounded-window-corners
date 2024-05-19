import type Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import type {ExtensionMetadata} from 'resource:///org/gnome/shell/extensions/extension.js';
import {pages} from './preferences/index.js';
import {connections} from './utils/connections.js';
import * as Utils from './utils/io.js';
import {_log} from './utils/log.js';
import {init_settings, uninit_settings} from './utils/settings.js';

export default class RoundedWindowCornresPrefs extends ExtensionPreferences {
    constructor(metadata: ExtensionMetadata) {
        super(metadata);

        // Classical GTK4 template ui need this to make translatable string works
        imports.gettext.textdomain(this.uuid);
        this.initTranslations(this.uuid);
    }

    _load_css() {
        const display = Gdk.Display.get_default();
        if (display) {
            const css = new Gtk.CssProvider();
            const path = Utils.path(import.meta.url, 'stylesheet-prefs.css');
            css.load_from_path(path);
            Gtk.StyleContext.add_provider_for_display(display, css, 0);
        }
    }

    fillPreferencesWindow(win: Adw.PreferencesWindow) {
        init_settings(this.getSettings());

        for (const page of pages()) {
            win.add(page);
        }

        // Disconnect all signal when close prefs
        win.connect('close-request', () => {
            _log('Disconnect Signals');
            connections.get().disconnect_all();
            connections.del();
            uninit_settings();
        });

        this._load_css();
    }
}

declare const imports: {
    gettext: {textdomain: (uuid: string) => void};
};
