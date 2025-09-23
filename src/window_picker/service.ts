/**
 * @file This file contains the implementation of the DBus interface for the
 * window picker. See the {@link WindowPicker} class for more information.
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import {Inspector} from 'resource:///org/gnome/shell/ui/lookingGlass.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {readRelativeFile} from '../utils/file.js';
import {logDebug} from '../utils/log.js';

/**
 * This class provides the implementation of the DBus interface for the window
 * picker. It implements a single method - `pick` - which opens the window picker
 * and allows the user to select a window.
 */
export class WindowPicker {
    #iface = readRelativeFile(import.meta.url, 'iface.xml');
    #dbus = Gio.DBusExportedObject.wrapJSObject(this.#iface, this);

    /** Emit the wm_class of the picked window to the `picked` signal. */
    #sendPickedWindow(wmClass: string) {
        this.#dbus.emit_signal('picked', new GLib.Variant('(s)', [wmClass]));
    }

    /**
     * Open the window picker and select a window.
     *
     * This uses the window picker from GNOME's Looking Glass. This is the
     * easiest way to pick a window, and this is also what's used by other
     * extensions such as Blur my Shell.
     */
    pick() {
        const lookingGlass = Main.createLookingGlass();
        const inspector = new Inspector(lookingGlass);

        inspector.connect('target', (me, target, x, y) => {
            logDebug(`${me}: pick ${target} in ${x}, ${y}`);

            // Remove the red border effect when the window is picked.
            const effectName = 'lookingGlass_RedBorderEffect';
            for (const effect of target.get_effects()) {
                if (effect.toString().includes(effectName)) {
                    target.remove_effect(effect);
                }
            }

            let actor = target;

            // If the picked actor is not a Meta.WindowActor, which happens
            // often since it's usually a Meta.SurfaceActor, try to find its
            // parent which is a Meta.WindowActor.
            for (let i = 0; i < 2; i++) {
                if (actor == null || actor instanceof Meta.WindowActor) {
                    break;
                }
                actor = actor.get_parent();
            }

            if (!(actor instanceof Meta.WindowActor)) {
                this.#sendPickedWindow('window-not-found');
                return;
            }

            this.#sendPickedWindow(
                actor.metaWindow.get_wm_class_instance() ?? 'window-not-found',
            );
        });

        inspector.connect('closed', () => {
            lookingGlass.close();
        });
    }

    export() {
        this.#dbus.export(
            Gio.DBus.session,
            '/org/gnome/shell/extensions/RoundedWindowCorners',
        );
        logDebug('DBus Service exported');
    }

    unexport() {
        this.#dbus.unexport();
    }
}
