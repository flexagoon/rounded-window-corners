/**
 * @file Manages connections between gnome shell events and the rounded corners
 * effect. See {@link enableEffect} for more information.
 */

import {logDebug} from '../utils/log.js';
import {prefs} from '../utils/settings.js';
import * as handlers from './event_handlers.js';

import type GObject from 'gi://GObject';
import type Meta from 'gi://Meta';
import type Shell from 'gi://Shell';
import type {RoundedWindowActor} from '../utils/types.js';

/**
 * The rounded corners effect has to perform some actions when differen events
 * happen. For example, when a new window is opened, the effect has to detect
 * it and add rounded corners to it.
 *
 * The `enableEffect` method handles this by attaching the necessary signals
 * to matching handlers on each effect.
 */
export function enableEffect() {
    // Update the effect when settings are changed.
    connect(prefs, 'changed', handlers.onSettingsChanged);

    const wm = global.windowManager;

    // Add the effect to all windows when the extension is enabled.
    const windowActors = global.get_window_actors();
    logDebug(`Initial window count: ${windowActors.length}`);
    for (const actor of windowActors) {
        applyEffectTo(actor);
    }

    // Add the effect to new windows when they are opened.
    connect(
        global.display,
        'window-created',
        (_: Meta.Display, win: Meta.Window) => {
            if (!win) {
                logDebug('window-created signal received with null window');
                return;
            }

            const actor: Meta.WindowActor = win.get_compositor_private();
            if (!actor) {
                logDebug('No compositor private actor found for window');
                return;
            }

            // If wm_class_instance of Meta.Window is null, wait for it to be
            // set before applying the effect.
            if (win.get_wm_class_instance() == null) {
                const notifyId = win.connect('notify::wm-class', () => {
                    if (win.get_wm_class_instance() != null) {
                        applyEffectTo(actor);
                        win.disconnect(notifyId);
                    }
                });
            } else {
                applyEffectTo(actor);
            }
        },
    );

    // Window minimized.
    connect(wm, 'minimize', (_: Shell.WM, actor: Meta.WindowActor) =>
        handlers.onMinimize(actor),
    );

    // Window unminimized.
    connect(wm, 'unminimize', (_: Shell.WM, actor: Meta.WindowActor) =>
        handlers.onUnminimize(actor),
    );

    // When closing the window, remove the effect from it.
    connect(wm, 'destroy', (_: Shell.WM, actor: Meta.WindowActor) =>
        removeEffectFrom(actor),
    );

    // When windows are restacked, the order of shadow actors as well.
    connect(global.display, 'restacked', handlers.onRestacked);
}

/** Disable the effect for all windows. */
export function disableEffect() {
    for (const actor of global.get_window_actors()) {
        removeEffectFrom(actor);
    }

    disconnectAll();
}

const connections: {object: GObject.Object; id: number}[] = [];

/**
 * Connect a callback to an object signal and add it to the list of all
 * connections. This allows to easily disconnect all signals when removing
 * the effect.
 *
 * @param object - The object to connect the callback to.
 * @param signal - The name of the signal.
 * @param callback - The function to connect to the signal.
 */
function connect(
    object: GObject.Object,
    signal: string,
    // Signal callbacks can have any return args and return types.
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    callback: (...args: any[]) => any,
) {
    connections.push({
        object: object,
        id: object.connect(signal, callback),
    });
}

/**
 * Disconnect all connected signals from all actors or a specific object.
 *
 * @param object - If object is provided, only disconnect signals from it.
 */
function disconnectAll(object?: GObject.Object) {
    const toRemove: number[] = [];

    for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        if (object === undefined || connection.object === object) {
            try {
                // Check if the object still exists and has the signal handler
                if (connection.object && typeof connection.object.disconnect === 'function') {
                    connection.object.disconnect(connection.id);
                }
            } catch (e) {
                logDebug(`Failed to disconnect signal ${connection.id}: ${e}`);
            }
            toRemove.push(i);
        }
    }

    // Remove disconnected connections from the array (in reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
        connections.splice(toRemove[i], 1);
    }
}

/**
 * Apply the effect to a window.
 *
 * While {@link enableEffect} handles global events such as window creation,
 * this function handles events that happen to a specific window, like changing
 * its size or workspace.
 *
 * @param actor - The window actor to apply the effect to.
 */
function applyEffectTo(actor: RoundedWindowActor) {
    if (!actor || !actor.metaWindow) {
        logDebug('applyEffectTo called with null actor or metaWindow');
        return;
    }

    // In wayland sessions, the surface actor of XWayland clients is sometimes
    // not ready when the window is created. In this case, we wait until it is
    // ready before applying the effect.
    if (!actor.firstChild) {
        try {
            const id = actor.connect('notify::first-child', () => {
                applyEffectTo(actor);
                actor.disconnect(id);
            });
        } catch (e) {
            logDebug(`Failed to connect notify::first-child signal: ${e}`);
        }
        return;
    }

    const texture = actor.get_texture();
    if (!texture) {
        return;
    }

    // Window resized.
    //
    // The signal has to be connected both to the actor and the texture. Why is
    // that? I have no idea. But without that, weird bugs can happen. For
    // example, when using Dash to Dock, all opened windows will be invisible
    // *unless they are pinned in the dock*. So yeah, GNOME is magic.
    connect(actor, 'notify::size', () => handlers.onSizeChanged(actor));
    connect(texture, 'size-changed', () => {
        handlers.onSizeChanged(actor);
    });

    // Window focus changed.
    connect(actor.metaWindow, 'notify::appears-focused', () =>
        handlers.onFocusChanged(actor),
    );

    // Workspace or monitor of the window changed.
    connect(actor.metaWindow, 'workspace-changed', () => {
        handlers.onFocusChanged(actor);
    });

    handlers.onAddEffect(actor);
}

/**
 * Remove the effect from a window.
 *
 * @param actor - The window actor to remove the effect from.
 */
function removeEffectFrom(actor: RoundedWindowActor) {
    if (!actor) {
        logDebug('removeEffectFrom called with null actor');
        return;
    }

    try {
        disconnectAll(actor);
        if (actor.metaWindow) {
            disconnectAll(actor.metaWindow);
        }
    } catch (e) {
        logDebug(`Error disconnecting signals: ${e}`);
    }

    handlers.onRemoveEffect(actor);
}
