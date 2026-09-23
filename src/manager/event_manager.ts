/** @file Owns global and per-window signals for the rounded corners effect. */

import type Clutter from 'gi://Clutter';
import type GObject from 'gi://GObject';
import type Meta from 'gi://Meta';
import type Shell from 'gi://Shell';

import {extensionManager} from 'resource:///org/gnome/shell/ui/main.js';

import {logDebug} from '../utils/log.js';
import {prefs} from '../utils/settings.js';
import {hasMetaWindow, type RoundedWindowActor} from '../utils/types.js';
import * as handlers from './event_handlers.js';
import {unwrapActor} from './utils.js';

const actors = new Set<RoundedWindowActor>();
const connections: {
    object: GObject.Object | typeof extensionManager;
    id: number;
    owner?: RoundedWindowActor;
}[] = [];

export function enableEffect() {
    connect(prefs, 'changed', handlers.onSettingsChanged);
    const wm = global.windowManager;

    for (const actor of global.get_window_actors()) {
        if (hasMetaWindow(actor)) applyEffectTo(actor);
    }

    connect(
        global.display,
        'window-created',
        (_: Meta.Display, win: Meta.Window) => {
            const actor =
                win.get_compositor_private() as Meta.WindowActor | null;
            if (hasMetaWindow(actor)) applyEffectTo(actor);
        },
    );
    // Some clients do not have a surface (or even an actor) at window-created.
    connect(wm, 'map', (_: Shell.WM, actor: Meta.WindowActor) => {
        if (hasMetaWindow(actor)) applyEffectTo(actor);
    });
    connect(wm, 'minimize', (_: Shell.WM, actor: Meta.WindowActor) => {
        if (hasMetaWindow(actor)) handlers.onMinimize(actor);
    });
    connect(wm, 'unminimize', (_: Shell.WM, actor: Meta.WindowActor) => {
        if (hasMetaWindow(actor)) handlers.onUnminimize(actor);
    });
    connect(wm, 'destroy', (_: Shell.WM, actor: Meta.WindowActor) => {
        removeEffectFrom(actor as RoundedWindowActor);
    });
    connect(global.display, 'restacked', handlers.onRestacked);
    // Also discover clones when PaperWM is enabled after this extension.
    connections.push({
        object: extensionManager,
        id: extensionManager.connect('extension-state-changed', () => {
            handlers.onRestacked();
        }),
    });
    logDebug(`Initial window count: ${actors.size}`);
}

export function disableEffect() {
    disconnectAll();
    // Include actors waiting for a surface and actors already being unmanaged.
    for (const actor of actors) removeEffectFrom(actor);
}

function connect(
    object: GObject.Object,
    signal: string,
    // biome-ignore lint/suspicious/noExplicitAny: GObject signal signatures vary.
    callback: (...args: any[]) => void,
    owner?: RoundedWindowActor,
) {
    connections.push({object, id: object.connect(signal, callback), owner});
}

function disconnectAll(owner?: RoundedWindowActor, object?: GObject.Object) {
    let i = connections.length;
    while (i--) {
        const connection = connections[i];
        if (
            (owner === undefined || connection.owner === owner) &&
            (object === undefined || connection.object === object)
        ) {
            connection.object.disconnect(connection.id);
            connections.splice(i, 1);
        }
    }
}

function applyEffectTo(actor: RoundedWindowActor) {
    if (actors.has(actor)) return;
    actors.add(actor);
    actor.rwcGeneration = {};
    const win = actor.metaWindow;
    const on = (object: GObject.Object, signal: string, callback: () => void) =>
        connect(object, signal, callback, actor);

    // Register cleanup before waiting for wm-class or the first surface.
    on(actor, 'destroy', () => removeEffectFrom(actor));
    on(win, 'unmanaging', () => removeEffectFrom(actor));

    const refresh = () => {
        handlers.onSizeChanged(actor);
    };
    let surface: Clutter.Actor | null = null;
    let texture: GObject.Object | null = null;
    const clearSurface = () => {
        // Invalidate /proc reads before the surface or its texture is disposed.
        actor.rwcGeneration = {};
        delete actor.rwcLock;
        handlers.onRemoveEffect(actor);
        if (surface) disconnectAll(actor, surface);
        if (texture) disconnectAll(actor, texture);
        surface = null;
        texture = null;
    };
    const initialize = () => {
        handlers.onActorChanged(actor);
        const nextSurface = unwrapActor(actor);
        if (surface !== nextSurface) clearSurface();
        if (!nextSurface || win.wmClass === null) return;
        if (surface) return;
        const nextTexture = actor.get_texture();
        if (!nextTexture) return;
        surface = nextSurface;
        texture = nextTexture;
        on(surface, 'destroy', clearSurface);
        on(surface, 'notify::size', refresh);
        on(texture, 'size-changed', refresh);
        handlers.onAddEffect(actor);
    };
    on(actor, 'notify::size', refresh);
    on(win, 'size-changed', refresh);
    on(win, 'position-changed', refresh);
    on(win, 'notify::fullscreen', refresh);
    on(win, 'notify::maximized-horizontally', refresh);
    on(win, 'notify::maximized-vertically', refresh);
    on(win, 'notify::appears-focused', () => handlers.onFocusChanged(actor));
    on(win, 'workspace-changed', refresh);
    on(actor, 'notify::visible', () => handlers.onActorChanged(actor));
    on(actor, 'notify::clip-rect', () => handlers.onActorChanged(actor));
    on(actor, 'notify::has-clip', () => handlers.onActorChanged(actor));
    on(actor, 'child-added', initialize);
    on(actor, 'child-removed', initialize);
    on(actor, 'notify::mapped', initialize);
    on(win, 'notify::wm-class', initialize);
    initialize();
}

function removeEffectFrom(actor: RoundedWindowActor) {
    if (!actors.delete(actor)) return;
    delete actor.rwcGeneration;
    delete actor.rwcLock;
    disconnectAll(actor);
    handlers.onRemoveEffect(actor);
}
