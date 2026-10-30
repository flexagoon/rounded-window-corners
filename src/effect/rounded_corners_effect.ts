/** @file Binds the actual corner rounding shader to the windows. */

import type {Bounds, RoundedCornerSettings} from '../utils/types.js';

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';

import {readShader} from '../utils/file.js';
import {getPref} from '../utils/settings.js';

const [declarations, code] = await readShader(
    import.meta.url,
    'shader/rounded_corners.frag',
);

// GNOME 51 removed Shell.GLSLEffect. Clutter.ShaderEffect is the replacement:
// the snippet is built once per class, and uniforms are set by name (Clutter
// resolves and caches their locations internally on each paint).
export const RoundedCornersEffect = GObject.registerClass(
    {},
    class Effect extends Clutter.ShaderEffect {
        vfunc_get_static_snippet() {
            return Cogl.Snippet.new(
                Cogl.SnippetHook.FRAGMENT,
                declarations,
                code,
            );
        }

        /**
         * Update uniforms of the shader.
         * For more information, see the comments in the shader file.
         *
         * @param config - Rounded corners configuration
         * @param windowBounds - Bounds of the window without padding
         */
        updateUniforms(config: RoundedCornerSettings, windowBounds: Bounds) {
            const borderWidth = getPref('border-width');
            const borderColor = config.borderColor;

            const outerRadius = config.borderRadius;
            const {padding, smoothing} = config;

            const bounds = [
                windowBounds.x1 + padding.left,
                windowBounds.y1 + padding.top,
                windowBounds.x2 - padding.right,
                windowBounds.y2 - padding.bottom,
            ];

            const borderedAreaBounds = [
                bounds[0] + borderWidth,
                bounds[1] + borderWidth,
                bounds[2] - borderWidth,
                bounds[3] - borderWidth,
            ];

            let borderedAreaRadius = outerRadius - borderWidth;
            if (borderedAreaRadius < 0.001) {
                borderedAreaRadius = 0.0;
            }

            const pixelStep = [
                1 / this.actor.get_width(),
                1 / this.actor.get_height(),
            ];

            // This is needed for squircle corners
            let exponent = smoothing * 10 + 2;
            let radius = outerRadius * 0.5 * exponent;
            const maxRadius = Math.min(
                bounds[3] - bounds[0],
                bounds[4] - bounds[1],
            );
            if (radius > maxRadius) {
                exponent *= maxRadius / radius;
                radius = maxRadius;
            }
            borderedAreaRadius *= radius / outerRadius;

            this.#setUniforms(
                bounds,
                radius,
                borderWidth,
                borderColor,
                borderedAreaBounds,
                borderedAreaRadius,
                pixelStep,
                exponent,
            );
        }

        #setUniforms(
            bounds: number[],
            radius: number,
            borderWidth: number,
            borderColor: [number, number, number, number],
            borderedAreaBounds: number[],
            borderedAreaRadius: number,
            pixelStep: number[],
            exponent: number,
        ) {
            // ShaderEffect.set_uniform_float() is new in GNOME 51 and is not
            // in the @girs typings yet. Each directive below will turn into an
            // "unused @ts-expect-error" error once the typings are updated.
            // @ts-expect-error: TODO remove when @girs has GNOME 51 typings
            this.set_uniform_float('bounds', 4, bounds);
            // @ts-expect-error: TODO remove when @girs has GNOME 51 typings
            this.set_uniform_float('clipRadius', 1, [radius]);
            // @ts-expect-error: TODO remove when @girs has GNOME 51 typings
            this.set_uniform_float('borderWidth', 1, [borderWidth]);
            // @ts-expect-error: TODO remove when @girs has GNOME 51 typings
            this.set_uniform_float('borderColor', 4, borderColor);
            // @ts-expect-error: TODO remove when @girs has GNOME 51 typings
            this.set_uniform_float('borderedAreaBounds', 4, borderedAreaBounds);
            // @ts-expect-error: TODO remove when @girs has GNOME 51 typings
            this.set_uniform_float('borderedAreaClipRadius', 1, [
                borderedAreaRadius,
            ]);
            // @ts-expect-error: TODO remove when @girs has GNOME 51 typings
            this.set_uniform_float('pixelStep', 2, pixelStep);
            // @ts-expect-error: TODO remove when @girs has GNOME 51 typings
            this.set_uniform_float('exponent', 1, [exponent]);
            this.queue_repaint();
        }
    },
);
