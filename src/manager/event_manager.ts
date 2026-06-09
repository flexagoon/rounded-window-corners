/**
 * @file Manages connections between gnome shell events and the rounded corners
 * effect. See {@link enableEffect} for more information.
 */

import type GObject from 'gi://GObject';
import type Meta from 'gi://Meta';
import type Shell from 'gi://Shell';
import type {RoundedWindowActor} from '../utils/types.js';

import GLib from 'gi://GLib';

import {logDebug} from '../utils/log.js';
import {prefs} from '../utils/settings.js';
import * as handlers from './event_handlers.js';
import {isChromiumWindow} from './utils.js';

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

    // When the extension is re-enabled after screen lock/unlock,
    // Chromium-based browsers may render stale surfaces. The compositor
    // skips repainting GLSL effects for unfocused windows, so briefly
    // focusing each affected window forces a repaint and triggers our
    // onFocusChanged handler which recomputes shader bounds.
    if (windowActors.length > 0) {
        deferredRefreshId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            const focusedWin = global.display.get_focus_window();
            const chromiumWindows = global
                .get_window_actors()
                .map(a => a.metaWindow)
                .filter(
                    (win): win is Meta.Window =>
                        win != null &&
                        win !== focusedWin &&
                        isChromiumWindow(win),
                );

            if (chromiumWindows.length > 0) {
                const timestamp = global.get_current_time();
                for (const [i, win] of chromiumWindows.entries()) {
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, i * 100, () => {
                        win.focus(timestamp);
                        return GLib.SOURCE_REMOVE;
                    });
                }

                // Restore focus to the originally focused window.
                GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    chromiumWindows.length * 100,
                    () => {
                        focusedWin?.focus(global.get_current_time());
                        return GLib.SOURCE_REMOVE;
                    },
                );
            }

            deferredRefreshId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    // Add the effect to new windows when they are opened.
    connect(
        global.display,
        'window-created',
        (_: Meta.Display, win: Meta.Window) => {
            const actor =
                win.get_compositor_private() as Meta.WindowActor | null;
            if (!actor) return;

            // If wm_class_instance of Meta.Window is null, wait for it to be
            // set before applying the effect.
            if (win?.get_wm_class_instance() == null) {
                const notifyId = win.connect('notify::wm-class', () => {
                    win.disconnect(notifyId);
                    // Defer: notify::wm-class can fire while Wayland protocol
                    // messages are processed during a paint frame. Re-fetch the
                    // actor inside the idle so we always use a fresh reference.
                    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        const freshActor =
                            win.get_compositor_private() as Meta.WindowActor | null;
                        if (freshActor) applyEffectTo(freshActor);
                        return GLib.SOURCE_REMOVE;
                    });
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
    if (deferredRefreshId) {
        GLib.source_remove(deferredRefreshId);
        deferredRefreshId = 0;
    }

    for (const actor of global.get_window_actors()) {
        removeEffectFrom(actor);
    }

    disconnectAll();
}

let deferredRefreshId = 0;
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
    // biome-ignore lint/suspicious/noExplicitAny: Signal callbacks can have any return args and return types.
    callback: (...args: any[]) => any,
) {
    connections.push({
        object: object,
        id: object.connect(signal, callback),
    });
}

/**
 * Disconnect all connected signals from all actors or a specific object.
 * Pruning disconnected entries keeps the array from growing unboundedly as
 * windows are opened and closed over the lifetime of the session.
 *
 * @param object - If object is provided, only disconnect signals from it.
 */
function disconnectAll(object?: GObject.Object) {
    let i = connections.length;
    while (i--) {
        const connection = connections[i];
        if (object === undefined || connection.object === object) {
            connection.object.disconnect(connection.id);
            // Over time as windows open and close, connections would grow
            // indefinitely with stale entries pointing to dead window objects
            // Release the reference to the GObject so it can be garbage
            // collected after the window is closed, preventing a memory leak.
            connections.splice(i, 1);
        }
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
    // In wayland sessions, the surface actor of XWayland clients is sometimes
    // not ready when the window is created. In this case, we wait until it is
    // ready before applying the effect.
    if (!actor.firstChild) {
        const id = actor.connect('notify::first-child', () => {
            actor.disconnect(id);
            // Defer: notify::first-child can fire during a Clutter layout pass
            // inside a paint frame. Adding effects mid-paint corrupts the
            // effect's actor pointer and triggers clutter_actor_node_new(NULL).
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                applyEffectTo(actor);
                return GLib.SOURCE_REMOVE;
            });
        });

        return;
    }

    const texture = actor.get_texture();
    if (!texture) {
        return;
    }

    // On mutter 50.2 (Wayland-only), metaWindow can be null during actor
    // lifecycle transitions (e.g. when first-child fires during destruction).
    // Guard here so we never end up with size signals connected but no effect
    // added — that broken partial state is what triggers the C-level
    // clutter_actor_node_new assertion when notify::size fires mid-paint.
    const metaWin = actor.metaWindow;
    if (!metaWin) {
        return;
    }

    // Window resized.
    //
    // The signal has to be connected both to the actor and the texture. Why is
    // that? I have no idea. But without that, weird bugs can happen. For
    // example, when using Dash to Dock, all opened windows will be invisible
    // *unless they are pinned in the dock*. So yeah, GNOME is magic.
    // All signal callbacks that can trigger onAddEffect or onRemoveEffect are
    // deferred with GLib.idle_add. Clutter can emit notify::size and
    // size-changed during a layout pass that runs inside a paint frame (e.g.
    // during meta_window_actor_paint_to_content for maximize animations).
    // Adding or removing an effect mid-paint sets the effect's actor pointer
    // while CLUTTER_ACTOR_IN_PAINT is set, which corrupts internal state and
    // causes clutter_actor_node_new(NULL) → SIGABRT.
    connect(actor, 'notify::size', () => {
        if (actor.metaWindow) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (actor.metaWindow) handlers.onSizeChanged(actor);
                return GLib.SOURCE_REMOVE;
            });
        }
    });
    connect(texture, 'size-changed', () => {
        if (actor.metaWindow) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (actor.metaWindow) handlers.onSizeChanged(actor);
                return GLib.SOURCE_REMOVE;
            });
        }
    });

    // Get notified about fullscreen explicitly, since a window must not change in
    // size to go fullscreen
    connect(metaWin, 'notify::fullscreen', () => {
        if (actor.metaWindow) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (actor.metaWindow) handlers.onSizeChanged(actor);
                return GLib.SOURCE_REMOVE;
            });
        }
    });

    // Window focus changed.
    connect(metaWin, 'notify::appears-focused', () => {
        if (actor.metaWindow) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (actor.metaWindow) handlers.onFocusChanged(actor);
                return GLib.SOURCE_REMOVE;
            });
        }
    });

    // Workspace or monitor of the window changed.
    connect(metaWin, 'workspace-changed', () => {
        if (actor.metaWindow) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (actor.metaWindow) handlers.onFocusChanged(actor);
                return GLib.SOURCE_REMOVE;
            });
        }
    });

    handlers.onAddEffect(actor);
}

/**
 * Remove the effect from a window.
 *
 * @param actor - The window actor to remove the effect from.
 */
function removeEffectFrom(actor: RoundedWindowActor) {
    disconnectAll(actor);
    disconnectAll(actor.metaWindow);

    const texture = actor.get_texture();
    if (texture) {
        disconnectAll(texture);
    }

    handlers.onRemoveEffect(actor);
}
