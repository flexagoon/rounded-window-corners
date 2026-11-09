// Based on this shader from Mutter:
// https://gitlab.gnome.org/GNOME/mutter/-/blob/main/src/compositor/meta-background-content.c

// This shader is what actually does the most important part of the extension -
// corner rounding.
//
// The way Fragment shaders work in GNOME is that they receive the information
// about a point on the screen, process it in some way, and set the `cogl_color_out`
// variable which indicates what color should be drawn to the screen at that
// point.
//
// Corner rounding is works by doing a bunch of simple calculations on
// the point coordinates to determine if the point lies within the visible part
// of the window, and making it invisible (multiplying `cogl_color_out` by 0)
// if it's not.

// First, we declare our uniforms.
// Uniforms are parameters that are passed to the shader from external code.

// Bounds of the window as {x, y, z, w}:
//   x - left
//   y - top
//   z - right
//   w - bottom
uniform vec4 bounds;

// The border radius of the corner clipping.
uniform float clipRadius;

// Width and color of the border
uniform float borderWidth;
uniform vec4 borderColor;

// Bounds and clip radius of the area inside of borders.
// When using inner borders, this is the smaller window area within those borders.
// With outer borders, this is the total area of the window together with them.
uniform vec4 borderedAreaBounds;
uniform float borderedAreaClipRadius;

// Exponent to use for squircle corners
uniform float exponent;

// I'm acually not sure what this does, but it's used in the original Mutter code :)
// It seems like this is needed to convert between texture coordinates and pixel
// coordinates, but I'm not sure.
uniform vec2 pixelStep;

// Calculate whether a point is within the rounded window when using regular
// circular corner rounding.
//
//          p | The point
//     center | The center of the circle used for border rounding
// clipRadius | Border radius
float circleBounds(vec2 p, vec2 center, float clipRadius) {
    // Get the distance from the circle center to the point
    vec2 delta = p - center;
    float distSquared = dot(delta, delta);

    // If the distance is larger than the border radius, the point is outside
    // of the rounded corner, and should be invisible.
    float outerRadius = clipRadius + 0.5;
    if (distSquared >= (outerRadius * outerRadius))
        return 0.0;

    // Likewise, if it is smaller, the point is inside of the window.
    float borderedAreaRadius = clipRadius - 0.5;
    if (distSquared <= (borderedAreaRadius * borderedAreaRadius))
        return 1.0;

    // If the difference between border radius and the distance is less than
    // 0.5, the point is located on the edge of the window, and should be
    // antialiased.
    //
    // Taking a square root is computationally expensive, so this is avoided as
    // much as possible.
    return outerRadius - sqrt(distSquared);
}

// Calculate whether a point is within the rounded window when using squircle
// corner rounding.
//
// A squircle is what's called a "superellipse", which is defined by this formula:
//     (|x|^n + |y|^n)^(1/n)
//
//          p | The point
//     center | The center of the circle used for border rounding
// clipRadius | Border radius
//   exponent | The exponent (n) of the superellipse
float squircleBounds(vec2 p, vec2 center, float clipRadius, float exponent) {
    // Get the distances from the circle center to the point (|x|, |y|)
    vec2 delta = abs(p - center);

    // Raise the distances to the given power (|x|^n, |y|^n)
    float powDx = pow(delta.x, exponent);
    float powDy = pow(delta.y, exponent);

    // Calculate the end result of the formula (|x|^n + |y|^n)^(1/n)
    float dist = pow(powDx + powDy, 1.0 / exponent);

    // Calculate the opacity for the point and normalize it between 0 and 1
    return clamp(clipRadius - dist + 0.5, 0.0, 1.0);
}

// Calculate the correct opacity for a given point within the window.
//
//          p | The point
//     bounds | The bounds of the window
// clipRadius | Border radius
//   exponent | The exponent (smoothness) of the squircle corners.
//            | See `squircleBounds` for more information.
float getPointOpacity(vec2 p, vec4 bounds, float clipRadius, float exponent) {
    // If the point is completely outside of the window bounds, it should
    // obviously not be visible.
    if (p.x < bounds.x || p.x > bounds.z || p.y < bounds.y || p.y > bounds.w)
        return 0.0;

    // This is the center of the circle that is used for corner rounding.
    vec2 center;

    // First, we find the centers of the circles on the horizontal axis.
    // `centerLeft` is for two corners on the left of the window, and
    // `centerRight` is for corners on the right.
    float centerLeft = bounds.x + clipRadius;
    float centerRight = bounds.z - clipRadius;

    // If the point is closer to the window border than the circle center, it
    // has a chance of being within the rounded area, so we store the center
    // x position and continue. If it's not, then it should always be visible
    // and we can return 1.0 early to avoid extra computation (this is the case
    // for the vast majority of points).
    if (p.x < centerLeft)
        center.x = centerLeft;
    else if (p.x > centerRight)
        center.x = centerRight;
    else
        return 1.0;

    // Now we do the same, but for the vertical coordinate of the center.
    float centerTop = bounds.y + clipRadius;
    float centerBottom = bounds.w - clipRadius;

    if (p.y < centerTop)
        center.y = centerTop;
    else if (p.y > centerBottom)
        center.y = centerBottom;
    else
        return 1.0;

    // If the exponent is set, apply squircle bounds, otherwise use regular
    // circular ones.
    if (exponent <= 2.0)
        return circleBounds(p, center, clipRadius);
    else
        return squircleBounds(p, center, clipRadius, exponent);
}

// This is the main function of the shader. It's what is actually being called
// when rendering a point to the screen. It has no return value; as explained
// at the beginning of the file, the `cogl_color_out` variable is used to set
// the point color.
void main() {
    vec2 p = cogl_tex_coord0_in.xy / pixelStep;

    float pointAlpha = getPointOpacity(p, bounds, clipRadius, exponent);

    if (borderWidth > 0.9 || borderWidth < -0.9) {
        // If there is a border, we have to paint it.
        // Window pixels already include paint opacity. Apply it to the border
        // color too, so both its RGB and alpha fade with the window.
        vec4 borderPaintColor = vec4(borderColor.rgb, 1.0) * cogl_color_in.a;

        // Calculate if the point lies within the bordered area (see the
        // `borderedAreaBounds` uniform for an explanation of what this means)
        float borderedAreaAlpha = getPointOpacity(p, borderedAreaBounds, borderedAreaClipRadius, exponent);

        if (borderWidth > 0.0) {
            // Inner borders

            // Clip points that are not inside of the window
            cogl_color_out *= pointAlpha;
            // Calculate if the point is located on the border itself
            float borderAlpha = clamp(abs(pointAlpha - borderedAreaAlpha), 0.0, 1.0);
            // Then, mix the window color and the border color
            cogl_color_out = mix(cogl_color_out, borderPaintColor, borderAlpha * borderColor.a);
        } else {
            // Outer borders

            // If the point is within the bordered area, paint it with the
            // border color
            vec4 borderRect = borderPaintColor * borderedAreaAlpha * borderColor.a;
            // Then, if the point is also inside of the actual window
            // (pointAlpha = 1), draw the correct window pixel on top
            cogl_color_out = mix(borderRect, cogl_color_out, pointAlpha);
        }
    } else {
        // If there's no border, just multiply the output color by the calculated
        // alpha value.
        cogl_color_out *= pointAlpha;
    }
}
