/**
 * @file Contains the implementation of the reset page.
 * The list of prefs that can be reset is stored in the `#resetPrefs` variable,
 * and the UI is automatically generated from that.
 */

import type Gtk from 'gi://Gtk';
import type {RoundedCornerSettings} from '../../utils/types.js';

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    getPref,
    prefs,
    Schema,
    type SchemaKey,
    setPref,
} from '../../utils/settings.js';

type RoundedCorerSettingsKey = keyof RoundedCornerSettings;
type ResetKey = SchemaKey | RoundedCorerSettingsKey;

export const ResetPage = GObject.registerClass(
    {
        Template: GLib.uri_resolve_relative(
            import.meta.url,
            'reset.ui',
            GLib.UriFlags.NONE,
        ),
        GTypeName: 'ResetPage',
        InternalChildren: ['resetGroup', 'resetButton', 'dialog'],
    },
    class extends Adw.NavigationPage {
        private declare _resetGroup: Adw.PreferencesGroup;
        private declare _resetButton: Gtk.Button;
        private declare _dialog: Adw.AlertDialog;

        // Store all switches in a list to enable the "select all" button.
        #rows: Adw.SwitchRow[] = [];

        // List of prefs that should be reset.
        #resetPrefs: ResetKey[] = [];

        // Map prefs to their labels in the UI.
        #resetLabels: {[Key in ResetKey]?: string} = {
            'skip-libadwaita-app': 'Skip LibAdwaita Applications',
            'skip-libhandy-app': 'Skip LibHandy Applications',
            'focused-shadow': 'Focus Window Shadow Style',
            'unfocused-shadow': 'Unfocus Window Shadow Style',
            'border-width': 'Border Width',
            'debug-mode': 'Enable Log',

            borderRadius: 'Border Radius',
            borderColor: 'Border Color',
            padding: 'Padding',
            keepRoundedCorners:
                'Keep Rounded Corners when Maximized or Fullscreen',
            smoothing: 'Corner Smoothing',
        };

        constructor() {
            super();

            this.#buildUi();
        }

        selectAll() {
            for (const row of this.#rows) {
                row.set_active(true);
            }
        }

        askForReset() {
            this._dialog.choose(this, null, null);
        }

        reset(_: Adw.MessageDialog, response: string) {
            if (response === 'cancel') {
                return;
            }

            const defaultRoundedCornerSettings = prefs
                .get_default_value('global-rounded-corner-settings')
                ?.recursiveUnpack() as RoundedCornerSettings;

            const currentRoundedCornerSettings = getPref(
                'global-rounded-corner-settings',
            );

            for (const key of this.#resetPrefs) {
                if (key in Schema) {
                    // If the key is a top-level prefs schema key, reset it directly.
                    prefs.reset(key);
                } else {
                    // Otherwise, it's a key inside of `global-rounded-corner-settings`,
                    // and should be reset accordingly.
                    const settingsKey = key as RoundedCorerSettingsKey;
                    currentRoundedCornerSettings[settingsKey] =
                        defaultRoundedCornerSettings[settingsKey] as never;
                }
            }

            setPref(
                'global-rounded-corner-settings',
                currentRoundedCornerSettings,
            );

            const root = this.root as unknown as Adw.PreferencesDialog;
            root.pop_subpage();
        }

        /** Generate the UI from {@link #resetLabels}. */
        #buildUi() {
            for (const [key, label] of Object.entries(this.#resetLabels)) {
                const row = new Adw.SwitchRow({
                    active: false,
                    name: key,
                    title: _(label),
                });
                row.connect('notify::active', source =>
                    this.#onToggled(source),
                );
                this._resetGroup.add(row);
                this.#rows.push(row);
            }
        }

        /** Callback to add or remove a pref from the list of prefs to reset. */
        #onToggled(source: Adw.SwitchRow): void {
            if (source.active) {
                this.#resetPrefs.push(source.name as ResetKey);
            } else {
                this.#resetPrefs = this.#resetPrefs.filter(
                    k => k !== (source.name as ResetKey),
                );
            }
        }
    },
);
