/**
 * @file Applies linear interpolation to a window. This is used to make windows
 * in the overview look better.
 */

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';

export const LinearFilterEffect = GObject.registerClass(
    {},
    class extends Clutter.ShaderEffect {
        vfunc_get_static_snippet() {
            // This effect doesn't modify the shader itself, it only changes
            // the texture filtering, so an empty snippet is enough.
            return Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, '', '');
        }

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
