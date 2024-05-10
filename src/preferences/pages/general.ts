// imports.gi
import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

// local modules
import {connections} from '../../utils/connections.js';
import {list_children} from '../../utils/prefs.js';
import {settings} from '../../utils/settings.js';
import type {SchemasKeys} from '../../utils/settings.js';
import {EditShadowWindow} from '../widgets/edit_shadow_window.js';
import {ResetPage} from '../widgets/reset_page.js';
import {RoundedCornersItem} from '../widgets/rounded_corners_item.js';

// types
import Gtk from 'gi://Gtk';
import {uri} from '../../utils/io.js';

// --------------------------------------------------------------- [end imports]

export const General = GObject.registerClass(
    {
        Template: uri(import.meta.url, 'general.ui'),
        GTypeName: 'RoundedWindowCornersPrefsGeneral',

        // Widgets export from template ui
        InternalChildren: [
            'global_settings_preferences_group',
            'enable_log_switch',
            'skip_libadwaita_app_switch',
            'skip_libhandy_app_switch',
            'tweak_kitty_switch',
            'preferences_entry_switch',
            'border_width_ajustment',
            'border_color_button',
            'edit_shadow_row',
            'applications_group',
            'reset_preferences_btn',
        ],
    },
    class extends Gtk.Box {
        private declare _global_settings_preferences_group: Gtk.ListBox;
        private declare _enable_log_switch: Gtk.Switch;
        private declare _skip_libhandy_app_switch: Gtk.Switch;
        private declare _skip_libadwaita_app_switch: Gtk.Switch;
        private declare _tweak_kitty_switch: Gtk.Switch;
        private declare _preferences_entry_switch: Gtk.Switch;
        private declare _border_width_ajustment: Gtk.Adjustment;
        private declare _border_color_button: Gtk.ColorButton;
        private declare _edit_shadow_row: Gtk.ListBoxRow;
        private declare _applications_group: Gtk.ListBox;
        private declare _reset_preferences_btn: Gtk.Button;

        private config_items!: _Items;

        _init() {
            super._init();

            this.config_items = new RoundedCornersItem();

            this.build_ui();

            connections
                .get()
                .connect(
                    settings().g_settings,
                    'changed',
                    (_settings: Gio.Settings, key: string) =>
                        this._on_settings_changed(key),
                );

            settings().bind(
                'debug-mode',
                this._enable_log_switch,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );
            settings().bind(
                'tweak-kitty-terminal',
                this._tweak_kitty_switch,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );
            settings().bind(
                'enable-preferences-entry',
                this._preferences_entry_switch,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );
            settings().bind(
                'skip-libadwaita-app',
                this._skip_libadwaita_app_switch,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );
            settings().bind(
                'skip-libhandy-app',
                this._skip_libhandy_app_switch,
                'active',
                Gio.SettingsBindFlags.DEFAULT,
            );
            settings().bind(
                'border-width',
                this._border_width_ajustment,
                'value',
                Gio.SettingsBindFlags.DEFAULT,
            );

            const color = new Gdk.RGBA();
            [color.red, color.green, color.blue, color.alpha] =
                settings().border_color;
            this._border_color_button.set_rgba(color);

            const c = connections.get();
            c.connect(
                this._border_color_button,
                'color-set',
                (btn: Gtk.ColorButton) => {
                    const color = btn.get_rgba();
                    settings().border_color = [
                        color.red,
                        color.green,
                        color.blue,
                        color.alpha,
                    ];
                },
            );

            // Handler active event for BoxList
            c.connect(
                this._global_settings_preferences_group,
                'row-activated',
                (_box: Gtk.ListBox, row: Gtk.ListBoxRow) => {
                    if (row === this.config_items._paddings_row) {
                        this.config_items.update_revealer();
                    }
                },
            );

            c.connect(
                this._applications_group,
                'row-activated',
                (_box: Gtk.ListBox, row: Gtk.ListBoxRow) => {
                    if (row === this._edit_shadow_row) {
                        this._show_edit_shadow_window_cb();
                    }
                },
            );

            c.connect(this._reset_preferences_btn, 'clicked', () => {
                const root = this.root as unknown as Adw.PreferencesDialog;
                root.push_subpage(new ResetPage());
            });
        }

        private build_ui() {
            for (const item of list_children(this.config_items)) {
                this.config_items.remove(item);
                this._global_settings_preferences_group.append(item);
            }
            // Bind Variants
            this.config_items.cfg = settings().global_rounded_corner_settings;
            this.config_items.watch(cfg => {
                settings().global_rounded_corner_settings = cfg;
            });
        }

        // ---------------------------------------------------- [signal handler]

        /** Called when click 'Window Shadow' action row */
        _show_edit_shadow_window_cb() {
            const root = this.root as Gtk.Window;
            const win = new EditShadowWindow();
            win.application = root.application;
            win.present();
            root.hide();
            win.connect('close-request', () => {
                root.show();
                win.destroy();
            });
        }

        /** Update UI when settings changed  */
        private _on_settings_changed(key: string) {
            switch (key as SchemasKeys) {
                case 'border-color':
                    {
                        const color = new Gdk.RGBA();
                        [color.red, color.green, color.blue, color.alpha] =
                            settings().border_color;
                        this._border_color_button.set_rgba(color);
                    }
                    break;
                case 'border-width':
                    this._border_width_ajustment.value =
                        settings().border_width;
                    break;
                case 'global-rounded-corner-settings':
                    this.config_items.cfg =
                        settings().global_rounded_corner_settings;
                    break;
                default:
            }
        }
    },
);

type _Items = InstanceType<typeof RoundedCornersItem>;
