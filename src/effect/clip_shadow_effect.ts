/**
 * @file Clips shadows for windows.
 *
 * Needed because of this issue:
 * https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/4474
 */

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';

import {readShader} from '../utils/file.js';

const [declarations, code] = await readShader(
    import.meta.url,
    'shader/clip_shadow.frag',
);

/**
 * A Clutter.ShaderEffect that clips window shadows. In GNOME Shell 51,
 * Shell.GLSLEffect was removed, so shader effects have to be implemented
 * using Clutter.ShaderEffect and the vfunc_get_static_snippet virtual
 * instead.
 */
export class ClipShadowEffect extends Clutter.ShaderEffect {
    static {
        GObject.registerClass(ClipShadowEffect);
    }

    vfunc_get_static_snippet() {
        // The shader reads cogl_color_out to compute the shadow's luminance,
        // so it has to run *after* Cogl has drawn the actor into that variable.
        // Passing the code as the "post" hook is what guarantees that: Cogl
        // generates
        //
        //     main() { cogl_generated_source(); <post code> }
        //
        // set_replace() would instead replace the entire main() function,
        // removing the cogl_generated_source() call and making the shadow
        // -- and the window -- invisible.
        const snippet = Cogl.Snippet.new(
            Cogl.SnippetHook.FRAGMENT,
            declarations,
            code,
        );
        return snippet;
    }
}
