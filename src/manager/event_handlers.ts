/**
 * @file Contains the implementation of handlers for various events that need
 * to be processed by the extension. Those handlers are bound to event signals
 * in effect_manager.ts.
 */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import {ClipShadowEffect} from '../effect/clip_shadow_effect.js';
import {RoundedCornersEffect} from '../effect/rounded_corners_effect.js';
import {
    CLIP_SHADOW_EFFECT,
    ROUNDED_CORNERS_EFFECT,
} from '../utils/constants.js';
import {logDebug} from '../utils/log.js';
import {getPref} from '../utils/settings.js';
import {hasMetaWindow, type RoundedWindowActor} from '../utils/types.js';
import {
    computeBounds,
    computeShadowActorOffset,
    computeWindowContentsOffset,
    getRoundedCornersCfg,
    getRoundedCornersEffect,
    isChromium,
    shouldEnableEffect,
    unwrapActor,
    updateShadowActorStyle,
} from './utils.js';

/**
 * Per-actor queue lock to run event handlers one after another and avoid
 * needlessly refreshing the effect a lot of times.
 */
function withActorLock(
    actor: RoundedWindowActor,
    fn: () => Promise<void>,
): Promise<void> {
    const prev: Promise<void> | undefined = actor.rwcLock;
    const next = prev ? prev.then(fn, fn) : fn();
    actor.rwcLock = next;
    return next;
}

export function onAddEffect(actor: RoundedWindowActor) {
    return withActorLock(actor, async () => {
        logDebug(`Adding effect to ${actor?.metaWindow.wmClass}`);
        const win = actor.metaWindow;

        // Skip windows that already have the effect to prevent a memory leak
        const shouldHaveEffect = await shouldEnableEffect(win);
        const effect = getRoundedCornersEffect(actor);
        const hasEffect = effect && actor.rwcCustomData;

        if (!shouldHaveEffect || hasEffect) {
            logDebug(`Skipping ${win.wmClass}`);
            return;
        }

        createEffect(actor);
    });
}

/**
 * Create the effect on an actor.
 *
 * @param actor - The window actor to create the effect on.
 */
function createEffect(actor: RoundedWindowActor) {
    unwrapActor(actor)?.add_effect_with_name(
        ROUNDED_CORNERS_EFFECT,
        new RoundedCornersEffect(),
    );

    const shadow = createShadow(actor);

    // Bind properties of the window to the shadow actor.
    const propertyBindings: GObject.Binding[] = [];
    for (const prop of [
        'pivot-point',
        'translation-x',
        'translation-y',
        'scale-x',
        'scale-y',
        'visible',
    ]) {
        const binding = actor.bind_property(
            prop,
            shadow,
            prop,
            GObject.BindingFlags.SYNC_CREATE,
        );
        propertyBindings.push(binding);
    }

    // Store shadow, app type, visible binding, so that we can access them later
    actor.rwcCustomData = {
        shadow,
        unminimizedTimeoutId: 0,
        propertyBindings,
    };

    // Make sure the effect is applied correctly.
    updateEffect(actor);
}

export function onRemoveEffect(actor: RoundedWindowActor) {
    const name = ROUNDED_CORNERS_EFFECT;
    unwrapActor(actor)?.remove_effect_by_name(name);

    // Unbind all properties
    for (const binding of actor.rwcCustomData?.propertyBindings || []) {
        binding.unbind();
    }

    // Remove shadow actor
    const shadow = actor.rwcCustomData?.shadow;
    if (shadow) {
        shadow.get_constraints().forEach(constraint => {
            shadow.remove_constraint(constraint);
        });
        global.windowGroup.remove_child(shadow);
        shadow.clear_effects();
        shadow.destroy();
    }

    // Remove all timeout handler
    const timeoutId = actor.rwcCustomData?.unminimizedTimeoutId;
    if (timeoutId) {
        GLib.source_remove(timeoutId);
    }
    delete actor.rwcCustomData;
}

/**
 * Call `callback` with the named "Compiz alike magic lamp effect" effect once
 * it is attached to the actor.
 *
 * That extension attaches its effect from its own minimize and unminimize
 * signal handlers, and handlers run in the order they were connected. When
 * this extension is enabled first, the effect does not exist yet when our
 * handler runs, so look it up again right before the next frame is drawn,
 * which is still before the animation shows its first frame.
 *
 * @param actor - The window actor being minimized or unminimized.
 * @param name - The name of the magic lamp effect to look for.
 * @param callback - Called with the effect if the window has one.
 */
function withMagicLampEffect(
    actor: RoundedWindowActor,
    name: string,
    callback: (effect: Clutter.Effect) => void,
    otherwise?: () => void,
) {
    const effect = actor.get_effect(name);
    if (effect) {
        callback(effect);
        return;
    }

    global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
        // The window may have been closed in the meantime.
        if (actor.rwcCustomData) {
            const lateEffect = actor.get_effect(name);
            if (lateEffect) callback(lateEffect);
            else otherwise?.();
        }
        return GLib.SOURCE_REMOVE;
    });
}

export function onMinimize(actor: RoundedWindowActor) {
    // Compatibility with "Compiz alike magic lamp effect".
    // When minimizing a window, disable the shadow to make the magic lamp effect
    // work.
    withMagicLampEffect(actor, 'minimize-magic-lamp-effect', () => {
        const shadow = actor.rwcCustomData?.shadow;
        const roundedCornersEffect = getRoundedCornersEffect(actor);
        if (shadow && roundedCornersEffect) {
            logDebug('Minimizing with magic lamp effect');
            shadow.visible = false;
            roundedCornersEffect.enabled = false;
        }
    });
}

export async function onUnminimize(actor: RoundedWindowActor) {
    // Compatibility with "Compiz alike magic lamp effect".
    // When unminimizing a window, wait until the effect is completed before
    // showing the shadow.
    withMagicLampEffect(
        actor,
        'unminimize-magic-lamp-effect',
        effect => {
            const shadow = actor.rwcCustomData?.shadow;
            const roundedCornersEffect = getRoundedCornersEffect(actor);
            if (!(shadow && roundedCornersEffect)) return;

            shadow.visible = false;
            type Effect = Clutter.Effect & {timerId: Clutter.Timeline};
            const timer = (effect as Effect).timerId;

            const id = timer.connect('new-frame', source => {
                // Wait until the effect is 98% completed
                if (source.get_progress() > 0.98) {
                    logDebug('Unminimizing with magic lamp effect');
                    shadow.visible = true;
                    roundedCornersEffect.enabled = true;
                    source.disconnect(id);
                }
            });
        },
        () => {
            // The magic lamp skips its animation in some cases (for example
            // when the window is restored from the overview), but onMinimize
            // may still have disabled the effect and hidden the shadow.
            const shadow = actor.rwcCustomData?.shadow;
            const roundedCornersEffect = getRoundedCornersEffect(actor);
            if (shadow) shadow.visible = true;
            if (roundedCornersEffect) roundedCornersEffect.enabled = true;
        },
    );

    // Chromium has a bug where windows are sometimes unminimized to the
    // wrong location, and then move to the correct position shortly after.
    // This forces an effect refresh after the window has already moved to the
    // proper position; otherwise, the effect bounds would use the wrong one and
    // cut off a part of the window.
    //
    // See https://github.com/flexagoon/rounded-window-corners/issues/124
    if (
        (await isChromium(actor.metaWindow)) &&
        actor.rwcCustomData !== undefined
    ) {
        const oldTimeout = actor.rwcCustomData.unminimizedTimeoutId;
        if (oldTimeout !== 0) GLib.source_remove(oldTimeout);
        actor.rwcCustomData.unminimizedTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            250,
            () => {
                // Refreshing re-enables the effect, which the magic lamp
                // handling above keeps disabled until the animation is done;
                // doing it earlier draws the border around the full window
                // while it is still warping out of the dock.
                if (actor.get_effect('unminimize-magic-lamp-effect'))
                    return GLib.SOURCE_CONTINUE;
                refreshRoundedCorners(actor);
                return GLib.SOURCE_REMOVE;
            },
        );
    }
}

export function onRestacked() {
    for (const actor of global.get_window_actors()) {
        const shadow = (actor as RoundedWindowActor).rwcCustomData?.shadow;

        if (!(actor.visible && shadow)) {
            continue;
        }

        global.windowGroup.set_child_below_sibling(shadow, actor);
    }
}

export const onSizeChanged = refreshRoundedCorners;

export const onFocusChanged = refreshShadow;

export const onSettingsChanged = refreshAllRoundedCorners;

/**
 * Create the shadow actor for a window.
 *
 * @param actor - The window actor to create the shadow actor for.
 */
function createShadow(actor: RoundedWindowActor) {
    const shadow = new St.Bin({
        name: 'Shadow Actor',
        child: new St.Bin({
            xExpand: true,
            yExpand: true,
        }),
    });
    (shadow.firstChild as St.Bin).add_style_class_name('shadow');

    refreshShadow(actor);

    // We have to clip the shadow because of this issue:
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/4474
    shadow.add_effect_with_name(CLIP_SHADOW_EFFECT, new ClipShadowEffect());

    // Draw the shadow actor below the window actor.
    global.windowGroup.insert_child_below(shadow, actor);

    // Bind position and size between window and shadow
    for (let i = 0; i < 4; i++) {
        const constraint = new Clutter.BindConstraint({
            source: actor,
            coordinate: i,
            offset: 0,
        });
        shadow.add_constraint(constraint);
    }

    return shadow;
}

/**
 * Refresh the shadow actor for a window.
 *
 * @param actor - The window actor to refresh the shadow for.
 */
function refreshShadow(actor: RoundedWindowActor) {
    const win = actor.metaWindow;
    const shadow = actor.rwcCustomData?.shadow;
    if (!shadow) return;

    const shadowSettings = win.appears_focused
        ? getPref('focused-shadow')
        : getPref('unfocused-shadow');

    const {borderRadius, padding} = getRoundedCornersCfg(win);

    updateShadowActorStyle(win, shadow, borderRadius, shadowSettings, padding);
}

/**
 * Refresh rounded corners state and settings for a window.
 *
 * @param actor - The window actor to refresh the rounded corners settings for.
 */
function refreshRoundedCorners(actor: RoundedWindowActor) {
    return withActorLock(actor, async () => {
        const win = actor.metaWindow;

        const shouldHaveEffect = await shouldEnableEffect(win);

        const windowInfo = (actor as RoundedWindowActor).rwcCustomData;
        const effect = getRoundedCornersEffect(actor);

        const hasEffect = effect && windowInfo;

        // onAddEffect already skips windows that shouldn't have rounded corners.
        // This if statement is just for code readability to match the check for
        // onRemoveEffect below.
        if (!hasEffect && shouldHaveEffect) {
            createEffect(actor);

            // createEffect already calls updateEffect at the end,
            // so return here to avoid running the update twice.
            return;
        }

        if (hasEffect && !shouldHaveEffect) {
            onRemoveEffect(actor);
            return;
        }

        // Don'd do anything when the window doesn't have the effect and shouldn't have it.
        if (!hasEffect) return;

        updateEffect(actor);
    });
}

/**
 * Update effect uniforms and constraints for a window.
 *
 * @param actor - The window actor to update the effect for.
 */
function updateEffect(actor: RoundedWindowActor) {
    const win = actor.metaWindow;
    const windowInfo = actor.rwcCustomData;
    if (!windowInfo) return;

    const effect = getRoundedCornersEffect(actor);
    if (!effect) return;

    if (!effect.enabled) {
        effect.enabled = true;
    }

    const cfg = getRoundedCornersCfg(win);
    const windowContentOffset = computeWindowContentsOffset(win);
    effect.updateUniforms(cfg, computeBounds(actor, windowContentOffset));

    const shadow = windowInfo.shadow;
    const offsets = computeShadowActorOffset(windowContentOffset);
    const constraints = shadow.get_constraints();
    constraints.forEach((constraint, i) => {
        if (constraint instanceof Clutter.BindConstraint) {
            constraint.offset = offsets[i];
        }
    });

    refreshShadow(actor);
}

/** Refresh rounded corners settings for all windows. */
function refreshAllRoundedCorners() {
    for (const actor of global.get_window_actors()) {
        if (hasMetaWindow(actor)) {
            refreshRoundedCorners(actor);
        }
    }
}
