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
        vfunc_get_static_snippet() {
            const snippet = Cogl.Snippet.new(
                Cogl.SnippetHook.FRAGMENT,
                declarations,
                '',
            );
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

            const {width, height} = this.actor;

            // If the actor is clipped (e.g. by PaperWM), the texture it's
            // painted to covers the clip area instead of the actor.
            const [clipX, clipY, clipWidth, clipHeight] = this.actor.hasClip
                ? this.actor.get_clip()
                : [0, 0, width, height];

            // Scale and offset relative to the texture of an unclipped actor.
            // Clutter pads the texture by 3 pixels.
            const scaleX = (clipWidth + 3) / (width + 3);
            const scaleY = (clipHeight + 3) / (height + 3);
            const offsetX = (clipX * width) / (width + 3);
            const offsetY = (clipY * height) / (height + 3);

            const bounds = [
                windowBounds.x1 + padding.left - offsetX,
                windowBounds.y1 + padding.top - offsetY,
                windowBounds.x2 - padding.right - offsetX,
                windowBounds.y2 - padding.bottom - offsetY,
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

            const pixelStep = [1 / (width * scaleX), 1 / (height * scaleY)];

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

            this.set_uniform_float('bounds', 4, bounds);
            this.set_uniform_float('clipRadius', 1, [radius]);
            this.set_uniform_float('borderWidth', 1, [borderWidth]);
            this.set_uniform_float('borderColor', 4, borderColor);
            this.set_uniform_float('borderedAreaBounds', 4, borderedAreaBounds);
            this.set_uniform_float('borderedAreaClipRadius', 1, [
                borderedAreaRadius,
            ]);
            this.set_uniform_float('pixelStep', 2, pixelStep);
            this.set_uniform_float('exponent', 1, [exponent]);
            this.queue_repaint();
        }
    },
);
