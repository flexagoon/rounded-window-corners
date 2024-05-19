import GObject from 'gi://GObject';

import {AppRowClass} from './app_row.js';
import './app_row.js';

export const BlacklistRow = GObject.registerClass(
    {
        GTypeName: 'BlacklistRow',
    },
    class extends AppRowClass {},
);
