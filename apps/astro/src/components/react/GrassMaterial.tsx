import { shaderMaterial } from '@react-three/drei';
import { type ReactThreeFiber, extend } from '@react-three/fiber';
import * as THREE from 'three';

// Create custom grass blade material using shaderMaterial
export const GrassMaterial = shaderMaterial(
  {
    time: 0,
    map: null,
    alphaMap: null,
    blade_height: 1.0,
    blade_width: 0.12,
    ambient_strength: 0.7,
    diffuse_strength: 1.5,
    specular_strength: 1.0,
    translucency_strength: 1.5,
    shininess: 256,
    sunColour: new THREE.Color(1.0, 1.0, 1.0),
    lightDirection: new THREE.Vector3(0.0, 1.0, 0.0).normalize(),
  },
  /* Vertex shader */
  `
    attribute vec3 offset;
    attribute vec4 orientation;
    attribute float stretch;
    attribute float halfRootAngleSin;
    attribute float halfRootAngleCos;

    uniform float time;
    uniform float blade_height;
    uniform float blade_width;

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
      vec3 transformedPosition = position.xyz * vec3(1.0, stretch, 1.0);
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
      
      // Convert to brightness variation factor
      float brightnessVariation = combinedNoise * 0.2 + 0.9; // Range [0.7, 1.1]
      
      // Base grass color from texture or default green if no texture
      vec3 grassColor = texture2D(map, vUv).rgb;
      if (length(grassColor) < 0.1) {
        // Use base green color (more versatile than fixed value)
        vec3 baseGreen = vec3(0.3, 0.7, 0.2);
        
        // Create vertical gradient - greener at base, yellower at tip
        // vUv.y is 0 at bottom and 1 at tip of grass blade
        float heightGradient = 1.0 - vUv.y; // 1 at base, 0 at tip
        
        // Adjust color components based on height
        // More saturated green at the bottom (increase green channel)
        // More yellow tint at the top (reduce blue, increase red slightly)
        vec3 bottomColor = vec3(0.2, 0.8, 0.2); // More saturated green
        vec3 topColor = vec3(0.4, 0.65, 0.1);   // Slightly yellower green
        
        grassColor = mix(topColor, bottomColor, heightGradient);
      }
      
      // Apply brightness variation to the grass color
      grassColor *= brightnessVariation;
      
      // Apply subtle darkening near the very bottom for root effect
      float rootDarkening = 1.0 - pow(max(0.0, 1.0 - vUv.y * 10.0), 2.0) * 0.5;
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
    self.transparent = true;
  },
);

extend({ GrassMaterial });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      grassMaterial: ReactThreeFiber.ReactProps<THREE.ShaderMaterial>;
    }
  }
}
