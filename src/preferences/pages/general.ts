import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import type Gtk from 'gi://Gtk';

import {connections} from '../../utils/connections.js';
import {settings} from '../../utils/settings.js';
import {EditShadowPage} from '../widgets/edit_shadow_page.js';
import type {PaddingsRowClass} from '../widgets/paddings_row.js';
import {ResetPage} from '../widgets/reset_page.js';
import '../widgets/paddings_row.js';

import {uri} from '../../utils/io.js';
import type {RoundedCornersCfg} from '../../utils/types.js';

export const General = GObject.registerClass(
    {
        Template: uri(import.meta.url, 'general.ui'),
        GTypeName: 'PrefsGeneral',
        InternalChildren: [
            'skip_libadwaita',
            'skip_libhandy',
            'border_width',
            'border_color',
            'unfocused_border_color',
            'corner_radius',
            'corner_smoothing',
            'keep_for_maximized',
            'keep_for_fullscreen',
            'paddings',
            'tweak_kitty',
            'right_click_menu',
            'enable_log',
        ],
    },
    class extends Adw.PreferencesPage {
        private declare _skip_libadwaita: Adw.SwitchRow;
        private declare _skip_libhandy: Adw.SwitchRow;
        private declare _border_width: Gtk.Adjustment;
        private declare _border_color: Gtk.ColorDialogButton;
        private declare _unfocused_border_color: Gtk.ColorDialogButton;
        private declare _corner_radius: Gtk.Adjustment;
        private declare _corner_smoothing: Gtk.Adjustment;
        private declare _keep_for_maximized: Adw.SwitchRow;
        private declare _keep_for_fullscreen: Adw.SwitchRow;
        private declare _paddings: PaddingsRowClass;
        private declare _tweak_kitty: Adw.SwitchRow;
        private declare _right_click_menu: Adw.SwitchRow;
        private declare _enable_log: Adw.SwitchRow;

        private declare _cfg: RoundedCornersCfg;

        constructor() {
            super();

            this._cfg = settings().global_rounded_corner_settings;
            const c = connections.get();

            settings().bind(
                'skip-libadwaita-app',
                this._skip_libadwaita,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );
            settings().bind(
                'skip-libhandy-app',
                this._skip_libhandy,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );

            settings().bind(
                'border-width',
                this._border_width,
                'value',
                Gio.SettingsBindFlags.DEFAULT,
            );

            const color = new Gdk.RGBA();
            [color.red, color.green, color.blue, color.alpha] =
                settings().border_color;
            this._border_color.set_rgba(color);
            c.connect(
                this._border_color,
                'notify::rgba',
                (btn: Gtk.ColorDialogButton) => {
                    const color = btn.get_rgba();
                    settings().border_color = [
                        color.red,
                        color.green,
                        color.blue,
                        color.alpha,
                    ];
                },
            );
            const u_color = new Gdk.RGBA();
            [color.red, color.green, color.blue, color.alpha] =
                settings().unfocused_border_color;
            this._unfocused_border_color.set_rgba(color);
            c.connect(
                this._unfocused_border_color,
                'notify::rgba',
                (btn: Gtk.ColorDialogButton) => {
                    const u_color = btn.get_rgba();
                    settings().unfocused_border_color = [
                        u_color.red,
                        u_color.green,
                        u_color.blue,
                        u_color.alpha,
                    ];
                },
            );

            this._corner_radius.set_value(this._cfg.border_radius);
            c.connect(
                this._corner_radius,
                'value-changed',
                (adj: Gtk.Adjustment) => {
                    this._cfg.border_radius = adj.get_value();
                    this._update_global_config();
                },
            );

            this._corner_smoothing.set_value(this._cfg.smoothing);
            c.connect(
                this._corner_smoothing,
                'value-changed',
                (adj: Gtk.Adjustment) => {
                    this._cfg.smoothing = adj.get_value();
                    this._update_global_config();
                },
            );

            this._keep_for_maximized.set_active(
                this._cfg.keep_rounded_corners.maximized,
            );
            c.connect(
                this._keep_for_maximized,
                'notify::active',
                (swtch: Adw.SwitchRow) => {
                    this._cfg.keep_rounded_corners.maximized =
                        swtch.get_active();
                    this._update_global_config();
                },
            );

            this._keep_for_fullscreen.set_active(
                this._cfg.keep_rounded_corners.fullscreen,
            );
            c.connect(
                this._keep_for_fullscreen,
                'notify::active',
                (swtch: Adw.SwitchRow) => {
                    this._cfg.keep_rounded_corners.fullscreen =
                        swtch.get_active();
                    this._update_global_config();
                },
            );

            this._paddings.paddingTop = this._cfg.padding.top;
            c.connect(
                this._paddings,
                'notify::padding-top',
                (row: PaddingsRowClass) => {
                    this._cfg.padding.top = row.paddingTop;
                    this._update_global_config();
                },
            );

            this._paddings.paddingBottom = this._cfg.padding.bottom;
            c.connect(
                this._paddings,
                'notify::padding-bottom',
                (row: PaddingsRowClass) => {
                    this._cfg.padding.bottom = row.paddingBottom;
                    this._update_global_config();
                },
            );

            this._paddings.paddingStart = this._cfg.padding.left;
            c.connect(
                this._paddings,
                'notify::padding-start',
                (row: PaddingsRowClass) => {
                    this._cfg.padding.left = row.paddingStart;
                    this._update_global_config();
                },
            );

            this._paddings.paddingEnd = this._cfg.padding.right;
            c.connect(
                this._paddings,
                'notify::padding-end',
                (row: PaddingsRowClass) => {
                    this._cfg.padding.right = row.paddingEnd;
                    this._update_global_config();
                },
            );

            settings().bind(
                'tweak-kitty-terminal',
                this._tweak_kitty,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );

            settings().bind(
                'enable-preferences-entry',
                this._right_click_menu,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );

            settings().bind(
                'debug-mode',
                this._enable_log,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );
        }

        show_reset_page(_: Gtk.Button) {
            const root = this.root as unknown as Adw.PreferencesDialog;
            root.push_subpage(new ResetPage());
        }

        show_shadow_page(_: Adw.ActionRow) {
            const root = this.root as unknown as Adw.PreferencesDialog;
            root.push_subpage(new EditShadowPage());
        }

        private _update_global_config() {
            settings().global_rounded_corner_settings = this._cfg;
        }
    },
);
