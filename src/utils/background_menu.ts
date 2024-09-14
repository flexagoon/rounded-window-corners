/**
 * @file Handles adding and removing the RWC settings item in the desktop
 * context menu.
 *
 * XXX: It seems like this relies on GNOME Shell methods which aren't supposed
 *      to be public. Perhaps this would be removed in the future.
 */

import {
    Extension,
    gettext as _,
} from 'resource:///org/gnome/shell/extensions/extension.js';

import type Clutter from 'gi://Clutter';
import type {
    PopupMenu,
    PopupMenuItem,
} from 'resource:///org/gnome/shell/ui/popupMenu.js';

/**
 * Desktop background context menu.
 *
 * https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/backgroundMenu.js
 */
type BackgroundMenu = PopupMenu & {
    _getMenuItems(): PopupMenuItem[];
};

/**
 * Clutter Actor of the desktop background.
 *
 * https://gjs-docs.gnome.org/meta15~15/meta.backgroundactor
 */
type BackgroundActor = Clutter.Actor & {
    _backgroundMenu: BackgroundMenu;
};

/** Enable the "rounded corner settings" item in desktop context menu. */
export function enableBackgroundMenuItem() {
    for (const background of global.windowGroup.firstChild.get_children()) {
        const menu = (background as BackgroundActor)._backgroundMenu;
        addItemToMenu(menu);
    }
}

/** Disable the "rounded corner settings" item in desktop context menu. */
export function disableBackgroundMenuItem() {
    for (const background of global.windowGroup.firstChild.get_children()) {
        const menu = (background as BackgroundActor)._backgroundMenu;
        removeItemFromMenu(menu);
    }
}

/**
 * Add the menu item to the background menu.
 *
 * @param menu - BackgroundMenu to add the item to.
 */
function addItemToMenu(menu: BackgroundMenu) {
    const rwcMenuItemName = _('Rounded Corners Settings...');

    // Check if the item already exists
    for (const item of menu._getMenuItems()) {
        if (item.label?.text === rwcMenuItemName) {
            return;
        }
    }

    menu.addAction(rwcMenuItemName, () => {
        const extension = Extension.lookupByURL(import.meta.url) as Extension;
        extension.openPreferences();
    });
}

/**
 * Remove the menu item from the background menu.
 *
 * @param menu - BackgroundMenu to remove the item from.
 */
function removeItemFromMenu(menu: BackgroundMenu) {
    const items = menu._getMenuItems();
    const rwcMenuItemName = _('Rounded Corners Settings...');
    for (const item of items) {
        if (item.label?.text === rwcMenuItemName) {
            item.destroy();
            break;
        }
    }
}