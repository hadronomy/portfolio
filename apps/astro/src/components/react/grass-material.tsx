import {
  Fn,
  If,
  Loop,
  abs,
  attribute,
  cameraProjectionMatrix,
  color,
  cos,
  cross,
  dot,
  float,
  floor,
  fract,
  max,
  mix,
  modelViewMatrix,
  normalLocal,
  normalView,
  normalize,
  positionView,
  pow,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import * as THREE from 'three/webgpu';

function createNodeMaterial(
  callback: (material: THREE.NodeMaterial) => THREE.NodeMaterial,
): () => THREE.NodeMaterial {
  return () => callback(new THREE.NodeMaterial());
}

type Node = THREE.TSL.ShaderNodeObject<THREE.Node>;

// Create TSL-based grass material
export const grassNodeMaterial = createNodeMaterial((material) => {
  const position = attribute('position', 'vec3');
  const offset = attribute('offset', 'vec3');
  const orientation = attribute('orientation', 'vec4');
  const size = attribute('size', 'float');
  const halfRootAngleSin = attribute('halfRootAngleSin', 'float');
  const halfRootAngleCos = attribute('halfRootAngleCos', 'float');

  const vPosition = varying(vec3(), 'vPosition');
  const vNormal = varying(vec3(), 'vNormal');
  const vUv = varying(vec3(), 'vUv');

  // Define uniforms
  const ambientStrength = uniform(0.7);
  const diffuseStrength = uniform(1.5);
  const specularStrength = uniform(1.0);
  const translucencyStrength = uniform(1.5);
  const shininess = uniform(120);
  const sunColour = uniform(new THREE.Color(1.0, 1.0, 1.0));
  const lightDirection = uniform(new THREE.Vector3(1.0, 0.0, 0.0).normalize());

  // Grass color parameters
  const bottomColor = uniform(color('#339933'));
  const topColor = uniform(color('#66a61a'));
  1;
  const darkPatchColor = uniform(color('#1a801a'));
  const lightPatchColor = uniform(color('#8cbf00'));

  // Noise control parameters
  const noiseScale = uniform(0.05);
  const noiseQuantize = uniform(4.0);
  const noiseMixStrength = uniform(0.5);
  const edgeHighlightStrength = uniform(0.01);
  const colorVariation = uniform(0.8);

  // Quaternion multiplication function
  const qmul = Fn<[Node, Node]>(([q1, q2]) => {
    return vec4(
      q1.w
        .mul(q2.x)
        .add(q1.x.mul(q2.w))
        .add(q1.z.mul(q2.y))
        .sub(q1.y.mul(q2.z)),
      q1.w
        .mul(q2.y)
        .add(q1.y.mul(q2.w))
        .add(q1.x.mul(q2.z))
        .sub(q1.z.mul(q2.x)),
      q1.w
        .mul(q2.z)
        .add(q1.z.mul(q2.w))
        .add(q1.y.mul(q2.x))
        .sub(q1.x.mul(q2.y)),
      q1.w
        .mul(q2.w)
        .sub(q1.x.mul(q2.x))
        .sub(q1.y.mul(q2.y))
        .sub(q1.z.mul(q2.z)),
    );
  });

  // Rotate a vector using a quaternion
  const applyQuaternion = Fn<[Node, Node]>(([v, q]) => {
    const temp = cross(q.xyz, v).mul(2.0);
    return v.add(temp.mul(q.w)).add(cross(q.xyz, temp));
  });

  // Noise function for wind influence
  const noise2D = Fn<[Node]>(([p]) => {
    return sin(p.x.mul(10.0))
      .mul(sin(p.y.mul(10.0)))
      .mul(0.5)
      .add(0.5);
  });

  // Simplex noise functions
  const permute = Fn<[Node]>(([x]) => {
    return x.mul(34.0).add(1.0).mul(x).mod(289.0);
  });

  const snoise = Fn<[Node]>(([v]) => {
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
      float(0.5).sub(
        vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
      ),
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
  const mod289Vec2 = Fn<[Node]>(([x_vec2]) => {
    return x_vec2.sub(floor(x_vec2.mul(1.0 / 289.0)).mul(289.0));
  });

  const mod289Vec4 = Fn<[Node]>(([x_vec4]) => {
    return x_vec4.sub(floor(x_vec4.mul(1.0 / 289.0)).mul(289.0));
  });

  const permuteVec4 = Fn<[Node]>(([x_perm]) => {
    return mod289Vec4(x_perm.mul(34.0).add(1.0).mul(x_perm));
  });

  const taylorInvSqrtVec4 = Fn<[Node]>(([r_taylor]) => {
    return float(1.79284291400159).sub(float(0.85373472090914).mul(r_taylor));
  });

  // Enhanced Perlin Noise 2D
  const perlinNoise2D = Fn<[Node]>(([P_noise]) => {
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
  const fbm = Fn<[Node, Node, Node, Node]>(
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

  // Position transformation for vertex shader
  const transformPosition = Fn(() => {
    vUv.assign(uv());

    // Root rotation based on angle attributes
    const rootQ = vec4(0.0, halfRootAngleSin, 0.0, halfRootAngleCos);

    // Combine with orientation quaternion
    const combinedQ = qmul(orientation, rootQ);

    // Scale and transform position
    const scaledPosition = position.xyz.mul(vec3(size, size, size));
    const transformedPos = applyQuaternion(scaledPosition, combinedQ).add(
      offset,
    );

    vPosition.assign(transformedPos);

    // Apply wind effect
    const windStrength = float(0.3);
    const windFrequency = float(0.5);
    const windEffect = pow(position.y, 2.0).mul(windStrength);
    const windTime = time.mul(windFrequency);

    // Calculate noise for natural movement
    const noiseValue = noise2D(
      vec2(vPosition.x.add(windTime), vPosition.z.add(windTime.mul(0.5))),
    );

    // Wind displacement
    const windDisplacement = vec3(
      sin(windTime.add(vPosition.x.mul(0.5)))
        .mul(noiseValue)
        .mul(windEffect),
      0.0,
      cos(windTime.mul(0.7).add(vPosition.z.mul(0.5)))
        .mul(noiseValue)
        .mul(windEffect),
    );

    // Apply wind only to upper parts of blade
    const windFactor = smoothstep(0.2, 0.6, position.y);
    vPosition.assign(vPosition.add(windDisplacement.mul(windFactor)));

    vNormal.assign(applyQuaternion(normalLocal, combinedQ));

    return cameraProjectionMatrix
      .mul(modelViewMatrix)
      .mul(vec4(vPosition, 1.0));
  });

  // Color calculation for fragment shader
  const calculateColor = Fn(() => {
    const uvValue = vUv;

    // Calculate moving noise pattern
    const moveSpeed = float(0.2);
    const position = vPosition;

    // return fract(vPosition);

    // Create coordinates for noise - only using X and Z to keep color consistent throughout the blade height
    const noisePos = vec2(
      position.x.mul(noiseScale).add(time.mul(moveSpeed)),
      position.z.mul(noiseScale).add(time.mul(moveSpeed).mul(0.7)),
    );

    // Multi-layered noise
    const noise1 = snoise(noisePos);
    const noise2 = snoise(noisePos.mul(2.0)).mul(0.5);
    const noise3 = snoise(noisePos.mul(4.0)).mul(0.25);

    // Combined noise
    const combinedNoise = noise1.add(noise2).add(noise3);

    // Static noise - also using world position
    const staticNoiseScale = float(0.1);
    const staticNoisePos = vec2(
      position.x.mul(staticNoiseScale),
      position.z.mul(staticNoiseScale),
    );

    // Multi-layered static noise
    const staticNoise1 = snoise(staticNoisePos);
    const staticNoise2 = snoise(staticNoisePos.mul(3.0)).mul(0.4);
    const staticNoise3 = snoise(staticNoisePos.mul(6.0)).mul(0.2);

    // Combine static noise
    const combinedStaticNoise = staticNoise1
      .add(staticNoise2)
      .add(staticNoise3);

    // Blend moving and static noise
    const finalNoise = combinedNoise.mul(0.6).add(combinedStaticNoise.mul(0.4));

    // Brightness variation
    const brightnessVariation = finalNoise.mul(0.2).add(0.9);

    // FBM noise for color variation
    const fbmCoord = vec2(
      position.x.mul(noiseScale),
      position.z.mul(noiseScale),
    ).add(vec2(15.5, 7.2));
    const fbmValue = fbm(fbmCoord, float(5), float(2.0), float(0.5));

    // Quantize noise
    const quantizedNoise = floor(fbmValue.mul(noiseQuantize)).div(
      noiseQuantize,
    );

    // Height gradient
    const heightGradient = uvValue.y;

    // Base colors with noise
    const baseBottomColor = mix(
      bottomColor,
      darkPatchColor,
      quantizedNoise.mul(colorVariation),
    );
    const baseTopColor = mix(
      topColor,
      lightPatchColor,
      quantizedNoise.mul(colorVariation),
    );

    // Gradient color
    const gradientColor = mix(
      baseTopColor,
      baseBottomColor,
      heightGradient,
    ).toVar();

    // Apply noise-based color
    const noiseColor = mix(darkPatchColor, lightPatchColor, fbmValue).toVar();
    gradientColor.assign(mix(gradientColor, noiseColor, noiseMixStrength));

    // Edge highlighting
    const edgeHighlight = smoothstep(
      0.2,
      0.3,
      abs(fbmValue.sub(0.5)).mul(2.0),
    ).mul(edgeHighlightStrength);
    gradientColor.addAssign(vec3(edgeHighlight));

    const grassColor = gradientColor.toVar();
    grassColor.mulAssign(brightnessVariation);

    // Root darkening
    const rootDarkening = float(1.0).sub(
      pow(max(0.0, uvValue.y.mul(1.3)), 2.0).mul(0.5),
    );
    grassColor.mulAssign(rootDarkening);

    // Final base color
    return grassColor;
  });

  // Lighting calculation
  const calculateLighting = Fn<[Node]>(([baseColor]) => {
    // Normalize vectors
    const normal = normalize(normalView);
    const lightDir = normalize(lightDirection);

    // Ambient light
    const ambient = baseColor.mul(ambientStrength);

    // Diffuse (Lambert)
    const diff = max(dot(normal, lightDir), 0.0);
    const diffuse = diff.mul(diffuseStrength).mul(sunColour).mul(baseColor);

    // Specular (Blinn-Phong)
    const viewDir = normalize(positionView.negate());
    const halfDir = normalize(lightDir.add(viewDir));
    const spec = pow(max(dot(normal, halfDir), 0.0), shininess);
    const specular = spec.mul(specularStrength).mul(sunColour);

    // Translucency
    const translucency = max(0.0, dot(normal, lightDir).negate()).mul(
      translucencyStrength,
    );
    const transLight = translucency.mul(sunColour).mul(baseColor);

    // Combine lighting
    return ambient.add(diffuse).add(specular).add(transLight);
  });

  // Apply the transformations
  const transformedPosition = transformPosition();
  material.vertexNode = transformedPosition;

  // Get base color and lighting
  const baseColor = calculateColor();
  const finalColor = calculateLighting(baseColor);

  // Set material properties
  // TODO: Implement alpha handling similar to GLSL (alphaMap + fallback) instead of hardcoded 1.0
  material.fragmentNode = vec4(finalColor, 1.0);
  material.alphaTestNode = float(0.1);

  // Material settings
  material.side = THREE.DoubleSide;
  material.transparent = false;

  return material;
});

interface TLSMaterials {
  // biome-ignore lint/suspicious/noExplicitAny: for now
  nodeMaterial: any;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends TLSMaterials {}
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends TLSMaterials {}
  }
}
