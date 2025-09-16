/**
 * @file Contains the implementation of handlers for various events that need
 * to be processed by the extension. Those handlers are bound to event signals
 * in effect_manager.ts.
 */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {ClipShadowEffect} from '../effect/clip_shadow_effect.js';
import {RoundedCornersEffect} from '../effect/rounded_corners_effect.js';
import {
    CLIP_SHADOW_EFFECT,
    ROUNDED_CORNERS_EFFECT,
} from '../utils/constants.js';
import {logDebug} from '../utils/log.js';
import {getPref} from '../utils/settings.js';
import {
    computeBounds,
    computeShadowActorOffset,
    computeWindowContentsOffset,
    getRoundedCornersCfg,
    getRoundedCornersEffect,
    shouldEnableEffect,
    unwrapActor,
    updateShadowActorStyle,
    windowScaleFactor,
} from './utils.js';

import type Meta from 'gi://Meta';
import type {RoundedWindowActor} from '../utils/types.js';

export function onAddEffect(actor: RoundedWindowActor) {
    // Add null checks for safety
    if (!actor || !actor.metaWindow) {
        return;
    }

    const win = actor.metaWindow;
    logDebug(`Adding effect to ${win.title || 'unknown window'}`);

    if (!shouldEnableEffect(win)) {
        logDebug(`Skipping ${win.title || 'unknown window'}`);
        return;
    }

    // Check if effect already exists to prevent duplicates
    if (actor.rwcCustomData) {
        logDebug(`Effect already exists for ${win.title || 'unknown window'}, skipping`);
        return;
    }

    unwrapActor(actor)?.add_effect_with_name(
        ROUNDED_CORNERS_EFFECT,
        new RoundedCornersEffect(),
    );

    const shadow = createShadow(actor);

    // Store property bindings so we can clean them up later
    const propertyBindings: GObject.Binding[] = [];

    // Bind properties of the window to the shadow actor.
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
        if (binding) {
            propertyBindings.push(binding);
        }
    }

    // Store shadow, property bindings, and timeout ID for cleanup
    actor.rwcCustomData = {
        shadow,
        unminimizedTimeoutId: 0,
        propertyBindings,
    };

    // Make sure the effect is applied correctly.
    refreshRoundedCorners(actor);
}

export function onRemoveEffect(actor: RoundedWindowActor): void {
    if (!actor || !actor.rwcCustomData) {
        return;
    }

    logDebug(`Removing effect and cleaning up resources for ${actor.metaWindow?.title || 'unknown window'}`);

    const customData = actor.rwcCustomData;
    const name = ROUNDED_CORNERS_EFFECT;

    // Remove the rounded corners effect
    unwrapActor(actor)?.remove_effect_by_name(name);

    // Clean up property bindings
    if (customData.propertyBindings) {
        logDebug(`Cleaning up ${customData.propertyBindings.length} property bindings`);
        for (const binding of customData.propertyBindings) {
            try {
                binding.unbind();
            } catch (e) {
                logDebug(`Failed to unbind property: ${e}`);
            }
        }
    }

    // Remove shadow actor and its constraints
    const shadow = customData.shadow;
    if (shadow) {
        try {
            // Clear all constraints first
            const constraints = shadow.get_constraints();
            for (const constraint of constraints) {
                shadow.remove_constraint(constraint);
            }

            // Remove from parent and destroy
            if (shadow.get_parent()) {
                global.windowGroup.remove_child(shadow);
            }

            logDebug('Destroying shadow actor');
            shadow.clear_effects();
            shadow.destroy();
        } catch (e) {
            logDebug(`Error cleaning up shadow actor: ${e}`);
        }
    }

    // Remove timeout handler
    const timeoutId = customData.unminimizedTimeoutId;
    if (timeoutId) {
        GLib.source_remove(timeoutId);
    }

    // Clear the custom data
    delete actor.rwcCustomData;
    logDebug('Cleanup completed for window');
}

export function onMinimize(actor: RoundedWindowActor): void {
    // Compatibility with "Compiz alike magic lamp effect".
    // When minimizing a window, disable the shadow to make the magic lamp effect
    // work.
    const magicLampEffect = actor.get_effect('minimize-magic-lamp-effect');
    const shadow = actor.rwcCustomData?.shadow;
    const roundedCornersEffect = getRoundedCornersEffect(actor);
    if (magicLampEffect && shadow && roundedCornersEffect) {
        logDebug('Minimizing with magic lamp effect');
        shadow.visible = false;
        roundedCornersEffect.enabled = false;
    }
}

export function onUnminimize(actor: RoundedWindowActor): void {
    // Compatibility with "Compiz alike magic lamp effect".
    // When unminimizing a window, wait until the effect is completed before
    // showing the shadow.
    const magicLampEffect = actor.get_effect('unminimize-magic-lamp-effect');
    const shadow = actor.rwcCustomData?.shadow;
    const roundedCornersEffect = getRoundedCornersEffect(actor);
    if (magicLampEffect && shadow && roundedCornersEffect) {
        shadow.visible = false;
        type Effect = Clutter.Effect & {timerId: Clutter.Timeline};
        const timer = (magicLampEffect as Effect).timerId;

        const id = timer.connect('new-frame', source => {
            // Wait until the effect is 98% completed
            if (source.get_progress() > 0.98) {
                logDebug('Unminimizing with magic lamp effect');
                shadow.visible = true;
                roundedCornersEffect.enabled = true;
                source.disconnect(id);
            }
        });

        return;
    }
}

export function onRestacked(): void {
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
function createShadow(actor: Meta.WindowActor): St.Bin {
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
    if (!shadow) {
        return;
    }

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
function refreshRoundedCorners(actor: RoundedWindowActor): void {
    const win = actor.metaWindow;

    const windowInfo = actor.rwcCustomData;
    const effect = getRoundedCornersEffect(actor);

    const hasEffect = effect && windowInfo;
    const shouldHaveEffect = shouldEnableEffect(win);

    if (!hasEffect) {
        // onAddEffect already skips windows that shouldn't have rounded corners.
        onAddEffect(actor);
        return;
    }

    if (!shouldHaveEffect) {
        onRemoveEffect(actor);
        return;
    }

    if (!effect.enabled) {
        effect.enabled = true;
    }

    // When window size is changed, update uniforms for corner rounding shader.
    const cfg = getRoundedCornersCfg(win);
    const windowContentOffset = computeWindowContentsOffset(win);
    effect.updateUniforms(
        windowScaleFactor(win),
        cfg,
        computeBounds(actor, windowContentOffset),
    );

    // Update BindConstraint for the shadow
    const shadow = windowInfo.shadow;
    const offsets = computeShadowActorOffset(actor, windowContentOffset);
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
        refreshRoundedCorners(actor);
    }
}
