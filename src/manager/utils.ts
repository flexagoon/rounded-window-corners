/** @file Provides various utility functions used withing signal handling code. */

import type Clutter from 'gi://Clutter';
import type {RoundedCornersEffect} from '../effect/rounded_corners_effect.js';
import type {Bounds, RoundedCornerSettings} from '../utils/types.js';

import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import St from 'gi://St';

import {boxShadowCss} from '../utils/box_shadow.js';
import {
    APP_SHADOWS,
    ROUNDED_CORNERS_EFFECT,
    SHADOW_PADDING,
} from '../utils/constants.js';
import {readFile} from '../utils/file.js';
import {logDebug} from '../utils/log.js';
import {getPref} from '../utils/settings.js';

/**
 * Get the correct rounded corner setting for a window (custom settings if a
 * window has custom overrides, global settings otherwise).
 *
 * @param win - The window to get the settings for.
 * @returns The matching settings object.
 */
export function getRoundedCornersCfg(win: Meta.Window): RoundedCornerSettings {
    const globalCfg = getPref('global-rounded-corner-settings');
    const customCfgList = getPref('custom-rounded-corner-settings');

    const wmClass = win.get_wm_class_instance();
    if (
        wmClass == null ||
        !customCfgList[wmClass] ||
        !customCfgList[wmClass].enabled
    ) {
        return globalCfg;
    }

    return customCfgList[wmClass];
}

// Weird TypeScript magic :)
type RoundedCornersEffectType = InstanceType<typeof RoundedCornersEffect>;

/**
 * Get the Clutter.Effect object for the rounded corner effect of a specific
 * window.
 *
 * @param actor - The window actor to get the effect for.
 * @returns The corresponding Clutter.Effect object.
 */
export function getRoundedCornersEffect(
    actor: Meta.WindowActor,
): RoundedCornersEffectType | null {
    const name = ROUNDED_CORNERS_EFFECT;
    return actor.lastChild.get_effect(name) as RoundedCornersEffectType;
}

/**
 * Get the scaling factor of a window.
 *
 * @param win - The window to get the scaling factor for.
 * @returns The scaling factor of the window.
 */
export function windowScaleFactor(win: Meta.Window) {
    // When fractional scaling is enabled, always return 1
    const features = Gio.Settings.new('org.gnome.mutter').get_strv(
        'experimental-features',
    );
    if (
        Meta.is_wayland_compositor() &&
        features.includes('scale-monitor-framebuffer')
    ) {
        return 1;
    }

    const monitorIndex = win.get_monitor();
    return global.display.get_monitor_scale(monitorIndex);
}

/** Compute outer bounds for rounded corners of a window
 *
 * @param actor - The window actor to compute the bounds for.
 * @param [x, y, width, height] - The content offsets of the window actor.
 */
export function computeBounds(
    actor: Meta.WindowActor,
    [x, y, width, height]: [number, number, number, number],
): Bounds {
    const bounds = {
        x1: x + 1,
        y1: y + 1,
        x2: x + actor.width + width,
        y2: y + actor.height + height,
    };

    // Kitty draws its window decoration by itself, so we need to manually
    // clip its shadow and recompute the outer bounds for it.
    if (
        getPref('tweak-kitty-terminal') &&
        actor.metaWindow.get_client_type() === Meta.WindowClientType.WAYLAND &&
        actor.metaWindow.get_wm_class_instance() === 'kitty'
    ) {
        const [x1, y1, x2, y2] = APP_SHADOWS.kitty;
        const scale = windowScaleFactor(actor.metaWindow);
        bounds.x1 += x1 * scale;
        bounds.y1 += y1 * scale;
        bounds.x2 -= x2 * scale;
        bounds.y2 -= y2 * scale;
    }

    return bounds;
}

/**
 * Compute the offset of actual window contents from the entire window buffer.
 *
 * @param window - The window to compute the offset for.
 * @returns The content offsets of the window (x, y, width, height).
 */
export function computeWindowContentsOffset(
    window: Meta.Window,
): [number, number, number, number] {
    const bufferRect = window.get_buffer_rect();
    const frameRect = window.get_frame_rect();
    return [
        frameRect.x - bufferRect.x,
        frameRect.y - bufferRect.y,
        frameRect.width - bufferRect.width,
        frameRect.height - bufferRect.height,
    ];
}

/**
 * Compute the offset of the shadow actor for a window.
 *
 * @param actor - The window actor to compute the offset for.
 * @param [offsetX, offsetY, offsetWidth, offsetHeight] - The content offsets of the window actor.
 */
export function computeShadowActorOffset(
    actor: Meta.WindowActor,
    [offsetX, offsetY, offsetWidth, offsetHeight]: [
        number,
        number,
        number,
        number,
    ],
): number[] {
    const win = actor.metaWindow;
    const shadowPadding = SHADOW_PADDING * windowScaleFactor(win);

    return [
        offsetX - shadowPadding,
        offsetY - shadowPadding,
        2 * shadowPadding + offsetWidth,
        2 * shadowPadding + offsetHeight,
    ];
}

/** Update the CSS style of a shadow actor
 *
 * @param win - The window to update the style for.
 * @param actor - The shadow actor to update the style for.
 * @param borderRadius - The border radius of the shadow actor.
 * @param shadow - The shadow settings for the window.
 * @param padding - The padding of the shadow actor.
 */
export function updateShadowActorStyle(
    win: Meta.Window,
    actor: St.Bin,
    borderRadius = getPref('global-rounded-corner-settings').borderRadius,
    shadow = getPref('focused-shadow'),
    padding = getPref('global-rounded-corner-settings').padding,
) {
    const {left, right, top, bottom} = padding;

    // Increase border_radius when smoothing is on
    let adjustedBorderRadius = borderRadius;
    if (getPref('global-rounded-corner-settings') !== null) {
        adjustedBorderRadius *=
            1.0 + getPref('global-rounded-corner-settings').smoothing;
    }

    // If there are two monitors with different scale factors, the scale of
    // the window may be different from the scale that has to be applied in
    // the css, so we have to adjust the scale factor accordingly.

    const originalScale = St.ThemeContext.get_for_stage(
        global.stage as Clutter.Stage,
    ).scaleFactor;

    const scale = windowScaleFactor(win) / originalScale;

    actor.style = `padding: ${SHADOW_PADDING * scale}px;`;

    const child = actor.firstChild as St.Bin;

    child.style =
        win.maximizedHorizontally || win.maximizedVertically || win.fullscreen
            ? 'opacity: 0;'
            : `background: white;
               border-radius: ${adjustedBorderRadius * scale}px;
               ${boxShadowCss(shadow, scale)};
               margin: ${top * scale}px
                       ${right * scale}px
                       ${bottom * scale}px
                       ${left * scale}px;`;

    child.queue_redraw();
}

/**
 * Check whether a window should have rounded corners.
 *
 * @param win - The window to check.
 * @returns Whether the window should have rounded corners.
 */
export function shouldEnableEffect(
    win: Meta.Window & {_appType?: AppType},
): boolean {
    // Skip rounded corners for the DING (Desktop Icons NG) extension.
    //
    // https://extensions.gnome.org/extension/2087/desktop-icons-ng-ding/
    if (win.gtkApplicationId === 'com.rastersoft.ding') {
        return false;
    }

    // Skip blacklisted applications.
    const wmClass = win.get_wm_class_instance();
    if (wmClass == null) {
        logDebug(`Warning: wm_class_instance of ${win}: ${win.title} is null`);
        return false;
    }
    if (getPref('blacklist').includes(wmClass)) {
        return false;
    }

    // Only apply the effect to normal windows (skip menus, tooltips, etc.)
    if (
        win.windowType !== Meta.WindowType.NORMAL &&
        win.windowType !== Meta.WindowType.DIALOG &&
        win.windowType !== Meta.WindowType.MODAL_DIALOG
    ) {
        return false;
    }

    // Skip libhandy/libadwaita applications according to settings.
    const appType = win._appType ?? getAppType(win);
    win._appType = appType; // Cache the result.
    logDebug(`Check Type of window:${win.title} => ${appType}`);

    if (getPref('skip-libadwaita-app') && appType === 'LibAdwaita') {
        return false;
    }
    if (getPref('skip-libhandy-app') && appType === 'LibHandy') {
        return false;
    }

    // Skip maximized/fullscreen windows according to settings.
    const maximized = win.maximizedHorizontally || win.maximizedVertically;
    const fullscreen = win.fullscreen;
    const cfg = getRoundedCornersCfg(win);
    return (
        !(maximized || fullscreen) ||
        (maximized && !fullscreen && cfg.keepRoundedCorners.maximized) ||
        (fullscreen && cfg.keepRoundedCorners.fullscreen)
    );
}

type AppType = 'LibAdwaita' | 'LibHandy' | 'Other';

/**
 * Get the type of the application (LibHandy/LibAdwaita/Other).
 *
 * @param win - The window to get the type of.
 * @returns the type of the application.
 */
function getAppType(win: Meta.Window): AppType {
    try {
        // May throw a permission error.
        const contents = readFile(`/proc/${win.get_pid()}/maps`);

        if (contents.includes('libhandy-1.so')) {
            return 'LibHandy';
        }

        if (contents.includes('libadwaita-1.so')) {
            return 'LibAdwaita';
        }

        return 'Other';
    } catch (e) {
        logError(e);
        return 'Other';
    }
}
