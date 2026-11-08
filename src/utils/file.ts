/** @file Contains utility functions for reading file contents. */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// In GJS 1.84+ (GNOME Shell 51) calling an async Gio method without its
// callback no longer returns a promise automatically, so we have to opt in
// with Gio._promisify. This is what gnome-shell itself does (loginDialog.js).
Gio._promisify(Gio.File.prototype, 'load_contents_async');

/**
 * Read file contents as a string.
 *
 * @param path - The path to the file to be read.
 * @returns Contents of the file as a UTF-8 string.
 */
export async function readFile(path: string) {
    const file = Gio.File.new_for_path(path);

    const [contents] = await file.load_contents_async(null);

    const decoder = new TextDecoder('utf-8');
    return decoder.decode(contents);
}

/**
 * Read a file relative to the current module.
 *
 * @param module - `import.meta.url` of the current module.
 * @param path - File path relative to the current module.
 * @returns Contents of the file as a UTF-8 string.
 */
export function readRelativeFile(module: string, path: string) {
    const basedir = GLib.path_get_dirname(module);
    const fileUri = GLib.build_filenamev([basedir, path]);
    const filePath = GLib.filename_from_uri(fileUri)[0];
    return readFile(filePath ?? '');
}

/**
 * Read a shader file and split it into declarations and main code, since
 * `Cogl.Snippet.new` takes those parts as two separate arguments.
 *
 * @param module - `import.meta.url` of the current module.
 * @param path - File path relative to the current module.
 * @returns A list containing the declarations as the first element and the
 *          body of the main function (the statements between its braces) as
 *          the second.
 */
export async function readShader(module: string, path: string) {
    const shader = await readRelativeFile(module, path);
    // Match the `main` definition at the start of a line (optionally preceded
    // by a return type) so that a mention of "main()" inside a comment does
    // not swallow part of the declarations.
    // biome-ignore lint/performance/useTopLevelRegex: This is only executed at startup
    const match = /^[ \t]*(?:void[ \t]+)?main[ \t]*\([ \t]*\)[ \t]*\{/m.exec(
        shader,
    );
    if (!match) {
        throw new Error(`Could not find main() in shader ${path}`);
    }

    const declarations = shader.slice(0, match.index).trim();

    // Take everything between the opening and the matching closing brace.
    const bodyStart = match.index + match[0].length;
    const bodyEnd = shader.lastIndexOf('}');
    const code = shader
        .slice(bodyStart, bodyEnd > bodyStart ? bodyEnd : undefined)
        .trim();

    return [declarations, code];
}
