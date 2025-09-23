/**
 * @file Contains the implementation of the custom overrides page.
 * Handles creating override rows and binding them to settings for the corresponding
 * window.
 */

import type Gtk from 'gi://Gtk';
import type {AppRowCallbacks, AppRowClass} from '../widgets/app_row.js';
import type {PaddingsRowClass} from '../widgets/paddings_row.js';

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {getPref, setPref} from '../../utils/settings.js';
import {
    CustomSettingsRow,
    CustomSettingsRowClass,
} from '../widgets/custom_settings_row.js';

export const CustomPage = GObject.registerClass(
    {
        Template: GLib.uri_resolve_relative(
            import.meta.url,
            'custom.ui',
            GLib.UriFlags.NONE,
        ),
        GTypeName: 'PrefsCustom',
        InternalChildren: ['customGroup'],
    },
    class extends Adw.PreferencesPage {
        private declare _customGroup: Adw.PreferencesGroup;

        #customWindowSettings = getPref('custom-rounded-corner-settings');

        constructor() {
            super();

            for (const wmClass in this.#customWindowSettings) {
                this.addWindow(undefined, wmClass);
            }
        }

        /**
         * Add a new custom settings row for a window.
         * @param wmClass - The WM_CLASS of the window.
         */
        addWindow(_?: Gtk.Button, wmClass?: string) {
            const callbacks: AppRowCallbacks = {
                onDelete: row => this.#deleteWindowConfig(row),
                onWindowChange: (row, oldTitle, newTitle) =>
                    this.#changeWindow(row, oldTitle, newTitle),
            };

            const row = new CustomSettingsRow(callbacks);
            if (wmClass) {
                this.#bindRowSettings(row, wmClass);
            }
            row.set_subtitle(wmClass ?? '');
            this._customGroup.add(row);
        }

        /**
         * Delete custom overrides for a window.
         * @param row - The row to delete.
         */
        #deleteWindowConfig(row: AppRowClass) {
            delete this.#customWindowSettings[row.subtitle];
            setPref(
                'custom-rounded-corner-settings',
                this.#customWindowSettings,
            );
            this._customGroup.remove(row);
        }

        /**
         * Change the window that the override is applied to.
         * @param row - The row with the override to change.
         * @param oldWmClass - Current WM_CLASS of the override.
         * @param newWmClass - New WM_CLASS of the override.
         * @returns Whether the override was changed successfully.
         */
        #changeWindow(
            row: AppRowClass,
            oldWmClass: string,
            newWmClass: string,
        ): boolean {
            // If overrides for the new window already exist, show an error.
            if (this.#customWindowSettings[newWmClass] !== undefined) {
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
                // If the old WM_CLASS is empty, the override was just created,
                // so we need to initialize it with the values from global settings.
                this.#customWindowSettings[newWmClass] = getPref(
                    'global-rounded-corner-settings',
                );
            } else {
                // Otherwise, move the override to the new window.
                const cfg = this.#customWindowSettings[oldWmClass];
                delete this.#customWindowSettings[oldWmClass];
                this.#customWindowSettings[newWmClass] = cfg;
            }

            this.#bindRowSettings(row, newWmClass);

            setPref(
                'custom-rounded-corner-settings',
                this.#customWindowSettings,
            );

            return true;
        }

        /**
         * Bind widgets of the override row to the respective settings.
         * @param row - The row to bind.
         * @param wmClass - WM_CLASS of the window that the override is applied to.
         */
        #bindRowSettings(row: AppRowClass, wmClass: string) {
            if (!(row instanceof CustomSettingsRowClass)) {
                return;
            }
            const r = row as CustomSettingsRowClass;

            r.connect('notify::subtitle', (row: CustomSettingsRowClass) => {
                row.checkState();
            });
            r.enabledRow.set_active(
                this.#customWindowSettings[wmClass].enabled,
            );
            r.enabledRow.connect('notify::active', (row: Adw.SwitchRow) => {
                r.checkState();
                this.#customWindowSettings[wmClass].enabled = row.get_active();
                setPref(
                    'custom-rounded-corner-settings',
                    this.#customWindowSettings,
                );
            });

            const color = new Gdk.RGBA();
            [color.red, color.green, color.blue, color.alpha] =
                this.#customWindowSettings[wmClass].borderColor;

            r.borderColorButton.set_rgba(color);
            r.borderColorButton.connect(
                'notify::rgba',
                (_button: Gtk.ColorDialogButton) => {
                    const color = r.borderColorButton.get_rgba();
                    this.#customWindowSettings[wmClass].borderColor = [
                        color.red,
                        color.green,
                        color.blue,
                        color.alpha,
                    ];
                    setPref(
                        'custom-rounded-corner-settings',
                        this.#customWindowSettings,
                    );
                },
            );

            r.cornerRadius.set_value(
                this.#customWindowSettings[wmClass].borderRadius,
            );
            r.cornerRadius.connect('value-changed', (adj: Gtk.Adjustment) => {
                this.#customWindowSettings[wmClass].borderRadius =
                    adj.get_value();
                setPref(
                    'custom-rounded-corner-settings',
                    this.#customWindowSettings,
                );
            });
            r.cornerSmoothing.set_value(
                this.#customWindowSettings[wmClass].smoothing,
            );
            r.cornerSmoothing.connect(
                'value-changed',
                (adj: Gtk.Adjustment) => {
                    this.#customWindowSettings[wmClass].smoothing =
                        adj.get_value();
                    setPref(
                        'custom-rounded-corner-settings',
                        this.#customWindowSettings,
                    );
                },
            );
            r.keepForMaximized.set_active(
                this.#customWindowSettings[wmClass].keepRoundedCorners
                    .maximized,
            );
            r.keepForMaximized.connect(
                'notify::active',
                (row: Adw.SwitchRow) => {
                    this.#customWindowSettings[
                        wmClass
                    ].keepRoundedCorners.maximized = row.get_active();
                    setPref(
                        'custom-rounded-corner-settings',
                        this.#customWindowSettings,
                    );
                },
            );
            r.keepForFullscreen.set_active(
                this.#customWindowSettings[wmClass].keepRoundedCorners
                    .fullscreen,
            );
            r.keepForFullscreen.connect(
                'notify::active',
                (row: Adw.SwitchRow) => {
                    this.#customWindowSettings[
                        wmClass
                    ].keepRoundedCorners.fullscreen = row.get_active();
                    setPref(
                        'custom-rounded-corner-settings',
                        this.#customWindowSettings,
                    );
                },
            );
            r.paddings.paddingTop =
                this.#customWindowSettings[wmClass].padding.top;
            r.paddings.connect(
                'notify::padding-top',
                (row: PaddingsRowClass) => {
                    this.#customWindowSettings[wmClass].padding.top =
                        row.paddingTop;
                    setPref(
                        'custom-rounded-corner-settings',
                        this.#customWindowSettings,
                    );
                },
            );
            r.paddings.paddingBottom =
                this.#customWindowSettings[wmClass].padding.bottom;
            r.paddings.connect(
                'notify::padding-bottom',
                (row: PaddingsRowClass) => {
                    this.#customWindowSettings[wmClass].padding.bottom =
                        row.paddingBottom;
                    setPref(
                        'custom-rounded-corner-settings',
                        this.#customWindowSettings,
                    );
                },
            );
            r.paddings.paddingStart =
                this.#customWindowSettings[wmClass].padding.left;
            r.paddings.connect(
                'notify::padding-start',
                (row: PaddingsRowClass) => {
                    this.#customWindowSettings[wmClass].padding.left =
                        row.paddingStart;
                    setPref(
                        'custom-rounded-corner-settings',
                        this.#customWindowSettings,
                    );
                },
            );
            r.paddings.paddingEnd =
                this.#customWindowSettings[wmClass].padding.right;
            r.paddings.connect(
                'notify::padding-end',
                (row: PaddingsRowClass) => {
                    this.#customWindowSettings[wmClass].padding.right =
                        row.paddingEnd;
                    setPref(
                        'custom-rounded-corner-settings',
                        this.#customWindowSettings,
                    );
                },
            );
        }
    },
);
