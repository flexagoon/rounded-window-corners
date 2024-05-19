import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {settings} from '../../utils/settings.js';
import {box_shadow_css} from '../../utils/types.js';

import {uri} from '../../utils/io.js';
import type {BoxShadow} from '../../utils/types.js';

export const EditShadowPage = GObject.registerClass(
    {
        Template: uri(import.meta.url, 'edit-shadow-page.ui'),
        GTypeName: 'EditShadowPage',
        InternalChildren: [
            'focused_shadow_preview',
            'unfocused_shadow_preview',
            'preview_row',

            'focused_horizontal_offset',
            'focused_vertical_offset',
            'focused_blur_radius',
            'focused_spread_radius',
            'focused_opacity',

            'unfocused_horizontal_offset',
            'unfocused_vertical_offset',
            'unfocused_blur_radius',
            'unfocused_spread_radius',
            'unfocused_opacity',
        ],
    },
    class extends Adw.NavigationPage {
        private declare _focused_shadow_preview: Gtk.Widget;
        private declare _unfocused_shadow_preview: Gtk.Widget;
        private declare _preview_row: Gtk.Widget;
        private declare _focused_horizontal_offset: Gtk.Adjustment;
        private declare _focused_vertical_offset: Gtk.Adjustment;
        private declare _focused_blur_radius: Gtk.Adjustment;
        private declare _focused_spread_radius: Gtk.Adjustment;
        private declare _focused_opacity: Gtk.Adjustment;
        private declare _unfocused_horizontal_offset: Gtk.Adjustment;
        private declare _unfocused_vertical_offset: Gtk.Adjustment;
        private declare _unfocused_blur_radius: Gtk.Adjustment;
        private declare _unfocused_spread_radius: Gtk.Adjustment;
        private declare _unfocused_opacity: Gtk.Adjustment;

        // CssProvider to change style of preview widgets in edit window
        private declare unfocus_provider: Gtk.CssProvider;
        private declare focus_provider: Gtk.CssProvider;
        private declare backgroud_provider: Gtk.CssProvider;

        // Load box-shadow from settings
        private declare focused_shadow: BoxShadow;
        private declare unfocused_shadow: BoxShadow;

        private declare is_initialized: boolean;

        constructor() {
            super();

            this.is_initialized = false;

            this.unfocus_provider = new Gtk.CssProvider();
            this.focus_provider = new Gtk.CssProvider();
            this.backgroud_provider = new Gtk.CssProvider();
            this.focused_shadow = settings().focused_shadow;
            this.unfocused_shadow = settings().unfocused_shadow;

            const style_manager = new Adw.StyleManager();
            style_manager.connect('notify::dark', manager => {
                this.update_background(manager);
            });

            // Init style of preview widgets
            this._focused_shadow_preview
                .get_style_context()
                .add_provider(
                    this.focus_provider,
                    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
                );
            this._unfocused_shadow_preview
                .get_style_context()
                .add_provider(
                    this.unfocus_provider,
                    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
                );

            this._preview_row
                .get_style_context()
                .add_provider(
                    this.backgroud_provider,
                    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
                );

            // Init value controls from settings
            this.update_background(style_manager);
            this.update_widget();
            this.update_style();
            this.is_initialized = true;
        }

        private update_widget() {
            this._focused_horizontal_offset.set_value(
                this.focused_shadow.horizontal_offset,
            );
            this._focused_vertical_offset.set_value(
                this.focused_shadow.vertical_offset,
            );
            this._focused_blur_radius.set_value(
                this.focused_shadow.blur_offset,
            );
            this._focused_spread_radius.set_value(
                this.focused_shadow.spread_radius,
            );
            this._focused_opacity.set_value(this.focused_shadow.opacity);

            this._unfocused_horizontal_offset.set_value(
                this.unfocused_shadow.horizontal_offset,
            );
            this._unfocused_vertical_offset.set_value(
                this.unfocused_shadow.vertical_offset,
            );
            this._unfocused_blur_radius.set_value(
                this.unfocused_shadow.blur_offset,
            );
            this._unfocused_spread_radius.set_value(
                this.unfocused_shadow.spread_radius,
            );
            this._unfocused_opacity.set_value(this.unfocused_shadow.opacity);
        }

        private update_cfg() {
            const focused_shadow: BoxShadow = {
                vertical_offset: this._focused_vertical_offset.get_value(),
                horizontal_offset: this._focused_horizontal_offset.get_value(),
                blur_offset: this._focused_blur_radius.get_value(),
                spread_radius: this._focused_spread_radius.get_value(),
                opacity: this._focused_opacity.get_value(),
            };
            this.focused_shadow = focused_shadow;
            const unfocused_shadow: BoxShadow = {
                vertical_offset: this._unfocused_vertical_offset.get_value(),
                horizontal_offset:
                    this._unfocused_horizontal_offset.get_value(),
                blur_offset: this._unfocused_blur_radius.get_value(),
                spread_radius: this._unfocused_spread_radius.get_value(),
                opacity: this._unfocused_opacity.get_value(),
            };
            this.unfocused_shadow = unfocused_shadow;

            // Store into settings
            settings().unfocused_shadow = this.unfocused_shadow;
            settings().focused_shadow = this.focused_shadow;
        }

        private update_style() {
            const gen_style = (normal: BoxShadow, hover: BoxShadow) =>
                `.preview {
           transition: box-shadow 200ms;
           ${box_shadow_css(normal)};
           border-radius: 12px;
         }
         .preview:hover {
           ${box_shadow_css(hover)};
         }`;

            type A = Gtk.CssProvider & {
                load_from_string: (s: string) => void;
            };
            (this.unfocus_provider as A).load_from_string(
                gen_style(this.unfocused_shadow, this.focused_shadow),
            );
            (this.focus_provider as A).load_from_string(
                gen_style(this.focused_shadow, this.unfocused_shadow),
            );
        }

        private update_background(manager: Adw.StyleManager) {
            let path = '';
            const backgrounds = Gio.Settings.new(
                'org.gnome.desktop.background',
            );
            switch (manager.get_dark()) {
                case true:
                    path = backgrounds.get_string('picture-uri-dark');
                    break;
                case false:
                    path = backgrounds.get_string('picture-uri');
                    break;
            }
            this.backgroud_provider.load_from_string(`.desktop-background {
                background: url("${path}");
                background-size: cover; 
            }`);
        }

        // signal handles

        on_value_changed() {
            if (!this.is_initialized) {
                return;
            }
            this.update_cfg();
            this.update_style();
        }
    },
);
