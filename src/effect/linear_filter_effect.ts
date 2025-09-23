/**
 * @file Applies linear interpolation to a window. This is used to make windows
 * in the overview look better.
 */

import type Clutter from 'gi://Clutter';

import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

export const LinearFilterEffect = GObject.registerClass(
    {},
    class extends Shell.GLSLEffect {
        vfunc_build_pipeline(): void {
            this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, '', '', false);
        }

        vfunc_paint_target(
            node: Clutter.PaintNode,
            ctx: Clutter.PaintContext,
        ): void {
            this.get_pipeline()?.set_layer_filters(
                0,
                Cogl.PipelineFilter.LINEAR_MIPMAP_LINEAR,
                Cogl.PipelineFilter.LINEAR,
            );
            super.vfunc_paint_target(node, ctx);
        }
    },
);
