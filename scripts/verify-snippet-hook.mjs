/**
 * Regression harness for the GNOME Shell 51 shader snippet hook.
 *
 * Reproduces the fragment shader code that Cogl generates for a
 * Clutter.ShaderEffect, following _cogl_pipeline_snippet_generate_code() in
 * mutter/cogl/cogl/cogl-pipeline-snippet.c (gnome-51). For the FRAGMENT hook
 * Cogl uses final_name = "main" and chain_function = "cogl_generated_source",
 * and cogl_generated_source() is the function that actually samples the
 * window texture into cogl_color_out.
 *
 * Run with: node scripts/verify-snippet-hook.mjs
 */

import {readFileSync} from 'node:fs';

const WINDOW_CONTENT = '  cogl_color_out = cogl_layer0;';

/**
 * Build the GLSL main() the way Cogl does it for the FRAGMENT hook.
 *
 * @param shader - `{declarations, code, mode}` describing the snippet we attach.
 * @returns The generated GLSL source.
 */
function generateFragmentMain({declarations, code, mode}) {
    // Cogl emits cogl_generated_source() first, then wraps the hook code.
    let main = 'void\ncogl_generated_source ()\n{\n';
    main += `${WINDOW_CONTENT}\n`;
    main += '}\n\n';

    main += 'void\nmain ()\n{\n';

    if (mode === 'replace') {
        // cogl_snippet_set_replace(): the replace string is emitted INSTEAD of
        // the chain call, so cogl_generated_source() is never invoked.
        main += code;
        main += '\n';
    } else {
        // "post" hook: cogl_generated_source() is called, then our code runs.
        main += '  cogl_generated_source ();\n';
        main += code;
        main += '\n';
    }

    main += '}\n';
    return declarations + main;
}

const shader = {
    declarations: 'uniform vec4 bounds;\n',
    code: '  cogl_color_out *= 0.5;',
};

let failures = 0;

function check(name, condition, detail) {
    if (condition) {
        console.log(`  PASS  ${name}`);
    } else {
        failures++;
        console.log(`  FAIL  ${name}`);
        if (detail) console.log(detail);
    }
}

console.log('GNOME Shell 51 fragment snippet hook\n');

const replacing = generateFragmentMain({...shader, mode: 'replace'});
const post = generateFragmentMain({...shader, mode: 'post'});

console.log('--- set_replace() (the buggy behaviour) ---');
console.log(replacing);

console.log('--- post hook (what the extension uses now) ---');
console.log(post);

check(
    'set_replace() drops the window texture draw',
    !replacing.split('main ()')[1].includes('cogl_generated_source ()'),
    'Expected main() to never call cogl_generated_source() with replace.',
);

check(
    'post hook keeps the window texture draw',
    post.split('main ()')[1].includes('cogl_generated_source ()'),
);

check(
    'post hook runs our code after the texture is drawn',
    post.indexOf('main ()') < post.indexOf('cogl_color_out *= 0.5;') &&
        post.indexOf('cogl_generated_source ();\n  cogl_color_out *= 0.5;') !==
            -1,
);

check(
    'both variants still modulate cogl_color_out',
    replacing.includes('cogl_color_out *= 0.5;') &&
        post.includes('cogl_color_out *= 0.5;'),
);

if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
}

// Also verify the real .frag files split the way readShader() expects, using
// the same regex as src/utils/file.ts.
const readShaderSource = readFileSync(
    new URL('../src/effect/shader/rounded_corners.frag', import.meta.url),
    'utf8',
);
const shaderMainMatch =
    /^[ \t]*(?:void[ \t]+)?main[ \t]*\([ \t]*\)[ \t]*\{/m.exec(readShaderSource);

check(
    'rounded_corners.frag exposes a main() definition',
    shaderMainMatch !== null,
);

if (shaderMainMatch) {
    const realDeclarations = readShaderSource
        .slice(0, shaderMainMatch.index)
        .trim();
    const bodyStart = shaderMainMatch.index + shaderMainMatch[0].length;
    const bodyEnd = readShaderSource.lastIndexOf('}');
    const realCode = readShaderSource.slice(bodyStart, bodyEnd).trim();

    check(
        'declarations hold the uniforms and helpers, not the body',
        realDeclarations.includes('uniform vec4 bounds;') &&
            !realDeclarations.includes('vec2 p = cogl_tex_coord0_in'),
    );

    check(
        'body is statements only (no stray braces from the split)',
        !realCode.startsWith('}') &&
            !realCode.endsWith('{') &&
            realCode.includes('cogl_color_out'),
    );

    // Render the shader the way Cogl will, using the REAL declarations/code.
    const real = generateFragmentMain({
        declarations: realDeclarations,
        code: realCode,
        mode: 'post',
    });
    check(
        'the real shader modulates a texture that was actually drawn',
        real.indexOf('cogl_generated_source ();') <
            real.lastIndexOf('cogl_color_out *= pointAlpha;'),
    );
}

if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
}
console.log('\nAll checks passed.');
