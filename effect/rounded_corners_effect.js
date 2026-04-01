/** @file Binds the actual corner rounding shader to the windows. */
var _a;
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import { readShader } from '../utils/file.js';
import { getPref } from '../utils/settings.js';
const [declarations, code] = readShader(import.meta.url, 'shader/rounded_corners.frag');
class Uniforms {
    bounds = 0;
    clipRadius = 0;
    borderWidth = 0;
    borderColor = 0;
    borderedAreaBounds = 0;
    borderedAreaClipRadius = 0;
    exponent = 0;
    pixelStep = 0;
}
export const RoundedCornersEffect = GObject.registerClass({}, class Effect extends Shell.GLSLEffect {
    /**
     * To store a uniform value, we need to know its location in the shader,
     * which is done by calling `this.get_uniform_location()`. This is
     * expensive, so we cache the location of uniforms when the shader is
     * created.
     */
    static uniforms = new Uniforms();
    constructor() {
        super();
        for (const k in Effect.uniforms) {
            Effect.uniforms[k] =
                this.get_uniform_location(k);
        }
    }
    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, declarations, code, false);
    }
    /**
     * Update uniforms of the shader.
     * For more information, see the comments in the shader file.
     *
     * @param scaleFactor - Desktop scaling factor
     * @param config - Rounded corners configuration
     * @param windowBounds - Bounds of the window without padding
     */
    vfunc_paint_target(paintNode, paintContext) {
        const actor = this.actor;
        if (!actor || actor.get_width() <= 0 || actor.get_height() <= 0) {
            return;
        }
        super.vfunc_paint_target(paintNode, paintContext);
    }
    updateUniforms(scaleFactor, config, windowBounds) {
        const width = this.actor?.get_width() ?? 0;
        const height = this.actor?.get_height() ?? 0;
        if (width <= 0 || height <= 0) {
            return;
        }
        const borderWidth = getPref('border-width') * scaleFactor;
        const borderColor = config.borderColor;
        const outerRadius = config.borderRadius * scaleFactor;
        const { padding, smoothing } = config;
        const bounds = [
            windowBounds.x1 + padding.left * scaleFactor,
            windowBounds.y1 + padding.top * scaleFactor,
            windowBounds.x2 - padding.right * scaleFactor,
            windowBounds.y2 - padding.bottom * scaleFactor,
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
            1 / width,
            1 / height,
        ];
        // This is needed for squircle corners
        let exponent = smoothing * 10 + 2;
        let radius = outerRadius * 0.5 * exponent;
        // Fix: was bounds[4] (undefined), should be bounds[3]
        const maxRadius = Math.min(bounds[2] - bounds[0], bounds[3] - bounds[1]);
        if (radius > maxRadius) {
            exponent *= maxRadius / radius;
            radius = maxRadius;
        }
        borderedAreaRadius *= radius / outerRadius;
        this.#setUniforms(bounds, radius, borderWidth, borderColor, borderedAreaBounds, borderedAreaRadius, pixelStep, exponent);
    }
    #setUniforms(bounds, radius, borderWidth, borderColor, borderedAreaBounds, borderedAreaRadius, pixelStep, exponent) {
        const uniforms = Effect.uniforms;
        this.set_uniform_float(uniforms.bounds, 4, bounds);
        this.set_uniform_float(uniforms.clipRadius, 1, [radius]);
        this.set_uniform_float(uniforms.borderWidth, 1, [borderWidth]);
        this.set_uniform_float(uniforms.borderColor, 4, borderColor);
        this.set_uniform_float(uniforms.borderedAreaBounds, 4, borderedAreaBounds);
        this.set_uniform_float(uniforms.borderedAreaClipRadius, 1, [
            borderedAreaRadius,
        ]);
        this.set_uniform_float(uniforms.pixelStep, 2, pixelStep);
        this.set_uniform_float(uniforms.exponent, 1, [exponent]);
        this.queue_repaint();
    }
});
