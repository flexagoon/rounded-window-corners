/**
 * @file Generic widget for choosing a window via a picker or a text entry.
 * Used in the blacklist and custom settings pages.
 */

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {onPicked, pick} from '../../window_picker/client.js';

export class AppRowClass extends Adw.ExpanderRow {
    #callbacks: AppRowCallbacks;

    #removeButton = new Gtk.Button({
        icon_name: 'window-close-symbolic',
        css_classes: ['flat', 'circular'],
        valign: Gtk.Align.CENTER,
    });
    #applyButton = new Gtk.Button({
        icon_name: 'object-select-symbolic',
        css_classes: ['flat', 'circular'],
        valign: Gtk.Align.CENTER,
    });
    #pickButton = new Gtk.Button({
        icon_name: 'find-location-symbolic',
        css_classes: ['flat', 'circular'],
        valign: Gtk.Align.CENTER,
    });

    #wmClassEntry = new Adw.EntryRow({
        title: _('Window class'),
    });

    constructor(cb: AppRowCallbacks) {
        super();

        this.#callbacks = cb;

        this.#wmClassEntry.add_prefix(this.#applyButton);
        this.#wmClassEntry.add_prefix(this.#pickButton);
        this.add_row(this.#wmClassEntry);
        this.add_suffix(this.#removeButton);

        this.bind_property(
            'subtitle',
            this.#wmClassEntry,
            'text',
            GObject.BindingFlags.DEFAULT,
        );

        this.add_css_class('property');
        this.set_title(_('Expand this row, to pick a window'));

        this.#removeButton.connect('clicked', () => {
            this.onDelete();
        });
        this.#pickButton.connect('clicked', () => {
            this.pickWindow(this.#wmClassEntry);
        });
        this.#applyButton.connect('clicked', () => {
            this.onTitleChange(this.#wmClassEntry);
        });
    }

    onTitleChange(entry: Adw.EntryRow) {
        // Skip if the title hasn't changed
        if (this.subtitle === entry.text || entry.text === '') {
            return;
        }

        if (
            this.#callbacks.onWindowChange(
                this,
                this.subtitle || '',
                entry.text || '',
            )
        ) {
            this.set_subtitle(entry.text || '');
        }
    }

    onDelete() {
        this.#callbacks?.onDelete(this);
    }

    pickWindow(entry: Adw.EntryRow) {
        onPicked(wmInstanceClass => {
            if (wmInstanceClass === 'window-not-found') {
                const win = this.root as unknown as Adw.PreferencesDialog;
                win.add_toast(
                    new Adw.Toast({
                        title: _("Can't pick window from this position"),
                    }),
                );
                return;
            }
            entry.text = wmInstanceClass;
        });
        pick();
    }
}

export const AppRow = GObject.registerClass(
    {
        GTypeName: 'AppRow',
    },
    AppRowClass,
);

export type AppRowCallbacks = {
    onDelete: (row: AppRowClass) => void;
    onWindowChange: (
        row: AppRowClass,
        oldWmClass: string,
        newWmClass: string,
    ) => boolean;
};
