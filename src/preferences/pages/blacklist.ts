import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import { AppRowClass, type AppRowCb } from '../widgets/app_row.js';
import { BlacklistRow } from '../widgets/blacklist_row.js';
import { settings } from '../../utils/settings.js';

import { gettext } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { uri } from '../../utils/io.js';

export const BlackList = GObject.registerClass(
    {
        Template: uri(import.meta.url, 'blacklist.ui'),
        GTypeName: 'PrefsBlacklist',
        InternalChildren: ['blacklist_group']
    },
    class extends Adw.PreferencesPage {
        private declare _blacklist_group: Adw.PreferencesGroup;

        /** Store value of settings */
        private declare blacklist: string[];

        constructor() {
            super();
            this.blacklist = settings().black_list;

            for (const title of this.blacklist) {
                this.add_window(undefined, title);
            }
        }

        private add_window(_?: Gtk.Button, title?: string) {
            const cb: AppRowCb = {
                on_delete: (row) => this.delete_row(row),
                on_title_changed: (_, old_title, new_title) => this.change_title(old_title, new_title)
            };

            const row = new BlacklistRow(cb);
            row.set_subtitle(title || '');
            this._blacklist_group.add(row);
        }

        private delete_row(row: AppRowClass) {
            this.blacklist.splice(this.blacklist.indexOf(row.title), 1);
            settings().black_list = this.blacklist;
            this._blacklist_group.remove(row);
        }

        private change_title(old_title: string, new_title: string): boolean {
            if (this.blacklist.includes(new_title)) {
                const win = this.root as unknown as Adw.PreferencesDialog;
                win.add_toast(new Adw.Toast({ title: gettext(`Can't add ${new_title} to the list, because it already there`) }));
                return false;
            }
            if (old_title === '') {
                this.blacklist.push(new_title);
            } else {
                const old_id = this.blacklist.indexOf(old_title);
                this.blacklist.splice(old_id, 1, new_title);
            }

            settings().black_list = this.blacklist;

            return true;
        }
    }
);
