import GObject from 'gi://GObject';
import type Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {_log} from '../../utils/log.js';
import {type SchemasKeys, settings} from '../../utils/settings.js';
import type {RoundedCornersCfg} from '../../utils/types.js';

import {uri} from '../../utils/io.js';

class Cfg {
    description: string;
    reset = false;

    constructor(description: string) {
        this.description = description;
    }
}

export const ResetPage = GObject.registerClass(
    {
        Template: uri(import.meta.url, 'reset-page.ui'),
        GTypeName: 'ResetPage',
        InternalChildren: ['reset_grp', 'reset_btn', 'dialog'],
    },
    class extends Adw.NavigationPage {
        private declare _reset_grp: Adw.PreferencesGroup;
        private declare _reset_btn: Gtk.Button;
        private declare _dialog: Adw.AlertDialog;

        /** Keys to reset  */
        private declare _reset_keys: {
            [name in SchemasKeys]?: Cfg;
        };
        /** Global rounded corners settings to reset  */
        private declare _reset_corners_cfg: {
            [name in keyof RoundedCornersCfg]?: Cfg;
        };
        /** Used to select all CheckButtons  */
        private declare _rows: Adw.SwitchRow[];

        constructor() {
            super();

            this._rows = [];
            this._init_cfg();
            this._build_ui();
        }

        private _init_cfg() {
            this._reset_keys = {
                'skip-libadwaita-app': new Cfg(
                    _('Skip LibAdwaita Applications'),
                ),
                'skip-libhandy-app': new Cfg(_('Skip LibHandy Applications')),
                'focused-shadow': new Cfg(_('Focus Window Shadow Style')),
                'unfocused-shadow': new Cfg(_('Unfocus Window Shadow Style')),
                'border-width': new Cfg(_('Border Width')),
                'border-color': new Cfg(_('Border Color')),
                'debug-mode': new Cfg(_('Enable Log')),
            };

            this._reset_corners_cfg = {
                border_radius: new Cfg(_('Border Radius')),
                padding: new Cfg(_('Padding')),
                keep_rounded_corners: new Cfg(
                    _('Keep Rounded Corners when Maximized or Fullscreen'),
                ),
                smoothing: new Cfg(_('Corner Smoothing')),
            };
        }

        private _build_ui() {
            const build = (cfg: {[key: string]: {description: string}}) => {
                for (const key in cfg) {
                    const row = new Adw.SwitchRow({
                        active: false,
                        name: key,
                    });
                    row.set_title(cfg[key].description);
                    row.connect('notify::active', source =>
                        this.on_toggled(source),
                    );
                    this._reset_grp.add(row);
                    this._rows.push(row);
                }
            };

            build(this._reset_corners_cfg);
            build(this._reset_keys);
        }

        private on_toggled(source: Adw.SwitchRow): void {
            const k = source.name;
            let v = this._reset_corners_cfg[k as keyof RoundedCornersCfg];
            if (v !== undefined) {
                v.reset = source.active;
                return;
            }

            v = this._reset_keys[k as SchemasKeys];
            if (v !== undefined) {
                v.reset = source.active;
                return;
            }
        }

        select_all() {
            for (const row of this._rows) {
                row.set_active(true);
            }
        }

        ask_for_reset() {
            // typescript thinks, that there should be 0-2 arguments, but actually
            // it will throw an error, if any of three argument is missing
            // @ts-ignore
            this._dialog.choose(this, null, null);
        }

        reset(_: Adw.MessageDialog, response: string) {
            if (response === 'cancel') {
                return;
            }

            for (const k in this._reset_keys) {
                if (this._reset_keys[k as SchemasKeys]?.reset === true) {
                    settings().g_settings.reset(k);
                    _log(`Reset ${k}`);
                }
            }

            const key: SchemasKeys = 'global-rounded-corner-settings';
            const default_cfg = settings()
                .g_settings.get_default_value(key)
                ?.recursiveUnpack() as RoundedCornersCfg;
            const current_cfg = settings().global_rounded_corner_settings;
            for (const k in this._reset_corners_cfg) {
                const _k = k as keyof RoundedCornersCfg;
                if (this._reset_corners_cfg[_k]?.reset === true) {
                    current_cfg[_k] = default_cfg[_k] as never;
                    _log(`Reset ${k}`);
                }
            }
            settings().global_rounded_corner_settings = current_cfg;

            const root = this.root as unknown as Adw.PreferencesDialog;
            root.pop_subpage();
        }
    },
);
