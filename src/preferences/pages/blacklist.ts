/**
 * @file Contains the implementation of the blacklist page.
 * Handles creating blacklist entries and binding them to settings.
 */

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {bindPref, getPref, setPref} from '../../utils/settings.js';
import {AppRow, type AppRowClass} from '../widgets/app_row.js';

import type Gtk from 'gi://Gtk';

export const BlacklistPage = GObject.registerClass(
    {
        Template: GLib.uri_resolve_relative(
            import.meta.url,
            'blacklist.ui',
            GLib.UriFlags.NONE,
        ),
        GTypeName: 'PrefsBlacklist',
        InternalChildren: ['blacklistGroup', 'useWhitelist'],
    },
    class extends Adw.PreferencesPage {
        private declare _blacklistGroup: Adw.PreferencesGroup;
        private declare _useWhitelist: Adw.SwitchRow;

        #blacklist = getPref('blacklist');

        constructor() {
            super();

            bindPref(
                'whitelist',
                this._useWhitelist,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );

            for (const title of this.#blacklist) {
                this.addWindow(undefined, title);
            }

            // update page title dynamically
            this._useWhitelist.connect('notify::active', () => {
                this.#updateBlacklistPageTitle();
            });
            this.#updateBlacklistPageTitle();
        }

        /**
         * Dynamically update the title of the blacklist page
         * based on the state of the whitelist switch.
         */
        #updateBlacklistPageTitle() {
            const isWhitelist = this._useWhitelist.get_active();
            const newTitle = isWhitelist
                ? _('Whitelist') // Title when switch is ON
                : _('Blacklist'); // Title when switch is OFF

            this.set_title(newTitle); // changes page Title
            this._blacklistGroup.set_title(newTitle); // changes group Title
        }

        /**
         * Add a new blacklist entry.
         * @param wmClass - The WM_CLASS of the window.
         */
        addWindow(_?: Gtk.Button, wmClass?: string) {
            const row = new AppRow({
                onDelete: row => this.#deleteWindow(row),
                onWindowChange: (_, oldWmClass, newWmClass) =>
                    this.#changeWindow(oldWmClass, newWmClass),
            });
            row.set_subtitle(wmClass ?? '');
            this._blacklistGroup.add(row);
        }

        /**
         * Delete a blacklist entry.
         * @param row - The row to delete.
         */
        #deleteWindow(row: AppRowClass) {
            this.#blacklist.splice(this.#blacklist.indexOf(row.title), 1);
            setPref('blacklist', this.#blacklist);
            this._blacklistGroup.remove(row);
        }

        /**
         * Change the blacklist entry to a different window.
         * @param oldWmClass - Current WM_CLASS of the entry.
         * @param newWmClass - New WM_CLASS of the entry.
         * @returns Whether the entry was changed successfully.
         */
        #changeWindow(oldWmClass: string, newWmClass: string): boolean {
            if (this.#blacklist.includes(newWmClass)) {
                // If the new window is already in the blacklist, show an error.
                const win = this.root as unknown as Adw.PreferencesDialog;
                win.add_toast(
                    new Adw.Toast({
                        title: _(
                            `Can't add ${newWmClass} to the list, because it already there`,
                        ),
                    }),
                );
                return false;
            }

            if (oldWmClass === '') {
                // If the old WM_CLASS is empty, the entry was just created,
                // so we need to just add the new window to the blacklist.
                this.#blacklist.push(newWmClass);
            } else {
                // Otherwise, replace the old window with the new one.
                const oldId = this.#blacklist.indexOf(oldWmClass);
                this.#blacklist.splice(oldId, 1, newWmClass);
            }

            setPref('blacklist', this.#blacklist);

            return true;
        }
    },
);
