/**
 * @file This file provides wrapper functions around the DBus window picker
 * interface.
 */

import Gio from 'gi://Gio';

const connection = Gio.DBus.session;
const busName = 'org.gnome.Shell';
const interfaceName = 'org.gnome.Shell.Extensions.RoundedWindowCorners';
const objectPath = '/org/gnome/shell/extensions/RoundedWindowCorners';

/** Open the window picker and select a window. */
export function pick() {
    connection.call(
        busName,
        objectPath,
        interfaceName,
        'pick',
        null,
        null,
        Gio.DBusCallFlags.NO_AUTO_START,
        -1,
        null,
        null,
    );
}

/**
 * Connect a callback to the `picked` signal, which is emitted when a window
 * is picked.
 *
 * @param callback - The function to execute when the window is picked.
 */
export function onPicked(callback: (wmInstanceClass: string) => void) {
    const id = connection.signal_subscribe(
        busName,
        interfaceName,
        'picked',
        objectPath,
        null,
        Gio.DBusSignalFlags.NONE,
        (_conn, _sender, _objectPath, _iface, _signal, params) => {
            const val = params.get_child_value(0);
            callback(val.get_string()[0]);
            connection.signal_unsubscribe(id);
        },
        null,
    );
}
