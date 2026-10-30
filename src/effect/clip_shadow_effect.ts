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

export const ClipShadowEffect = GObject.registerClass(
    {},
    class extends Clutter.ShaderEffect {
        vfunc_get_static_snippet() {
            return Cogl.Snippet.new(
                Cogl.SnippetHook.FRAGMENT,
                declarations,
                code,
            );
        }
    },
);
