/** @file A widget for setting paddings for windows, used inside of {@link CustomSettingsRow}. */

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

export class PaddingsRowClass extends Adw.PreferencesRow {
    declare paddingTop: number;
    declare paddingBottom: number;
    declare paddingStart: number;
    declare paddingEnd: number;
}

export const PaddingsRow = GObject.registerClass(
    {
        Template: GLib.uri_resolve_relative(
            import.meta.url,
            'paddings-row.ui',
            GLib.UriFlags.NONE,
        ),
        GTypeName: 'PaddingsRow',
        Properties: {
            PaddingTop: GObject.ParamSpec.int(
                'padding-top',
                'Padding top',
                'Padding from the top',
                GObject.ParamFlags.READWRITE,
                0,
                100,
                0,
            ),
            PaddingBottom: GObject.ParamSpec.int(
                'padding-bottom',
                'Padding bottom',
                'Padding from the bottom',
                GObject.ParamFlags.READWRITE,
                0,
                100,
                0,
            ),
            PaddingStart: GObject.ParamSpec.int(
                'padding-start',
                'Padding start',
                'Padding from the start',
                GObject.ParamFlags.READWRITE,
                0,
                100,
                0,
            ),
            PaddingEnd: GObject.ParamSpec.int(
                'padding-end',
                'Padding end',
                'Padding from the end',
                GObject.ParamFlags.READWRITE,
                0,
                100,
                0,
            ),
        },
    },
    PaddingsRowClass,
);
