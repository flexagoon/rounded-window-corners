/** @file Provides functions for handling shadows during workspace switching. */

import type GObject from 'gi://GObject';
import type {WorkspaceAnimationController} from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';
import type {RoundedWindowActor} from '../utils/types.js';

import Clutter from 'gi://Clutter';

import {getRoundedCornersEffect, windowScaleFactor} from '../manager/utils.js';
import {SHADOW_PADDING} from '../utils/constants.js';

type WsAnimationActor = Clutter.Actor & {shadowClone?: Clutter.Actor};

/**
 * Add shadows to windows when switching workspaces.
 * @param self - The workspace animation controller.
 * @returns A set of connections to be disconnected on extension disable.
 */
export function addShadowsInWorkspaceSwitch(
    self: WorkspaceAnimationController,
) {
    const connections: {object: GObject.Object; id: number}[] = [];

    for (const monitor of self._switchData.monitors) {
        for (const workspace of monitor._workspaceGroups) {
            const windowRecords = workspace._windowRecords;

            // Switching workspaces messes with the window stacking order,
            // so the shadows need to be restacked in order to always be
            // behind the window.
            const restackedConnection = global.display.connect(
                'restacked',
                () => {
                    for (const {clone} of windowRecords) {
                        const shadow = (clone as WsAnimationActor).shadowClone;
                        if (shadow) {
                            workspace.set_child_below_sibling(shadow, clone);
                        }
                    }
                },
            );
            const destroyConnection = workspace.connect('destroy', () => {
                global.display.disconnect(restackedConnection);
                workspace.disconnect(destroyConnection);
            });

            connections.push({object: global.display, id: restackedConnection});
            connections.push({object: workspace, id: destroyConnection});

            for (const {windowActor: actor, clone} of windowRecords) {
                const win = actor.metaWindow;

                // Skip windows that don't have a shadow or an enabled RWC effect.
                const shadow = (actor as RoundedWindowActor).rwcCustomData
                    ?.shadow;
                const enabled = getRoundedCornersEffect(actor)?.enabled;
                if (!(shadow && enabled)) {
                    continue;
                }

                // Clone the shadow actor and set its dimensions to match the
                // window actor size.
                const shadowClone = new Clutter.Clone({
                    source: shadow,
                });
                const paddings = SHADOW_PADDING * windowScaleFactor(win);

                const frameRect = win.get_frame_rect();

                shadowClone.width = frameRect.width + paddings * 2;
                shadowClone.height = frameRect.height + paddings * 2;
                shadowClone.x = clone.x + frameRect.x - actor.x - paddings;
                shadowClone.y = clone.y + frameRect.y - actor.y - paddings;

                // Compatibility with Desktop Cube
                const notifyId = clone.connect('notify::translation-z', () => {
                    shadowClone.translationZ = clone.translationZ - 0.05;
                });
                const destroyConnection = clone.connect('destroy', () => {
                    clone.disconnect(notifyId);
                    clone.disconnect(destroyConnection);
                });

                connections.push({object: clone, id: notifyId});
                connections.push({object: clone, id: destroyConnection});

                // Store the reference to the shadow clone. This allows restacking
                // them, as you can see at the top of this function.
                (clone as WsAnimationActor).shadowClone = shadowClone;
                clone.bind_property('visible', shadowClone, 'visible', 0);

                workspace.insert_child_below(shadowClone, clone);
            }
        }
    }

    return connections;
}

/**
 * Delete shadow clones after switching workspaces.
 * @param self - The workspace animation controller.
 */
export function removeShadowsAfterWorkspaceSwitch(
    self: WorkspaceAnimationController,
) {
    for (const monitor of self._switchData.monitors) {
        for (const workspace of monitor._workspaceGroups) {
            for (const {clone} of workspace._windowRecords) {
                (clone as WsAnimationActor).shadowClone?.destroy();
                delete (clone as WsAnimationActor).shadowClone;
            }
        }
    }
}
