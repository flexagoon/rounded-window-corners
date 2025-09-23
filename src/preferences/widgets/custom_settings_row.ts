/** @file An extension of {@link AppRowClass} that adds widgets for setting config overrides. */

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {PaddingsRow} from './paddings_row.js';
import './app_row.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {type AppRowCallbacks, AppRowClass} from './app_row.js';

export class CustomSettingsRowClass extends AppRowClass {
    enabledRow = new Adw.SwitchRow({
        title: _('Enabled'),
    });

    #borderColorRow = new Adw.ActionRow({
        title: _('Border color'),
    });
    borderColorButton = new Gtk.ColorDialogButton({
        valign: Gtk.Align.CENTER,
    });
    borderColorDialog = new Gtk.ColorDialog();

    #cornerRadiusRow = new Adw.ActionRow({
        title: _('Corner radius'),
    });
    cornerRadius = new Gtk.Adjustment({
        lower: 0,
        upper: 40,
        stepIncrement: 1,
        pageIncrement: 1,
    });

    #cornerSmoothingRow = new Adw.ActionRow({
        title: _('Corner smoothing'),
    });
    cornerSmoothing = new Gtk.Adjustment({
        lower: 0,
        upper: 1,
        stepIncrement: 0.1,
        pageIncrement: 0.1,
    });

    keepForMaximized = new Adw.SwitchRow({
        title: _('Keep rounded corners when maximized'),
        subtitle: _(
            'Always clip rounded corners even if window is maximized or tiled',
        ),
    });
    keepForFullscreen = new Adw.SwitchRow({
        title: _('Keep rounded corners when in fullscreen'),
        subtitle: _('Always clip rounded corners even for fullscreen window'),
    });
    paddings = new PaddingsRow();

    constructor(cb: AppRowCallbacks) {
        super(cb);

        this.#borderColorRow.add_suffix(this.borderColorButton);
        this.borderColorButton.set_dialog(this.borderColorDialog);

        this.#cornerRadiusRow.add_suffix(
            new Gtk.Scale({
                valign: Gtk.Align.CENTER,
                hexpand: true,
                draw_value: true,
                value_pos: Gtk.PositionType.LEFT,
                round_digits: 0,
                digits: 0,
                orientation: Gtk.Orientation.HORIZONTAL,
                adjustment: this.cornerRadius,
            }),
        );
        this.#cornerSmoothingRow.add_suffix(
            new Gtk.Scale({
                valign: Gtk.Align.CENTER,
                hexpand: true,
                draw_value: true,
                value_pos: Gtk.PositionType.LEFT,
                round_digits: 1,
                orientation: Gtk.Orientation.HORIZONTAL,
                adjustment: this.cornerSmoothing,
            }),
        );

        this.add_row(this.enabledRow);
        this.add_row(this.#borderColorRow);
        this.add_row(this.#cornerRadiusRow);
        this.add_row(this.#cornerSmoothingRow);
        this.add_row(this.keepForMaximized);
        this.add_row(this.keepForFullscreen);
        this.add_row(this.paddings);

        this.checkState();
    }

    public checkState() {
        if (!this.enabledRow.get_active()) {
            this.toggleSensitivity(false);
            return;
        }

        if (this.subtitle === '') {
            this.toggleSensitivity(false);
            return;
        }

        this.toggleSensitivity(true);
    }

    private toggleSensitivity(state: boolean) {
        this.#borderColorRow.set_sensitive(state);
        this.#cornerRadiusRow.set_sensitive(state);
        this.#cornerSmoothingRow.set_sensitive(state);
        this.keepForMaximized.set_sensitive(state);
        this.keepForFullscreen.set_sensitive(state);
        this.paddings.set_sensitive(state);
    }
}

export const CustomSettingsRow = GObject.registerClass(
    {
        GTypeName: 'CustomSettingsRow',
    },
    CustomSettingsRowClass,
);
