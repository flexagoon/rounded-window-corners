/** @file Provides a function to add a shadow actor to a window preview in the overview. */

import type Meta from 'gi://Meta';
import type {WindowPreview} from 'resource:///org/gnome/shell/ui/windowPreview.js';
import type {RoundedWindowActor} from '../utils/types.js';

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';

import {overview} from 'resource:///org/gnome/shell/ui/main.js';

import {LinearFilterEffect} from '../effect/linear_filter_effect.js';
import {shouldEnableEffect, windowScaleFactor} from '../manager/utils.js';
import {OVERVIEW_SHADOW_ACTOR, SHADOW_PADDING} from '../utils/constants.js';
import {logDebug} from '../utils/log.js';

/**
 * Add a shadow actor to a window preview in the overview.
 * @param window - The window that the preview is of.
 * @param self - The window preview that the shadow actor is added to.
 */
export function addShadowInOverview(window: Meta.Window, self: WindowPreview) {
    // Create a new error object and use it to get the call stack of
    // the function.
    const stack = new Error().stack?.trim();
    if (
        stack === undefined ||
        stack.indexOf('_updateAttachedDialogs') !== -1 ||
        stack.indexOf('addDialog') !== -1
    ) {
        // If the window is an attached dialog, skip it.
        return;
    }

    // If the original window doesn't have rounded corners or a shadow,
    // we don't need to do anything, so we can skip it.
    const hasRoundedCorners = shouldEnableEffect(window);
    const windowActor = window.get_compositor_private() as RoundedWindowActor;
    const shadow = windowActor.rwcCustomData?.shadow;
    if (!(hasRoundedCorners && shadow)) {
        return;
    }

    logDebug(`Adding shadow for ${window.title} in overview`);

    // windowContainer has the actual contents of the window preview
    const windowContainer = self.windowContainer;
    let firstChild: Clutter.Actor | null = windowContainer.firstChild;

    // Apply liear interpolation to the window preview to make it look
    // better (there's an upstream GNOME bug causing windows to be blurry,
    // this makes the effect less noticeable)
    firstChild?.add_effect(new LinearFilterEffect());

    // Create a clone of the window's shadow actor and add it to the preview
    const shadowActorClone = new OverviewShadowActorClone(shadow, self);
    windowContainer.bind_property('scale-x', shadowActorClone, 'scale-x', 1);
    windowContainer.bind_property('scale-y', shadowActorClone, 'scale-y', 1);
    self.insert_child_below(shadowActorClone, windowContainer);

    // Disconnect all signals when the window preview is destroyed
    const connection = self.connect('destroy', () => {
        shadowActorClone.destroy();
        firstChild?.clear_effects();
        firstChild = null;

        self.disconnect(connection);
    });
}

/**
 * A clone of a window's shadow actor that is shown in the overview. Binds the
 * size of the shadow to the size of the window preview in the overview.
 */
const OverviewShadowActorClone = GObject.registerClass(
    {},
    class extends Clutter.Clone {
        windowPreview: WindowPreview;

        /**
         * Create the clone of the shadow actor.
         * @param source the shadow actor to clone.
         * @param windowPreview the window preview that the clone is applied to.
         */
        constructor(source: Clutter.Actor, windowPreview: WindowPreview) {
            super({
                source, // the source shadow actor shown in desktop
                name: OVERVIEW_SHADOW_ACTOR,
                pivotPoint: new Graphene.Point({x: 0.5, y: 0.5}),
            });

            this.windowPreview = windowPreview;
        }

        /**
         * Recompute the position and size of shadow in overview
         * This virtual function will be called when we:
         * - entering/closing overview
         * - dragging window
         * - position and size of window preview in overview changed
         * @param box The bound box of shadow actor
         */
        vfunc_allocate(box: Clutter.ActorBox): void {
            // The layout box of the window has to be obtained in a different
            // way when leaving the overview (eg. by pressing ESC). I have no
            // idea why this is the case, but oh well. GNOME.
            const leavingOverview =
                overview._overview.controls._workspacesDisplay._leavingOverview;
            const windowContainerBox = leavingOverview
                ? this.windowPreview.windowContainer.get_allocation_box()
                : this.windowPreview.get_allocation_box();

            const metaWindow =
                this.windowPreview._windowActor.get_meta_window();
            if (!metaWindow) {
                return;
            }

            // Scale the shadow by the same scale factor that the window preview
            // is scaled by.
            const containerScaleFactor =
                windowContainerBox.get_width() /
                metaWindow.get_frame_rect().width;
            const paddings =
                SHADOW_PADDING *
                containerScaleFactor *
                windowScaleFactor(metaWindow);

            // Setup the bounding box of the shadow actor.
            box.set_origin(-paddings, -paddings);
            box.set_size(
                windowContainerBox.get_width() + 2 * paddings,
                windowContainerBox.get_height() + 2 * paddings,
            );

            // Apply the bounding box.
            super.vfunc_allocate(box);
        }
    },
);
