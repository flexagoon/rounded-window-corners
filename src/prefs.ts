/** @file Contains the implementation of the preferences page. */

import type Adw from 'gi://Adw';

import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {prefsTabs} from './preferences/index.js';
import {logDebug} from './utils/log.js';
import {initPrefs, uninitPrefs} from './utils/settings.js';

export default class RoundedWindowCornersRebornPrefs extends ExtensionPreferences {
    async fillPreferencesWindow(win: Adw.PreferencesWindow) {
        initPrefs(this.getSettings());

        for (const page of prefsTabs) {
            win.add(new page());
        }

        // Disconnect all signals when closing the preferences
        win.connect('close-request', () => {
            logDebug('Disconnect Signals');
            uninitPrefs();
        });

        this.#loadCss();
    }

    #loadCss() {
        const display = Gdk.Display.get_default();
        if (display) {
            const css = new Gtk.CssProvider();
            const path = GLib.build_filenamev([
                import.meta.url,
                'stylesheet-prefs.css',
            ]);
            css.load_from_path(path);
            Gtk.StyleContext.add_provider_for_display(display, css, 0);
        }
    }
}
