import GObject from 'gi://GObject';
import Adw from 'gi://Adw';

import { uri } from '../../utils/io.js';

export class PaddingsRowClass extends Adw.PreferencesRow {
    public declare paddingTop: number;
    public declare paddingBottom: number;
    public declare paddingStart: number;
    public declare paddingEnd: number;
}

export const PaddingsRow = GObject.registerClass(
    {
        Template: uri(import.meta.url, 'paddings-row.ui'),
        GTypeName: 'PaddingsRow',
        Properties: {
            PaddingTop: GObject.ParamSpec.int(
                'padding-top',
                'Padding top',
                'Padding from the top',
                GObject.ParamFlags.READWRITE,
                0, 100, 0
            ),
            PaddingBottom: GObject.ParamSpec.int(
                'padding-bottom',
                'Padding bottom',
                'Padding from the bottom',
                GObject.ParamFlags.READWRITE,
                0, 100, 0
            ),
            PaddingStart: GObject.ParamSpec.int(
                'padding-start',
                'Padding start',
                'Padding from the start',
                GObject.ParamFlags.READWRITE,
                0, 100, 0
            ),
            PaddingEnd: GObject.ParamSpec.int(
                'padding-end',
                'Padding end',
                'Padding from the end',
                GObject.ParamFlags.READWRITE,
                0, 100, 0
            ),
        }
    },
    PaddingsRowClass
);