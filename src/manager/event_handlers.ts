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
    APP_SHADOWS,
    CLIP_SHADOW_EFFECT,
    ROUNDED_CORNERS_EFFECT,
    SHADOW_PADDING,
} from '../utils/constants.js';
import {_log} from '../utils/log.js';
import {settings} from '../utils/settings.js';
import * as types from '../utils/types.js';
import {
    WindowScaleFactor,
    computeWindowContentsOffset,
    getRoundedCornersCfg,
    get_rounded_corners_effect as getRoundedCornersEffect,
    shouldEnableEffect,
} from '../utils/ui.js';

import type {SchemasKeys} from '../utils/settings.js';
import type {ExtensionsWindowActor} from '../utils/types.js';

export function onAddEffect(actor: ExtensionsWindowActor) {
    _log(`opened: ${actor?.metaWindow.title}: ${actor}`);

    const win = actor.metaWindow;

    if (!shouldEnableEffect(win)) {
        return;
    }

    unwrapActor(actor)?.add_effect_with_name(
        ROUNDED_CORNERS_EFFECT,
        new RoundedCornersEffect(),
    );

    // Some applications on X11 use server-side decorations, so their shadows
    // are drawn my Mutter rather than by the application itself. This disables
    // the shadow for those windows.
    if (actor.shadow_mode !== undefined) {
        actor.shadow_mode = Meta.ShadowMode.FORCED_OFF;
    }

    const shadow = createShadow(actor);

    // Bind properties of the window to the shadow actor.
    const SYNC_CREATE = GObject.BindingFlags.SYNC_CREATE;
    for (const prop of [
        'pivot-point',
        'translation-x',
        'translation-y',
        'scale-x',
        'scale-y',
        'visible',
    ]) {
        actor.bind_property(prop, shadow, prop, SYNC_CREATE);
    }

    // Store shadow, app type, visible binding, so that we can access them later
    actor.__rwcRoundedWindowInfo = {
        shadow,
        unminimizedTimeoutId: 0,
    };

    // Run those handlers once to make sure the effect is applied correctly.
    refreshRoundedCorners(actor);
    refreshShadow(actor);
}

export function onRemoveEffect(actor: ExtensionsWindowActor): void {
    const name = ROUNDED_CORNERS_EFFECT;
    unwrapActor(actor)?.remove_effect_by_name(name);

    // Restore shadow for x11 windows
    if (actor.shadow_mode) {
        actor.shadow_mode = Meta.ShadowMode.AUTO;
    }

    // Remove shadow actor
    const shadow = actor.__rwcRoundedWindowInfo?.shadow;
    if (shadow) {
        global.windowGroup.remove_child(shadow);
        shadow.clear_effects();
        shadow.destroy();
    }

    // Remove all timeout handler
    const timeoutId = actor.__rwcRoundedWindowInfo?.unminimizedTimeoutId;
    if (timeoutId) {
        GLib.source_remove(timeoutId);
    }
    delete actor.__rwcRoundedWindowInfo;
}

export function onMinimize(actor: ExtensionsWindowActor): void {
    // Compatibility with "Compiz alike magic lamp effect".
    // When minimizing a window, disable the shadow to make the magic lamp effect
    // work.
    const magicLampEffect = actor.get_effect('minimize-magic-lamp-effect');
    const shadow = actor.__rwcRoundedWindowInfo?.shadow;
    const roundedCornersEffect = getRoundedCornersEffect(actor);
    if (magicLampEffect && shadow && roundedCornersEffect) {
        _log('Minimizing with magic lamp effect');
        shadow.visible = false;
        roundedCornersEffect.enabled = false;
    }
}

export function onUnminimize(actor: ExtensionsWindowActor): void {
    // Compatibility with "Compiz alike magic lamp effect".
    // When unminimizing a window, wait until the effect is completed before
    // showing the shadow.
    const magicLampEffect = actor.get_effect('unminimize-magic-lamp-effect');
    const shadow = actor.__rwcRoundedWindowInfo?.shadow;
    const roundedCornersEffect = getRoundedCornersEffect(actor);
    if (magicLampEffect && shadow && roundedCornersEffect) {
        shadow.visible = false;
        type Effect = Clutter.Effect & {timerId: Clutter.Timeline};
        const timer = (magicLampEffect as Effect).timerId;

        const id = timer.connect('new-frame', source => {
            // Wait until the effect is 98% completed
            if (source.get_progress() > 0.98) {
                _log('Unminimizing with magic lamp effect');
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
        const shadow = (actor as ExtensionsWindowActor).__rwcRoundedWindowInfo
            ?.shadow;

        if (!(actor.visible && shadow)) {
            continue;
        }

        global.windowGroup.set_child_below_sibling(shadow, actor);
    }
}

export const onSizeChanged = refreshRoundedCorners;

export const onFocusChanged = refreshShadow;

export function onSettingsChanged(key: SchemasKeys): void {
    switch (key) {
        case 'skip-libadwaita-app':
        case 'skip-libhandy-app':
        case 'black-list':
            refreshEffectState();
            break;
        case 'focused-shadow':
        case 'unfocused-shadow':
            refreshAllShadows();
            break;
        case 'global-rounded-corner-settings':
        case 'custom-rounded-corner-settings':
        case 'border-color':
        case 'border-width':
        case 'tweak-kitty-terminal':
            refreshAllRoundedCorners();
            break;
        default:
    }
}

/**
 * Get the actor that rounded corners should be applied to.
 * In Wayland, the effect is applied to WindowActor, but in X11, it is applied
 * to WindowActor.first_child.
 *
 * @param actor - The window actor to unwrap.
 * @returns The correct actor that the effect should be applied to.
 */
function unwrapActor(actor: Meta.WindowActor): Clutter.Actor | null {
    const type = actor.metaWindow.get_client_type();
    return type === Meta.WindowClientType.X11 ? actor.get_first_child() : actor;
}

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

/** Compute outer bounds for rounded corners of a window
 *
 * @param actor - The window actor to compute the bounds for.
 * @param [x, y, width, height] - The content offsets of the window actor.
 * */
function computeBounds(
    actor: Meta.WindowActor,
    [x, y, width, height]: [number, number, number, number],
): types.Bounds {
    const bounds = {
        x1: x + 1,
        y1: y + 1,
        x2: x + actor.width + width,
        y2: y + actor.height + height,
    };

    // Kitty draws its window decoration by itself, so we need to manually
    // clip its shadow and recompute the outer bounds for it.
    if (settings().tweak_kitty_terminal) {
        if (
            actor.metaWindow.get_client_type() ===
                Meta.WindowClientType.WAYLAND &&
            actor.metaWindow.get_wm_class_instance() === 'kitty'
        ) {
            const [x1, y1, x2, y2] = APP_SHADOWS.kitty;
            const scale = WindowScaleFactor(actor.metaWindow);
            bounds.x1 += x1 * scale;
            bounds.y1 += y1 * scale;
            bounds.x2 -= x2 * scale;
            bounds.y2 -= y2 * scale;
        }
    }

    return bounds;
}

/**
 * Compute the offset of the shadow actor for a window.
 *
 * @param actor - The window actor to compute the offset for.
 * @param [offsetX, offsetY, offsetWidth, offsetHeight] - The content offsets of the window actor.
 */
function computeShadowActorOffset(
    actor: Meta.WindowActor,
    [offsetX, offsetY, offsetWidth, offsetHeight]: [
        number,
        number,
        number,
        number,
    ],
): number[] {
    const win = actor.metaWindow;
    const shadowPadding = SHADOW_PADDING * WindowScaleFactor(win);

    return [
        offsetX - shadowPadding,
        offsetY - shadowPadding,
        2 * shadowPadding + offsetWidth,
        2 * shadowPadding + offsetHeight,
    ];
}

/** Update css style of a shadow actor
 *
 * @param win - The window to update the style for.
 * @param actor - The shadow actor to update the style for.
 * @param borderRadiusRaw - The border radius of the shadow actor.
 * @param shadow - The shadow settings for the window.
 * @param padding - The padding of the shadow actor.
 * */
function updateShadowActorStyle(
    win: Meta.Window,
    actor: St.Bin,
    borderRadiusRaw = settings().global_rounded_corner_settings.border_radius,
    shadow = settings().focused_shadow,
    padding = settings().global_rounded_corner_settings.padding,
) {
    const {left, right, top, bottom} = padding;

    // Increase border_radius when smoothing is on
    let borderRadius = borderRadiusRaw;
    if (settings().global_rounded_corner_settings !== null) {
        borderRadius *=
            1.0 + settings().global_rounded_corner_settings.smoothing;
    }

    // If there are two monitors with different scale factors, the scale of
    // the window may be different from the scale that has to be applied in
    // the css, so we have to adjust the scale factor accordingly.

    const originalScale = St.ThemeContext.get_for_stage(
        global.stage as Clutter.Stage,
    ).scaleFactor;

    const scale = WindowScaleFactor(win) / originalScale;

    actor.style = `padding: ${SHADOW_PADDING * scale}px;`;

    const child = actor.firstChild as St.Bin;

    child.style =
        win.maximizedHorizontally || win.maximizedVertically || win.fullscreen
            ? 'opacity: 0;'
            : `background: white;
               border-radius: ${borderRadius * scale}px;
               ${types.box_shadow_css(shadow, scale)};
               margin: ${top * scale}px
                       ${right * scale}px
                       ${bottom * scale}px
                       ${left * scale}px;`;

    child.queue_redraw();
}

/** Traverse all windows, and check if they should have rounded corners. */
function refreshEffectState() {
    for (const actor of global.get_window_actors()) {
        const shouldHaveEffect = shouldEnableEffect(actor.metaWindow);
        const hasEffect = getRoundedCornersEffect(actor) != null;

        if (shouldHaveEffect && !hasEffect) {
            onAddEffect(actor);
            refreshRoundedCorners(actor);
            return;
        }

        if (!shouldHaveEffect && hasEffect) {
            onRemoveEffect(actor);
            return;
        }
    }
}

/**
 * Refresh the shadow actor for a window.
 *
 * @param actor - The window actor to refresh the shadow for.
 */
function refreshShadow(actor: ExtensionsWindowActor) {
    const win = actor.metaWindow;
    const shadow = actor.__rwcRoundedWindowInfo?.shadow;

    const effect = getRoundedCornersEffect(actor);
    if (!effect) return
    const cfg = getRoundedCornersCfg(win);
    const windowContentOffset = computeWindowContentsOffset(win);
    const col = win.appears_focused
      ? settings ().border_color
      : settings ().unfocused_border_color;
    effect.update_uniforms(
        WindowScaleFactor(win),
        cfg,
        computeBounds(actor, windowContentOffset),
        {
            width: settings().border_width,
            color: col,
        },
    );

    if (!shadow) {
        return;
    }

    const shadowSettings = win.appears_focused
        ? settings().focused_shadow
        : settings().unfocused_shadow;

    const {border_radius, padding} = getRoundedCornersCfg(win);

    updateShadowActorStyle(win, shadow, border_radius, shadowSettings, padding);
}

/** Refresh the style of all shadow actors */
function refreshAllShadows() {
    global.get_window_actors().forEach(refreshShadow);
}

/**
 * Refresh rounded corners settings for a window.
 *
 * @param actor - The window actor to refresh the rounded corners settings for.
 */
function refreshRoundedCorners(actor: ExtensionsWindowActor): void {
    const win = actor.metaWindow;

    const windowInfo = actor.__rwcRoundedWindowInfo;
    const effect = getRoundedCornersEffect(actor);

    if (!(effect && windowInfo)) {
        return;
    }

    // Skip rounded corners when window is fullscreen & maximize
    const cfg = getRoundedCornersCfg(win);
    const shouldHaveEffect = shouldEnableEffect(win);

    if (effect.enabled !== shouldHaveEffect) {
        effect.enabled = shouldHaveEffect;
        refreshShadow(actor);
    }

    const windowContentOffset = computeWindowContentsOffset(win);

    const col = win.appears_focused
      ? settings ().border_color
      : settings ().unfocused_border_color
    // When window size is changed, update uniforms for corner rounding shader.
    effect.update_uniforms(
        WindowScaleFactor(win),
        cfg,
        computeBounds(actor, windowContentOffset),
        {
            width: settings().border_width,
            color: col,
        },
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
}

/** Refresh rounded corners settings for all windows. */
function refreshAllRoundedCorners() {
    global.get_window_actors().forEach(refreshRoundedCorners);
    refreshAllShadows();
}
