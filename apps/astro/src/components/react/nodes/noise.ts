import {
  Fn,
  If,
  Loop,
  abs,
  dot,
  float,
  floor,
  fract,
  max,
  mix,
  sin,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';

import type { Node } from './types';

// Noise function for wind influence
export const noise2D = Fn<[Node]>(([p]) => {
  return sin(p.x.mul(10.0))
    .mul(sin(p.y.mul(10.0)))
    .mul(0.5)
    .add(0.5);
});

// Simplex noise functions
export const permute = Fn<[Node]>(([x]) => {
  return x.mul(34.0).add(1.0).mul(x).mod(289.0);
});

export const snoise = Fn<[Node]>(([v]) => {
  const C = vec4(
    0.211324865405187, // (3.0-sqrt(3.0))/6.0
    0.366025403784439, // 0.5*(sqrt(3.0)-1.0)
    -0.577350269189626, // -1.0 + 2.0 * C.x
    0.024390243902439, // 1.0/41.0
  );
  const i = v.add(dot(v, C.yy)).floor();
  const x0 = v.sub(i).add(dot(i, C.xx));

  const i1 = vec2(0.0, 0.0).toVar();

  If(x0.x.greaterThan(x0.y), () => {
    i1.assign(vec2(1.0, 0.0));
  }).Else(() => {
    i1.assign(vec2(0.0, 1.0));
  });

  const x12 = x0.xyxy.add(C.xxzz).toVar();
  x12.xy.subAssign(i1);

  const iMod = i.mod(289.0);
  const p = permute(
    permute(iMod.y.add(vec3(0.0, i1.y, 1.0)))
      .add(iMod.x)
      .add(vec3(0.0, i1.x, 1.0)),
  );

  const m = max(
    float(0.5).sub(vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw))),
    0.0,
  );

  const m4 = m.mul(m).mul(m).mul(m);

  const x = fract(p.mul(C.www)).mul(2.0).sub(1.0);
  const h = abs(x).sub(0.5);
  const ox = floor(x.add(0.5));
  const a0 = x.sub(ox);

  const g = vec3(
    a0.x.mul(x0.x).add(h.x.mul(x0.y)),
    a0.y.mul(x12.x).add(h.y.mul(x12.y)),
    a0.z.mul(x12.z).add(h.z.mul(x12.w)),
  );

  const falloff_factor = float(1.79284291400159).sub(
    float(0.85373472095314).mul(a0.mul(a0).add(h.mul(h))),
  );
  const weighted_m = m4.mul(falloff_factor);
  return dot(weighted_m, g).mul(130.0);
});

// Helper functions for Perlin Noise
// eslint-disable-next-line no-unused-vars
export const mod289Vec2 = Fn<[Node]>(([x_vec2]) => {
  return x_vec2.sub(floor(x_vec2.mul(1.0 / 289.0)).mul(289.0));
});

export const mod289Vec4 = Fn<[Node]>(([x_vec4]) => {
  return x_vec4.sub(floor(x_vec4.mul(1.0 / 289.0)).mul(289.0));
});

export const permuteVec4 = Fn<[Node]>(([x_perm]) => {
  return mod289Vec4(x_perm.mul(34.0).add(1.0).mul(x_perm));
});

export const taylorInvSqrtVec4 = Fn<[Node]>(([r_taylor]) => {
  return float(1.79284291400159).sub(float(0.85373472090914).mul(r_taylor));
});

// Enhanced Perlin Noise 2D
export const perlinNoise2D = Fn<[Node]>(([P_noise]) => {
  // P_noise is vec2
  const Pi = floor(P_noise.xyxy.add(vec4(0.0, 0.0, 1.0, 1.0))).toVar();

  // --- Corrected Pf Calculation ---
  const P_noise_fract_xyxy = fract(P_noise.xyxy);
  const Pf = P_noise_fract_xyxy.sub(vec4(0.0, 0.0, 1.0, 1.0));
  // Now Pf will be (fract(P_noise.x), fract(P_noise.y), fract(P_noise.x)-1, fract(P_noise.y)-1)

  Pi.assign(mod289Vec4(Pi));

  const ix = Pi.xzxz;
  const iy = Pi.yyww;
  const fx = Pf.xzxz;
  const fy = Pf.yyww;

  const i_perm = permuteVec4(permuteVec4(ix).add(iy));

  const gx = fract(i_perm.mul(1.0 / 41.0))
    .mul(2.0)
    .sub(1.0);
  const gy = abs(gx).sub(0.5);
  const tx = floor(gx.add(0.5));
  const gx_updated = gx.sub(tx);

  const g00 = vec2(gx_updated.x, gy.x);
  const g10 = vec2(gx_updated.y, gy.y);
  const g01 = vec2(gx_updated.z, gy.z);
  const g11 = vec2(gx_updated.w, gy.w);

  const norm = taylorInvSqrtVec4(
    vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)),
  );

  const g00_norm = g00.mul(norm.x);
  const g01_norm = g01.mul(norm.y);
  const g10_norm = g10.mul(norm.z);
  const g11_norm = g11.mul(norm.w);

  // These dot products will now use the correct fx and fy components
  const n00 = dot(g00_norm, vec2(fx.x, fy.x));
  const n10 = dot(g10_norm, vec2(fx.y, fy.y));
  const n01 = dot(g01_norm, vec2(fx.z, fy.z));
  const n11 = dot(g11_norm, vec2(fx.w, fy.w));

  const fade_xy = Pf.xy // Use Pf.xy for fade, which is (u_frac, v_frac) - this is correct
    .mul(Pf.xy)
    .mul(Pf.xy)
    .mul(Pf.xy.mul(Pf.xy.mul(6.0).sub(15.0)).add(10.0));
  const n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  const n_xy = mix(n_x.x, n_x.y, fade_xy.y);

  return float(2.3).mul(n_xy);
});

// Advanced FBM noise function
export const fbm = Fn<[Node, Node, Node, Node]>(
  ([p, octaves, lacunarity, persistence]) => {
    const total = float(0.0).toVar();
    const frequency = float(1.0).toVar();
    const amplitude = float(1.0).toVar();
    const maxValue = float(0.0).toVar();

    // Use loop with custom index

    Loop(octaves, () => {
      total.addAssign(perlinNoise2D(p.mul(frequency)).mul(amplitude));
      maxValue.addAssign(amplitude);
      amplitude.mulAssign(persistence);
      frequency.mulAssign(lacunarity);
    });

    return total.div(maxValue).add(1.0).mul(0.5);
  },
);
