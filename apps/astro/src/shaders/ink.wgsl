// Drawing primitives shared by the project covers.
//
// Everything works in "print space": y runs -0.5 to 0.5, x is scaled by the
// 4:3 aspect, and one unit of distance is one print height. Coverage is
// resolved against an explicit pixel size rather than `fwidth`, so a cover
// rasterises identically in the browser and in the headless poster render —
// the poster is meant to be the first frame, not an approximation of it.

/// Ink coverage for a signed distance, softened over one pixel.
export fn cover(distance: f32, pixel: f32) -> f32 {
  return 1.0 - smoothstep(-pixel, pixel, distance);
}

/// A stroke radius that never falls below one device pixel.
///
/// These prints are drawn at 1200 wide and shown at 250. Without a floor every
/// hairline lands on a fraction of a pixel at display size and washes out to
/// nothing, which is how a drawing that reads as precise at full size reads as
/// empty on the page.
export fn hairline(radius: f32, pixel: f32) -> f32 {
  return max(radius, pixel * 0.7);
}

/// Signed distance to an axis-aligned box of half-extents `half`.
export fn sdBox(point: vec2f, half: vec2f) -> f32 {
  let d = abs(point) - half;
  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
}

/// Signed distance to a capsule: a segment from `a` to `b` of radius `radius`.
export fn sdSegment(point: vec2f, a: vec2f, b: vec2f, radius: f32) -> f32 {
  let pa = point - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h) - radius;
}

/// Position along a segment, for anything that travels the line it draws.
export fn alongSegment(a: vec2f, b: vec2f, t: f32) -> vec2f {
  return a + (b - a) * t;
}

/// Paper grain. Low amplitude by design: the substrate should be felt in the
/// flat areas and invisible against the marks.
export fn grain(point: vec2f, amount: f32) -> f32 {
  let n = fract(sin(dot(point, vec2f(127.1, 311.7))) * 43758.5453);
  return (n - 0.5) * amount;
}

/// Ordered 4x4 Bayer threshold, indexed by pixel. Dithering a gradient in a
/// 4:3 print is what keeps a large tonal sweep from banding at 8 bits.
export fn bayer4(pixel: vec2u) -> f32 {
  let x = pixel.x & 3u;
  let y = pixel.y & 3u;
  let index = y * 4u + x;
  var table = array<f32, 16>(
    0.0,  8.0,  2.0,  10.0,
    12.0, 4.0,  14.0, 6.0,
    3.0,  11.0, 1.0,  9.0,
    15.0, 7.0,  13.0, 5.0,
  );
  return (table[index] + 0.5) / 16.0 - 0.5;
}
