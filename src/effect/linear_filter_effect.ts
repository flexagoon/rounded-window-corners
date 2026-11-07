/**
 * @file Applies linear interpolation to a window. This is used to make windows
 * in the overview look better.
 */

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';

/**
 * A {@link Clutter.ShaderEffect} that applies linear interpolation to a
 * window. In GNOME Shell 51, `Shell.GLSLEffect` was removed, so shader effects
 * have to be implemented using `Clutter.ShaderEffect` and the
 * `vfunc_get_static_snippet` virtual instead.
 */
export class LinearFilterEffect extends Clutter.ShaderEffect {
    static {
        GObject.registerClass(LinearFilterEffect);
    }

    vfunc_get_static_snippet() {
        return Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, null, null);
    }

    vfunc_paint_target(node: Clutter.PaintNode, ctx: Clutter.PaintContext) {
        this.get_pipeline()?.set_layer_filters(
            0,
            Cogl.PipelineFilter.LINEAR_MIPMAP_LINEAR,
            Cogl.PipelineFilter.LINEAR,
        );
        super.vfunc_paint_target(node, ctx);
    }
}
