/**
 * @file Contains the code for the shadow settings page.
 * It implements the dynamic preview widget that uses GTK CSS Provider to
 * show what the shadow will look like.
 */

import type {BoxShadow} from '../../utils/types.js';

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {boxShadowCss} from '../../utils/box_shadow.js';
import {getPref, setPref} from '../../utils/settings.js';

export const EditShadowPage = GObject.registerClass(
    {
        Template: GLib.uri_resolve_relative(
            import.meta.url,
            'edit-shadow.ui',
            GLib.UriFlags.NONE,
        ),
        GTypeName: 'EditShadowPage',
        InternalChildren: [
            'focusedShadowPreview',
            'unfocusedShadowPreview',
            'previewRow',

            'focusedHorizontalOffset',
            'focusedVerticalOffset',
            'focusedBlurRadius',
            'focusedSpreadRadius',
            'focusedOpacity',

            'unfocusedHorizontalOffset',
            'unfocusedVerticalOffset',
            'unfocusedBlurRadius',
            'unfocusedSpreadRadius',
            'unfocusedOpacity',
        ],
    },
    class extends Adw.NavigationPage {
        private declare _focusedShadowPreview: Gtk.Widget;
        private declare _unfocusedShadowPreview: Gtk.Widget;
        private declare _previewRow: Gtk.Widget;

        private declare _focusedHorizontalOffset: Gtk.Adjustment;
        private declare _focusedVerticalOffset: Gtk.Adjustment;
        private declare _focusedBlurRadius: Gtk.Adjustment;
        private declare _focusedSpreadRadius: Gtk.Adjustment;
        private declare _focusedOpacity: Gtk.Adjustment;

        private declare _unfocusedHorizontalOffset: Gtk.Adjustment;
        private declare _unfocusedVerticalOffset: Gtk.Adjustment;
        private declare _unfocusedBlurRadius: Gtk.Adjustment;
        private declare _unfocusedSpreadRadius: Gtk.Adjustment;
        private declare _unfocusedOpacity: Gtk.Adjustment;

        // CSS Providers allow to dynamically apply a CSS style string to
        // the preview widgets.
        #unfocusCssProvider = new Gtk.CssProvider();
        #focusCssProvider = new Gtk.CssProvider();
        #backgroundCssProvider = new Gtk.CssProvider();

        #focusedShadowSettings = getPref('focused-shadow');
        #unfocusedShadowSettings = getPref('unfocused-shadow');

        #isInitialized = false;

        constructor() {
            super();

            // Update the desktop wallpaper in the preview when switching
            // between light and dark mode, since the wallpaper can change
            // when that happens.
            const styleManager = new Adw.StyleManager();
            styleManager.connect('notify::dark', manager => {
                this.#refreshWallpaper(manager);
            });

            // Initialize the styles of preview widgets.
            this._focusedShadowPreview
                .get_style_context()
                .add_provider(
                    this.#focusCssProvider,
                    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
                );
            this._unfocusedShadowPreview
                .get_style_context()
                .add_provider(
                    this.#unfocusCssProvider,
                    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
                );
            this._previewRow
                .get_style_context()
                .add_provider(
                    this.#backgroundCssProvider,
                    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
                );

            this.#refreshWallpaper(styleManager);
            this.#syncWidgetState();
            this.#updatePreviewStyle();
            this.#isInitialized = true;
        }

        onValueChanged() {
            if (!this.#isInitialized) {
                return;
            }
            this.#setPrefs();
            this.#updatePreviewStyle();
        }

        /** Synchronize the widget state with actual setting values. */
        #syncWidgetState() {
            this._focusedHorizontalOffset.set_value(
                this.#focusedShadowSettings.horizontalOffset,
            );
            this._focusedVerticalOffset.set_value(
                this.#focusedShadowSettings.verticalOffset,
            );
            this._focusedBlurRadius.set_value(
                this.#focusedShadowSettings.blurOffset,
            );
            this._focusedSpreadRadius.set_value(
                this.#focusedShadowSettings.spreadRadius,
            );
            this._focusedOpacity.set_value(this.#focusedShadowSettings.opacity);

            this._unfocusedHorizontalOffset.set_value(
                this.#unfocusedShadowSettings.horizontalOffset,
            );
            this._unfocusedVerticalOffset.set_value(
                this.#unfocusedShadowSettings.verticalOffset,
            );
            this._unfocusedBlurRadius.set_value(
                this.#unfocusedShadowSettings.blurOffset,
            );
            this._unfocusedSpreadRadius.set_value(
                this.#unfocusedShadowSettings.spreadRadius,
            );
            this._unfocusedOpacity.set_value(
                this.#unfocusedShadowSettings.opacity,
            );
        }

        /** Update the desktop wallpaper in the preview. */
        #refreshWallpaper(manager: Adw.StyleManager) {
            const backgrounds = Gio.Settings.new(
                'org.gnome.desktop.background',
            );
            const path = manager.get_dark()
                ? backgrounds.get_string('picture-uri-dark')
                : backgrounds.get_string('picture-uri');
            this.#backgroundCssProvider.load_from_string(`.desktop-background {
                background: url("${path}");
                background-size: cover; 
            }`);
        }

        /** Update the CSS style of preview widgets to match shadow settings. */
        #updatePreviewStyle() {
            this.#unfocusCssProvider.load_from_string(
                `.preview {
                   transition: box-shadow 200ms;
                   ${boxShadowCss(this.#unfocusedShadowSettings)};
                   border-radius: 12px;
                 }
                 .preview:hover {
                   ${boxShadowCss(this.#focusedShadowSettings)};
                 }`,
            );
            this.#focusCssProvider.load_from_string(
                `.preview {
                   transition: box-shadow 200ms;
                   ${boxShadowCss(this.#focusedShadowSettings)};
                   border-radius: 12px;
                 }
                 .preview:hover {
                   ${boxShadowCss(this.#unfocusedShadowSettings)};
                 }`,
            );
        }

        /** Update extension preferences based on widget state. */
        #setPrefs() {
            const focusedShadow: BoxShadow = {
                verticalOffset: this._focusedVerticalOffset.get_value(),
                horizontalOffset: this._focusedHorizontalOffset.get_value(),
                blurOffset: this._focusedBlurRadius.get_value(),
                spreadRadius: this._focusedSpreadRadius.get_value(),
                opacity: this._focusedOpacity.get_value(),
            };
            this.#focusedShadowSettings = focusedShadow;
            const unfocusedShadow: BoxShadow = {
                verticalOffset: this._unfocusedVerticalOffset.get_value(),
                horizontalOffset: this._unfocusedHorizontalOffset.get_value(),
                blurOffset: this._unfocusedBlurRadius.get_value(),
                spreadRadius: this._unfocusedSpreadRadius.get_value(),
                opacity: this._unfocusedOpacity.get_value(),
            };
            this.#unfocusedShadowSettings = unfocusedShadow;

            setPref('unfocused-shadow', this.#unfocusedShadowSettings);
            setPref('focused-shadow', this.#focusedShadowSettings);
        }
    },
);
