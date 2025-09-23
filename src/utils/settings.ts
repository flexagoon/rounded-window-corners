/**
 * @file Provides wrappers around the GSettings object that add type safety and
 * automatically convert values between JS types and GLib Variant types that
 * are used for storing GSettings.
 */

import type Gio from 'gi://Gio';
import type GObject from 'gi://GObject';
import type {
    BoxShadow,
    CustomRoundedCornerSettings,
    RoundedCornerSettings,
} from './types.js';

import GLib from 'gi://GLib';

import {logDebug} from './log.js';

/** Mapping of schema keys to the JS representation of their type. */
type Schema = {
    'settings-version': number;
    blacklist: string[];
    'skip-libadwaita-app': boolean;
    'skip-libhandy-app': boolean;
    'border-width': number;
    'global-rounded-corner-settings': RoundedCornerSettings;
    'custom-rounded-corner-settings': CustomRoundedCornerSettings;
    'focused-shadow': BoxShadow;
    'unfocused-shadow': BoxShadow;
    'debug-mode': boolean;
    'tweak-kitty-terminal': boolean;
    'enable-preferences-entry': boolean;
};

/** All existing schema keys. */
export type SchemaKey = keyof Schema;

/** Mapping of schema keys to their GLib Variant type string */
export const Schema = {
    'settings-version': 'u',
    blacklist: 'as',
    'skip-libadwaita-app': 'b',
    'skip-libhandy-app': 'b',
    'border-width': 'i',
    'global-rounded-corner-settings': 'a{sv}',
    'custom-rounded-corner-settings': 'a{sv}',
    'focused-shadow': 'a{si}',
    'unfocused-shadow': 'a{si}',
    'debug-mode': 'b',
    'tweak-kitty-terminal': 'b',
    'enable-preferences-entry': 'b',
};

/** The raw GSettings object for direct manipulation. */
export let prefs: Gio.Settings;

/**
 * Initialize the {@link prefs} object with existing GSettings.
 *
 * @param gSettings - GSettings to initialize the prefs with.
 */
export function initPrefs(gSettings: Gio.Settings) {
    resetOutdated(gSettings);
    prefs = gSettings;
}

/** Delete the {@link prefs} object for garbage collection. */
export function uninitPrefs() {
    (prefs as Gio.Settings | null) = null;
}

/**
 * Get a preference from GSettings and convert it from a GLib Variant to a
 * JavaScript type.
 *
 * @param key - The key of the preference to get.
 * @returns The value of the preference.
 */
export function getPref<K extends SchemaKey>(key: K): Schema[K] {
    return prefs.get_value(key).recursiveUnpack() as Schema[K];
}

/**
 * Pack a value into a GLib Variant type and store it in GSettings.
 *
 * @param key - The key of the preference to set.
 * @param value - The value to set the preference to.
 */
export function setPref<K extends SchemaKey>(key: K, value: Schema[K]) {
    logDebug(`Settings pref: ${key}, ${value}`);
    let variant: GLib.Variant;

    if (key === 'global-rounded-corner-settings') {
        variant = packRoundedCornerSettings(value as RoundedCornerSettings);
    } else if (key === 'custom-rounded-corner-settings') {
        variant = packCustomRoundedCornerSettings(
            value as CustomRoundedCornerSettings,
        );
    } else {
        // @ts-expect-error
        // TypeScript can't figure out that the value will always match the glib schema type here
        variant = new GLib.Variant(Schema[key], value);
    }

    prefs.set_value(key, variant);
}

/** A simple type-checked wrapper around {@link prefs.bind} */
export function bindPref(
    key: SchemaKey,
    object: GObject.Object,
    property: string,
    flags: Gio.SettingsBindFlags,
) {
    prefs.bind(key, object, property, flags);
}

/**
 * Reset setting keys that changed their type between releases
 * to avoid conflicts.
 *
 * @param prefs the GSettings object to clean.
 */
function resetOutdated(prefs: Gio.Settings) {
    const lastVersion = 7;
    const currentVersion = prefs
        .get_user_value('settings-version')
        ?.recursiveUnpack() as number | undefined;

    if (!currentVersion || currentVersion < lastVersion) {
        if (prefs.list_keys().includes('black-list')) {
            prefs.reset('black-list');
        }
        prefs.reset('global-rounded-corner-settings');
        prefs.reset('custom-rounded-corner-settings');
        if (prefs.list_keys().includes('border-color')) {
            prefs.reset('border-color');
        }
        prefs.reset('focused-shadow');
        prefs.reset('unfocused-shadow');
        prefs.set_uint('settings-version', lastVersion);
    }
}

/**
 * Pack rounded corner settings into a GLib Variant object.
 *
 * Since rounded corner settings are stored as a dictionary where the values
 * are of different types, it can't be automatically packed into a variant.
 * Instead, we need to pack each of the values into the correct variant
 * type, and only then pack the entire dictionary into a variant with type
 * "a{sv}" (dictionary with string keys and arbitrary variant values).
 *
 * @param settings - The rounded corner settings to pack.
 * @returns The packed GLib Variant object.
 */
function packRoundedCornerSettings(settings: RoundedCornerSettings) {
    const padding = new GLib.Variant('a{su}', settings.padding);
    const keepRoundedCorners = new GLib.Variant(
        'a{sb}',
        settings.keepRoundedCorners,
    );
    const borderRadius = GLib.Variant.new_uint32(settings.borderRadius);
    const smoothing = GLib.Variant.new_double(settings.smoothing);
    const borderColor = new GLib.Variant('(dddd)', settings.borderColor);
    const enabled = GLib.Variant.new_boolean(settings.enabled);

    const variantObject = {
        padding: padding,
        keepRoundedCorners: keepRoundedCorners,
        borderRadius: borderRadius,
        smoothing: smoothing,
        borderColor: borderColor,
        enabled: enabled,
    };

    return new GLib.Variant('a{sv}', variantObject);
}

/**
 * Pack custom rounded corner overrides into a GLib Variant object.
 *
 * Custom rounded corner settings are stored as a dictionary from window
 * wm_class to {@link RoundedCornerSettings} objects. See the documentation for
 * {@link packRoundedCornerSettings} for more information on why manual packing
 * is needed here.
 *
 * @param settings - The custom rounded corner setting overrides to pack.
 * @returns The packed GLib Variant object.
 */
function packCustomRoundedCornerSettings(
    settings: CustomRoundedCornerSettings,
) {
    const packedSettings: Record<string, GLib.Variant<'a{sv}'>> = {};
    for (const [wmClass, windowSettings] of Object.entries(settings)) {
        packedSettings[wmClass] = packRoundedCornerSettings(windowSettings);
    }

    const variant = new GLib.Variant('a{sv}', packedSettings);
    return variant;
}
