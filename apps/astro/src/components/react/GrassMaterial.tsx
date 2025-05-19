import { shaderMaterial } from '@react-three/drei';
import { type ReactThreeFiber, extend } from '@react-three/fiber';
import * as THREE from 'three';

// Create custom grass blade material using shaderMaterial
interface GrassMaterialUniforms {
  time: number;
  map: THREE.Texture | null;
  alphaMap: THREE.Texture | null;
  ambient_strength: number;
  diffuse_strength: number;
  specular_strength: number;
  translucency_strength: number;
  shininess: number;
  sunColour: THREE.Color;
  lightDirection: THREE.Vector3;

  // Grass color gradient parameters
  bottomColor: THREE.Color;
  topColor: THREE.Color;

  // Patch color parameters
  darkPatchColor: THREE.Color;
  lightPatchColor: THREE.Color;

  // Noise control parameters
  noiseScale: number; // Controls the size of the color patches
  noiseQuantize: number; // Controls the number of distinct color levels
  noiseMixStrength: number; // Controls strength of noise influence on color
  edgeHighlightStrength: number; // Controls visibility of patch edges

  // Variation control
  colorVariation: number; // Controls how much the noise affects color

  // biome-ignore lint/suspicious/noExplicitAny: required here
  [key: string]: any;
}

export const GrassMaterial = shaderMaterial<
  GrassMaterialUniforms,
  GrassMaterialUniforms & THREE.ShaderMaterial
>(
  {
    time: 0,
    map: null,
    alphaMap: null,
    ambient_strength: 0.7,
    diffuse_strength: 1.5,
    specular_strength: 1.0,
    translucency_strength: 1.5,
    shininess: 256,
    sunColour: new THREE.Color(1.0, 1.0, 1.0),
    lightDirection: new THREE.Vector3(0.0, 0.0, 0.0).normalize(),

    // Default grass color gradient
    bottomColor: new THREE.Color(0.2, 0.8, 0.2), // Base green color
    topColor: new THREE.Color(0.4, 0.65, 0.1), // Yellowish green for tips

    // Default patch colors
    darkPatchColor: new THREE.Color(0.1, 0.5, 0.1), // Dark green patches
    lightPatchColor: new THREE.Color(0.55, 0.75, 0.0), // Light yellow-green patches

    // Noise control parameters with default values
    noiseScale: 0.03, // Scale for noise (lower = larger patches)
    noiseQuantize: 4.0, // Number of distinct color levels
    noiseMixStrength: 0.5, // Strength of noise influence on final color
    edgeHighlightStrength: 0.1, // Strength of highlights at patch edges

    // Variation control
    colorVariation: 0.8, // Strength of the patch color variation
  },
  /* Vertex shader */
  `
    attribute vec3 offset;
    attribute vec4 orientation;
    attribute float size;
    attribute float halfRootAngleSin;
    attribute float halfRootAngleCos;

    uniform float time;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;

    // Quaternion multiplication
    vec4 qmul(vec4 q1, vec4 q2) {
      return vec4(
        q1.w * q2.x + q1.x * q2.w + q1.z * q2.y - q1.y * q2.z,
        q1.w * q2.y + q1.y * q2.w + q1.x * q2.z - q1.z * q2.x,
        q1.w * q2.z + q1.z * q2.w + q1.y * q2.x - q1.x * q2.y,
        q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
      );
    }

    // Rotate a vector using a quaternion
    vec3 applyQuaternion(vec3 v, vec4 q) {
      vec3 temp = 2.0 * cross(q.xyz, v);
      return v + q.w * temp + cross(q.xyz, temp);
    }

    // Noise function for wind influence
    float noise(vec2 p) {
      return sin(p.x * 10.0) * sin(p.y * 10.0) * 0.5 + 0.5;
    }

    void main() {
      vUv = uv;
      
      // Root rotation based on the angle attributes
      vec4 rootQ = vec4(0.0, halfRootAngleSin, 0.0, halfRootAngleCos);

      // Rotate the blade around the Y axis
      vec4 combinedQ = qmul(orientation, rootQ);

      // Scale and position the blade
      vec3 transformedPosition = position.xyz * vec3(size, size, size);
      vPosition = applyQuaternion(transformedPosition, combinedQ) + offset;

      // Apply wind effect
      float windStrength = 0.3;
      float windFrequency = 0.5;
      float windEffect = pow(position.y, 2.0) * windStrength;
      float windTime = time * windFrequency;
      
      // Calculate noise for more natural movement
      float noiseValue = noise(vec2(vPosition.x + windTime, vPosition.z + windTime * 0.5));
      
      // Apply wind displacement in x and z directions
      vec3 windDisplacement = vec3(
        sin(windTime + vPosition.x * 0.5) * noiseValue * windEffect,
        0.0,
        cos(windTime * 0.7 + vPosition.z * 0.5) * noiseValue * windEffect
      );
      
      // Only apply wind to the middle and upper part of the blade
      vPosition += windDisplacement * smoothstep(0.2, 0.6, position.y);
      
      // Transform the normal
      vNormal = applyQuaternion(normal, combinedQ);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
    }
  `,
  /* Fragment shader */
  `
    uniform vec3 lightDirection;
    uniform vec3 sunColour;
    uniform float ambient_strength;
    uniform float diffuse_strength;
    uniform float specular_strength;
    uniform float translucency_strength;
    uniform float shininess;
    uniform sampler2D map;
    uniform sampler2D alphaMap;
    uniform float time;
    
    // Grass color uniforms
    uniform vec3 bottomColor;
    uniform vec3 topColor;
    uniform vec3 darkPatchColor;
    uniform vec3 lightPatchColor;
    
    // Noise control uniforms
    uniform float noiseScale;
    uniform float noiseQuantize;
    uniform float noiseMixStrength;
    uniform float edgeHighlightStrength;
    uniform float colorVariation;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0))
        + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
        dot(x12.zw,x12.zw)), 0.0);
      m = m*m;
      m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    
    // Advanced Perlin noise functions
    vec2 mod289_2(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 mod289_4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 permute_4(vec4 x) { return mod289_4(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472090914 * r; }
    
    // Enhanced Perlin Noise 2D
    float perlinNoise2D(vec2 P) {
      vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
      vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
      Pi = mod289_4(Pi); // Avoid truncation effects
      vec4 ix = Pi.xzxz;
      vec4 iy = Pi.yyww;
      vec4 fx = Pf.xzxz;
      vec4 fy = Pf.yyww;

      vec4 i = permute_4(permute_4(ix) + iy);

      vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
      vec4 gy = abs(gx) - 0.5;
      vec4 tx = floor(gx + 0.5);
      gx = gx - tx;

      vec2 g00 = vec2(gx.x, gy.x);
      vec2 g10 = vec2(gx.y, gy.y);
      vec2 g01 = vec2(gx.z, gy.z);
      vec2 g11 = vec2(gx.w, gy.w);

      vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
      g00 *= norm.x;
      g01 *= norm.y;
      g10 *= norm.z;
      g11 *= norm.w;

      float n00 = dot(g00, vec2(fx.x, fy.x));
      float n10 = dot(g10, vec2(fx.y, fy.y));
      float n01 = dot(g01, vec2(fx.z, fy.z));
      float n11 = dot(g11, vec2(fx.w, fy.w));

      vec2 fade_xy = Pf.xy * Pf.xy * Pf.xy * (Pf.xy * (Pf.xy * 6.0 - 15.0) + 10.0);
      vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
      float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
      return 2.3 * n_xy;
    }

    // Fractal Brownian Motion (FBM)
    float fbm(vec2 p, int octaves, float lacunarity, float persistence) {
      float total = 0.0;
      float frequency = 1.0;
      float amplitude = 1.0;
      float maxValue = 0.0;

      for (int i = 0; i < octaves; i++) {
        if (i >= octaves) break; // Prevents loop issues in some GLSL implementations
        total += perlinNoise2D(p * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }

      return (total / maxValue + 1.0) * 0.5; // Normalize to [0, 1]
    }

    void main() {
      // Calculate moving noise pattern
      float noiseScale = 0.05; // Scale for the noise pattern
      float moveSpeed = 0.2; // Speed of pattern movement
      
      // Create moving coordinates for the noise
      vec2 noisePos = vec2(
        vPosition.x * noiseScale + time * moveSpeed,
        vPosition.z * noiseScale + time * moveSpeed * 0.7
      );
      
      // Generate multi-layered noise for more natural variation
      float noise1 = snoise(noisePos);
      float noise2 = snoise(noisePos * 2.0) * 0.5;
      float noise3 = snoise(noisePos * 4.0) * 0.25;
      
      // Combined noise value in [-1,1] range
      float combinedNoise = noise1 + noise2 + noise3;
      
      // Add static noise for additional texture detail
      float staticNoiseScale = 0.1; // Different scale for static component
      vec2 staticNoisePos = vec2(
        vPosition.x * staticNoiseScale,
        vPosition.z * staticNoiseScale
      );
      
      // Generate multi-layered static noise
      float staticNoise1 = snoise(staticNoisePos);
      float staticNoise2 = snoise(staticNoisePos * 3.0) * 0.4;
      float staticNoise3 = snoise(staticNoisePos * 6.0) * 0.2;
      
      // Combined static noise
      float combinedStaticNoise = staticNoise1 + staticNoise2 + staticNoise3;
      
      // Blend moving and static noise (60% moving, 40% static)
      float finalNoise = combinedNoise * 0.6 + combinedStaticNoise * 0.4;
      
      // Convert to brightness variation factor
      float brightnessVariation = finalNoise * 0.2 + 0.9; // Range [0.7, 1.1]
      
      // Add advanced color variation using FBM noise
      vec2 fbmCoord = vec2(vPosition.x * noiseScale, vPosition.z * noiseScale) + vec2(15.5, 7.2);
      float fbmNoise = fbm(fbmCoord, 5, 2.0, 0.5); // 5 octaves
      
      // Apply quantization with configurable levels for more distinct patches
      float quantizedNoise = floor(fbmNoise * noiseQuantize) / noiseQuantize;
      
      // Create vertical gradient - greener at base, yellower at tip
      float heightGradient = vUv.y; // Use UV.y to get vertical position along blade
      
      // Modify colors based on quantized noise with configurable effect strength
      vec3 baseBottomColor = mix(bottomColor, darkPatchColor, quantizedNoise * colorVariation);
      vec3 baseTopColor = mix(topColor, lightPatchColor, quantizedNoise * colorVariation);
      
      // Calculate the gradient color
      vec3 gradientColor = mix(baseTopColor, baseBottomColor, heightGradient);
      
      // Apply configurable color variance based on the FBM noise
      vec3 noiseColor = mix(darkPatchColor, lightPatchColor, fbmNoise);
      gradientColor = mix(gradientColor, noiseColor, noiseMixStrength);
      
      // Add edge highlighting between patches to make boundaries more visible
      float edgeHighlight = smoothstep(0.2, 0.3, abs(fbmNoise - 0.5) * 2.0) * edgeHighlightStrength;
      gradientColor += vec3(edgeHighlight);
      
      // Apply both texture and gradient
      vec3 grassColor = gradientColor;
      
      // Apply brightness variation to the grass color
      grassColor *= brightnessVariation;
      
      // Apply subtle darkening near the very bottom for root effect
      float rootDarkening = 1.0 - pow(max(0.0, vUv.y * 1.3), 2.0) * 0.5;
      grassColor *= rootDarkening;
      
      vec3 normal = normalize(vNormal);
      vec3 lightDir = normalize(lightDirection);
      
      // Ambient component
      vec3 ambient = ambient_strength * grassColor;
      
      // Diffuse component (Lambert)
      float diff = max(dot(normal, lightDir), 0.0);
      vec3 diffuse = diffuse_strength * diff * sunColour * grassColor;
      
      // Specular component (Blinn-Phong)
      vec3 viewDir = normalize(-vPosition);
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), shininess);
      vec3 specular = specular_strength * spec * sunColour;
      
      // Translucency effect (light passing through the blades)
      float translucency = max(0.0, -dot(normal, lightDir)) * translucency_strength;
      vec3 transLight = translucency * sunColour * grassColor;
      
      // Combine all lighting components
      vec3 result = ambient + diffuse + specular + transLight;
      
      // Alpha from texture or gradient falloff
      float alpha = texture2D(alphaMap, vUv).r;
      if (alpha < 0.1) {
        alpha = smoothstep(0.0, 0.5, vUv.y); // Gradient alpha if no texture
      }
      
      gl_FragColor = vec4(result, alpha);
    }
  `,
  (self) => {
    if (!self) return;
    self.side = THREE.DoubleSide;
    self.transparent = false;
  },
);

extend({ GrassMaterial });

interface GrassMaterialElements {
  grassMaterial: ReactThreeFiber.ThreeElement<typeof GrassMaterial>;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends GrassMaterialElements {}
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends GrassMaterialElements {}
  }
}
