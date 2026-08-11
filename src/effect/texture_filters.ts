/**
 * @file Picks the texture filters that are used to paint the offscreen
 * textures of window effects.
 *
 * Effects based on `Shell.GLSLEffect` are `Clutter.OffscreenEffect`s: the
 * actor is first rendered into an offscreen texture at its full, unscaled
 * size, and that texture is then painted in place of the actor. GNOME assumes
 * that the texture is painted at a 1:1 texel to pixel ratio, so it paints it
 * with `NEAREST` filtering. That assumption doesn't hold when the actor is
 * painted scaled down — most notably in the overview, where window previews
 * are clones of the window actor — and point sampling a full resolution
 * texture into a much smaller area turns window contents into speckles.
 *
 * Windows without effects don't have this problem, because GNOME picks the
 * filters for window textures based on how the window is actually being
 * painted. This does the same for our offscreen textures.
 */

import type Clutter from 'gi://Clutter';
import type Shell from 'gi://Shell';

import Cogl from 'gi://Cogl';
import Graphene from 'gi://Graphene';

/**
 * Below this scale, so much of the texture is thrown away that mipmaps are
 * needed to avoid aliasing — window previews in the workspace switcher, for
 * example, are painted at about 4% of their size, and point sampling those
 * turns window contents into random speckles.
 *
 * Between this and full size, plain linear filtering is sharper: mipmaps are
 * built by repeatedly halving the texture, so the smallest usable mipmap of a
 * window that is only slightly scaled down already has less detail than the
 * result needs.
 */
const MIPMAP_SCALE_THRESHOLD = 0.25;

/**
 * The scale at which a texture is considered to not be scaled down at all.
 * Projecting the texel corners is not exact, so a texture painted at its
 * native size can come out as a hair below 1.
 */
const UNSCALED = 0.999;

/**
 * The corners of a single texel, used to measure how large a texel of the
 * offscreen texture is on screen. They never change, so they are only
 * allocated once.
 */
const ORIGIN = Graphene.Vec4.alloc().init(0, 0, 0, 1);
const TEXEL_RIGHT = Graphene.Vec4.alloc().init(1, 0, 0, 1);
const TEXEL_DOWN = Graphene.Vec4.alloc().init(0, 1, 0, 1);

/**
 * Project a point onto the framebuffer that is being painted.
 *
 * @param point - The point to project.
 * @param transform - The combined modelview and projection matrix.
 * @param viewport - The viewport of the framebuffer, as `[x, y, width, height]`.
 * @returns The coordinates of the point on the framebuffer, in pixels.
 */
function project(
    point: Graphene.Vec4,
    transform: Graphene.Matrix,
    viewport: number[],
) {
    const projected = transform.transform_vec4(point);
    const w = projected.get_w();

    return [
        (projected.get_x() / w / 2 + 0.5) * viewport[2] + viewport[0],
        (projected.get_y() / w / 2 + 0.5) * viewport[3] + viewport[1],
    ];
}

/**
 * Measure how many pixels on screen a single texel of the texture that is
 * currently being painted takes up, according to the transform of the
 * framebuffer that is being painted into.
 *
 * This is the same computation that GNOME does in
 * `meta_actor_painting_untransformed()`: the corners of the painted area are
 * projected onto the framebuffer. Unlike the transform of the actor itself,
 * this accounts for the actor being painted as part of a clone, which is how
 * windows are shown in the overview.
 *
 * @param paintContext - The paint context that the texture is painted in.
 * @returns The size of a texel on screen, in pixels.
 */
function measureTexelSize(paintContext: Clutter.PaintContext) {
    const framebuffer = paintContext.get_framebuffer();
    const transform = framebuffer
        .get_modelview_matrix()
        .multiply(framebuffer.get_projection_matrix());
    const viewport = framebuffer.get_viewport4fv();

    const [originX, originY] = project(ORIGIN, transform, viewport);
    const [rightX, rightY] = project(TEXEL_RIGHT, transform, viewport);
    const [downX, downY] = project(TEXEL_DOWN, transform, viewport);

    return [
        Math.hypot(rightX - originX, rightY - originY),
        Math.hypot(downX - originX, downY - originY),
    ];
}

/**
 * Update the filters of the pipeline that paints the offscreen texture of an
 * effect, based on how much the texture is scaled down while being painted.
 *
 * This has to be called on every paint, because GNOME resets the filters of
 * the pipeline whenever the effect is painted.
 *
 * @param effect - The effect to update the filters of.
 * @param paintContext - The paint context that the effect is painted in.
 */
export function updateTextureFilters(
    effect: Shell.GLSLEffect,
    paintContext: Clutter.PaintContext,
) {
    const pipeline = effect.get_pipeline();
    if (!pipeline) {
        return;
    }

    const scale = Math.min(...measureTexelSize(paintContext));

    // The magnification filter is only used when a texture is painted larger
    // than it is, so the choice GNOME makes for it is always correct and is left
    // alone. It is also what the minification filter is restored to when
    // nothing is scaled down.
    const [, magFilter] = pipeline.get_layer_filters(0);

    let minFilter = magFilter;
    if (scale < MIPMAP_SCALE_THRESHOLD) {
        minFilter = Cogl.PipelineFilter.LINEAR_MIPMAP_LINEAR;
    } else if (scale < UNSCALED) {
        minFilter = Cogl.PipelineFilter.LINEAR;
    }

    pipeline.set_layer_filters(0, minFilter, magFilter);
}
