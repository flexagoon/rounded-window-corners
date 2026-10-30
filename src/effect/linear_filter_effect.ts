/**
 * @file Applies linear interpolation to a window. This is used to make windows
 * in the overview look better.
 */

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';

// This effect only needs an offscreen pipeline to change its texture filters;
// it never had real shader code (Shell.GLSLEffect was used with an empty
// snippet). Since GNOME 51 removed Shell.GLSLEffect, extend OffscreenEffect
// directly. Its paint_target does not reset the layer filters, so setting
// them right before chaining up keeps working.
export const LinearFilterEffect = GObject.registerClass(
    {},
    class extends Clutter.OffscreenEffect {
        vfunc_paint_target(node: Clutter.PaintNode, ctx: Clutter.PaintContext) {
            this.get_pipeline()?.set_layer_filters(
                0,
                Cogl.PipelineFilter.LINEAR_MIPMAP_LINEAR,
                Cogl.PipelineFilter.LINEAR,
            );
            super.vfunc_paint_target(node, ctx);
        }
    },
);
