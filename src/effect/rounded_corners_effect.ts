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

export const RoundedCornersEffect = GObject.registerClass(
    {},
    class Effect extends Clutter.ShaderEffect {
        /**
         * GNOME 51 removed Shell.GLSLEffect, so the shader is now provided
         * as a Cogl.Snippet. This is only called once per class, no matter
         * how many windows use the effect.
         */
        vfunc_get_static_snippet() {
            const snippet = Cogl.Snippet.new(
                Cogl.SnippetHook.FRAGMENT,
                declarations,
                '',
            );
            // Post, not replace: the generated code that samples the window
            // texture into cogl_color_out must run first. This matches the
            // old add_glsl_snippet(..., is_replace=false) behavior.
            snippet.set_post(code);
            return snippet;
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
            // Unlike the removed Shell.GLSLEffect, Clutter.ShaderEffect
            // addresses uniforms by name instead of cached locations.
            this.#setUniform('bounds', 4, bounds);
            this.#setUniform('clipRadius', 1, [radius]);
            this.#setUniform('borderWidth', 1, [borderWidth]);
            this.#setUniform('borderColor', 4, borderColor);
            this.#setUniform('borderedAreaBounds', 4, borderedAreaBounds);
            this.#setUniform('borderedAreaClipRadius', 1, [borderedAreaRadius]);
            this.#setUniform('pixelStep', 2, pixelStep);
            this.#setUniform('exponent', 1, [exponent]);
            this.queue_repaint();
        }

        /**
         * Set a float uniform by name.
         *
         * The bundled @girs types predate the GNOME 51 Clutter.ShaderEffect
         * API, so the call goes through a structural type until upstream
         * publishes GNOME 51 types. Verified against the local
         * Clutter-51.gir: `set_uniform_float(name, n_components, value)`.
         */
        #setUniform(name: string, nComponents: number, value: number[]) {
            const effect = this as unknown as {
                // biome-ignore lint/style/useNamingConvention: Must match the C API name.
                set_uniform_float: (
                    name: string,
                    nComponents: number,
                    value: number[],
                ) => void;
            };
            effect.set_uniform_float(name, nComponents, value);
        }
    },
);
