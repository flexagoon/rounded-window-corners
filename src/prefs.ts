/** @file Contains the implementation of the preferences page. */

import type Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {prefsTabs} from './preferences/index.js';
import {logDebug, logError} from './utils/log.js';
import {initPrefs, uninitPrefs} from './utils/settings.js';

export default class RoundedWindowCornersRebornPrefs extends ExtensionPreferences {
    async fillPreferencesWindow(win: Adw.PreferencesWindow) {
        try {
            const settings = this.getSettings();
            console.log(`[Rounded Window Corners] `, settings);

            initPrefs(settings);

            for (const page of prefsTabs) {
                win.add(new page());
            }

        // Disconnect all signals when closing the preferences
        win.connect('close-request', () => {
            logDebug('Disconnect Signals');
            uninitPrefs();
        });

            this.#loadCss();
        } catch (err) {
            console.error(`[Rounded Window Corners] `, err);
        }
        
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
