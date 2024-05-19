import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import { AppRowClass, type AppRowCb } from './app_row.js';
import './app_row.js';

export const BlacklistRow = GObject.registerClass(
    {
        GTypeName: 'BlacklistRow'
    },
    class extends AppRowClass {

        constructor(cb: AppRowCb) {
            super(cb);
        }
    }
);