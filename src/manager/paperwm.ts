/** @file Shadows for PaperWM's animated window clones (PaperWM 50). */

import type GObject from 'gi://GObject';
import type {RoundedWindowActor} from '../utils/types.js';

import Clutter from 'gi://Clutter';

import {SHADOW_PADDING} from '../utils/constants.js';
import {
    computeShadowActorOffset,
    computeWindowContentsOffset,
} from './utils.js';

type PaperClone = Clutter.Actor & {cloneActor?: Clutter.Clone};

/**
 * Discover PaperWM's clone without importing or patching the other extension.
 * The clone container carries PaperWM's scrolling, workspace transforms and
 * monitor clipping. Its window clone visibility is independent of the source.
 */
export function syncPaperShadow(actor: RoundedWindowActor) {
    const data = actor.rwcCustomData;
    if (!data) return;
    const container = (
        actor.metaWindow as typeof actor.metaWindow & {
            clone?: PaperClone;
        }
    ).clone;
    if (data.paperShadow?.container === container) return;
    data.paperShadow?.destroy();
    const windowClone = container?.cloneActor;
    if (!(container && windowClone)) return;

    const shadowClone = new Clutter.Clone({
        source: data.shadow,
        reactive: false,
    });
    const connections: {object: GObject.Object; id: number}[] = [];
    const on = (
        object: GObject.Object,
        signal: string,
        callback: () => void,
    ) => {
        connections.push({object, id: object.connect(signal, callback)});
    };
    const update = () => {
        const frame = actor.metaWindow.get_frame_rect();
        shadowClone.set_position(-SHADOW_PADDING, -SHADOW_PADDING);
        shadowClone.set_size(
            frame.width + 2 * SHADOW_PADDING,
            frame.height + 2 * SHADOW_PADDING,
        );
        shadowClone.visible =
            windowClone.visible && windowClone.source === actor;
    };
    const destroy = () => {
        for (const {object, id} of connections) object.disconnect(id);
        connections.length = 0;
        delete data.paperShadow;
        shadowClone.destroy();
    };
    data.paperShadow = {container, destroy};
    on(container, 'destroy', destroy);
    on(windowClone, 'notify::visible', update);
    on(windowClone, 'notify::source', update);
    on(container, 'notify::size', update);
    // PaperWM inserts its selection immediately below windowClone and assumes
    // that it is the first child. Inserting below windowClone would break that
    // invariant whenever focus changes. Our source already clips out the window
    // interior, so the shadow can safely paint above the window instead.
    container.insert_child_above(shadowClone, windowClone);
    update();
}

/** Keep desktop shadows inside the same monitor clip as their windows. */
export function syncShadowClip(actor: RoundedWindowActor) {
    const shadow = actor.rwcCustomData?.shadow;
    if (!shadow) return;
    if (actor.has_clip) {
        const [x, y, width, height] = actor.get_clip();
        const [offsetX, offsetY] = computeShadowActorOffset(
            computeWindowContentsOffset(actor.metaWindow),
        );
        shadow.set_clip(x - offsetX, y - offsetY, width, height);
    } else {
        shadow.remove_clip();
    }
}

/**
 * BMS hides its blur child when PaperWM hides the real window for animation.
 * Keep that child available to the clone, without changing the blur pipeline,
 * opacity, radius, or the window's own visibility.
 */
export function syncPaperBlur(actor: RoundedWindowActor) {
    const data = actor.rwcCustomData;
    if (!data) return;
    const clone = (data.paperShadow?.container as PaperClone | undefined)
        ?.cloneActor;
    const blur = actor
        .get_children()
        .find(child => child.name === 'bms-application-blurred-widget');
    if (data.paperBlur?.actor === blur && data.paperBlur?.clone === clone)
        return;
    data.paperBlur?.destroy();
    if (!(blur && clone)) return;

    let wantedVisible = blur.visible;
    let forcedVisible = false;
    const connections: {object: GObject.Object; id: number}[] = [];
    const on = (
        object: GObject.Object,
        signal: string,
        callback: () => void,
    ) => {
        connections.push({object, id: object.connect(signal, callback)});
    };
    const update = () => {
        const cloning = clone.visible && clone.source === actor;
        if (actor.visible) {
            forcedVisible = false;
            wantedVisible = blur.visible;
        } else if (cloning && wantedVisible) {
            forcedVisible = true;
            blur.show();
        } else if (forcedVisible) {
            forcedVisible = false;
            blur.hide();
        }
    };
    const destroy = (blurDestroyed = false) => {
        for (const {object, id} of connections) object.disconnect(id);
        connections.length = 0;
        delete data.paperBlur;
        if (forcedVisible && !blurDestroyed) blur.hide();
    };
    data.paperBlur = {actor: blur, clone, destroy};
    // Run after BMS's normal notify handler, regardless of extension load order.
    connections.push({
        object: actor,
        id: actor.connect_after('notify::visible', update),
    });
    on(blur, 'notify::visible', () => {
        // Ignore the temporary hide caused by hiding the parent for PaperWM.
        if (actor.visible) wantedVisible = blur.visible;
    });
    on(blur, 'destroy', () => destroy(true));
    on(clone, 'notify::visible', update);
    on(clone, 'notify::source', update);
    on(clone, 'destroy', () => destroy());
    update();
}
