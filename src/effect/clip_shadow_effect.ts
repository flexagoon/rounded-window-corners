/**
 * @file Clips shadows for windows.
 *
 * Needed because of this issue:
 * https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/4474
 */

import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

import {readShader} from '../utils/file.js';

const [declarations, code] = readShader(
    import.meta.url,
    'shader/clip_shadow.frag',
);

export const ClipShadowEffect = GObject.registerClass(
    {},
    class extends Shell.GLSLEffect {
        vfunc_build_pipeline() {
            this.add_glsl_snippet(
                Cogl.SnippetHook.FRAGMENT,
                declarations,
                code,
                false,
            );
        }
    },
);
