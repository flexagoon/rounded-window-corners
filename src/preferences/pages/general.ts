/**
 * @file Contains the implementation of the main preferences page.
 * There isn't much logic in this file.
 */

import type Gtk from 'gi://Gtk';
import type {PaddingsRowClass} from '../widgets/paddings_row.js';

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {bindPref, getPref, setPref} from '../../utils/settings.js';
import {EditShadowPage} from './edit_shadow.js';
import {ResetPage} from './reset.js';

export const GeneralPage = GObject.registerClass(
    {
        Template: GLib.uri_resolve_relative(
            import.meta.url,
            'general.ui',
            GLib.UriFlags.NONE,
        ),
        GTypeName: 'PrefsGeneral',

        // Those variables are declared inside of the `general.ui` file and
        // passed into the JS module prefixed with an underscore.
        // (skipLibadwaita -> _skipLibadwaita)
        InternalChildren: [
            'skipLibadwaita',
            'skipLibhandy',
            'borderWidth',
            'borderColor',
            'cornerRadius',
            'cornerSmoothing',
            'keepForMaximized',
            'keepForFullscreen',
            'paddings',
            'tweakKitty',
            'rightClickMenu',
            'enableDebugLogs',
        ],
    },
    class extends Adw.PreferencesPage {
        private declare _skipLibadwaita: Adw.SwitchRow;
        private declare _skipLibhandy: Adw.SwitchRow;
        private declare _borderWidth: Gtk.Adjustment;
        private declare _borderColor: Gtk.ColorDialogButton;
        private declare _cornerRadius: Gtk.Adjustment;
        private declare _cornerSmoothing: Gtk.Adjustment;
        private declare _keepForMaximized: Adw.SwitchRow;
        private declare _keepForFullscreen: Adw.SwitchRow;
        private declare _paddings: PaddingsRowClass;
        private declare _tweakKitty: Adw.SwitchRow;
        private declare _rightClickMenu: Adw.SwitchRow;
        private declare _enableDebugLogs: Adw.SwitchRow;

        #settings = getPref('global-rounded-corner-settings');

        // Bind all buttons to respective prefs.
        constructor() {
            super();

            bindPref(
                'skip-libadwaita-app',
                this._skipLibadwaita,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );
            bindPref(
                'skip-libhandy-app',
                this._skipLibhandy,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );

            bindPref(
                'border-width',
                this._borderWidth,
                'value',
                Gio.SettingsBindFlags.DEFAULT,
            );

            const color = new Gdk.RGBA();
            [color.red, color.green, color.blue, color.alpha] =
                this.#settings.borderColor;
            this._borderColor.set_rgba(color);
            this._borderColor.connect(
                'notify::rgba',
                (button: Gtk.ColorDialogButton) => {
                    const color = button.get_rgba();
                    this.#settings.borderColor = [
                        color.red,
                        color.green,
                        color.blue,
                        color.alpha,
                    ];
                    this.#updateGlobalConfig();
                },
            );

            this._cornerRadius.set_value(this.#settings.borderRadius);
            this._cornerRadius.connect(
                'value-changed',
                (adj: Gtk.Adjustment) => {
                    this.#settings.borderRadius = adj.get_value();
                    this.#updateGlobalConfig();
                },
            );

            this._cornerSmoothing.set_value(this.#settings.smoothing);
            this._cornerSmoothing.connect(
                'value-changed',
                (adj: Gtk.Adjustment) => {
                    this.#settings.smoothing = adj.get_value();
                    this.#updateGlobalConfig();
                },
            );

            this._keepForMaximized.set_active(
                this.#settings.keepRoundedCorners.maximized,
            );
            this._keepForMaximized.connect(
                'notify::active',
                (swtch: Adw.SwitchRow) => {
                    this.#settings.keepRoundedCorners.maximized =
                        swtch.get_active();
                    this.#updateGlobalConfig();
                },
            );

            this._keepForFullscreen.set_active(
                this.#settings.keepRoundedCorners.fullscreen,
            );
            this._keepForFullscreen.connect(
                'notify::active',
                (swtch: Adw.SwitchRow) => {
                    this.#settings.keepRoundedCorners.fullscreen =
                        swtch.get_active();
                    this.#updateGlobalConfig();
                },
            );

            this._paddings.paddingTop = this.#settings.padding.top;
            this._paddings.connect(
                'notify::padding-top',
                (row: PaddingsRowClass) => {
                    this.#settings.padding.top = row.paddingTop;
                    this.#updateGlobalConfig();
                },
            );

            this._paddings.paddingBottom = this.#settings.padding.bottom;
            this._paddings.connect(
                'notify::padding-bottom',
                (row: PaddingsRowClass) => {
                    this.#settings.padding.bottom = row.paddingBottom;
                    this.#updateGlobalConfig();
                },
            );

            this._paddings.paddingStart = this.#settings.padding.left;
            this._paddings.connect(
                'notify::padding-start',
                (row: PaddingsRowClass) => {
                    this.#settings.padding.left = row.paddingStart;
                    this.#updateGlobalConfig();
                },
            );

            this._paddings.paddingEnd = this.#settings.padding.right;
            this._paddings.connect(
                'notify::padding-end',
                (row: PaddingsRowClass) => {
                    this.#settings.padding.right = row.paddingEnd;
                    this.#updateGlobalConfig();
                },
            );

            bindPref(
                'tweak-kitty-terminal',
                this._tweakKitty,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );

            bindPref(
                'enable-preferences-entry',
                this._rightClickMenu,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );

            bindPref(
                'debug-mode',
                this._enableDebugLogs,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );
        }

        showResetPage(_: Gtk.Button) {
            const root = this.root as unknown as Adw.PreferencesDialog;
            root.push_subpage(new ResetPage());
        }

        showShadowPage(_: Adw.ActionRow) {
            const root = this.root as unknown as Adw.PreferencesDialog;
            root.push_subpage(new EditShadowPage());
        }

        #updateGlobalConfig() {
            setPref('global-rounded-corner-settings', this.#settings);
        }
    },
);
