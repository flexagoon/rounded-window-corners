import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import { gettext } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { on_picked, pick } from '../../dbus/client.js';
import { connections } from '../../utils/connections.js';

export class AppRowClass extends Adw.ExpanderRow {
    private cb?: AppRowCb;

    private remove_btn = new Gtk.Button({
        icon_name: 'window-close-symbolic',
        css_classes: ['flat', 'circular'],
        valign: Gtk.Align.CENTER
    });
    private apply_btn = new Gtk.Button({
        icon_name: 'object-select-symbolic',
        css_classes: ['flat', 'circular'],
        valign: Gtk.Align.CENTER
    });
    private pick_btn = new Gtk.Button({
        icon_name: 'find-location-symbolic',
        css_classes: ['flat', 'circular'],
        valign: Gtk.Align.CENTER
    });
    private wm_class_entry = new Adw.EntryRow({
        title: gettext('Window class')
    })

    constructor(cb: AppRowCb) {
        super();
        this.cb = cb;

        this.wm_class_entry.add_prefix(this.apply_btn);
        this.wm_class_entry.add_prefix(this.pick_btn);
        this.add_row(this.wm_class_entry);
        this.add_suffix(this.remove_btn);

        this.bind_property('subtitle', this.wm_class_entry, 'text', GObject.BindingFlags.DEFAULT);

        this.add_css_class('property');
        this.set_title(gettext('Expand this row, to pick a window'));

        const c = connections.get();

        c.connect(this.remove_btn, 'clicked', () => {
            connections.get().disconnect_all(this.remove_btn);
            connections.get().disconnect_all(this.apply_btn);
            connections.get().disconnect_all(this.pick_btn);
            this.on_delete();
        });
        c.connect(this.pick_btn, 'clicked', () => {
            this.on_pick(this.wm_class_entry);
        });
        c.connect(this.apply_btn, 'clicked', () => {
            this.on_title_change(this.wm_class_entry);
        });
    }

    on_title_change(entry: Adw.EntryRow) {
        if (!this.cb?.on_title_changed || this.subtitle === entry.text || entry.text === '') {
            return;
        }

        if (this.cb.on_title_changed(this, this.subtitle || '', entry.text || '')) {
            this.set_subtitle(entry.text || '');
        }
    }

    on_pick( entry: Adw.EntryRow) {
        on_picked(wm_instance_class => {
            if (wm_instance_class === 'window-not-found') {
                const win = this.root as unknown as Adw.PreferencesDialog;
                win.add_toast(new Adw.Toast({ title: gettext('Can\'t pick window from this position') }));
                return;
            }
            entry.text = wm_instance_class;
        });
        pick();
    }

    on_delete() {
        this.cb?.on_delete(this);
    }
}

export const AppRow = GObject.registerClass(
    {
        GTypeName: 'AppRow',
    },
    AppRowClass
);

export type AppRowCb = {
    on_delete: (row: AppRowClass) => void;
    on_title_changed: (row: AppRowClass, old_title: string, new_title: string) => boolean;
};
