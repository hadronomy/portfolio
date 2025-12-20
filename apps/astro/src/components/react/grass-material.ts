import {
  abs,
  attribute,
  cameraProjectionMatrix,
  color,
  cos,
  cross,
  dot,
  Fn,
  float,
  floor,
  max,
  mix,
  modelViewMatrix,
  normalize,
  normalLocal,
  normalView,
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
import type { Node } from '~/components/react/nodes/types';
import { fbm, noise2D, snoise } from './nodes';
import { createNodeMaterial } from './nodes/utils';
import { getTerrainHeight } from './terrain-material';

// Create TSL-based grass material
export const grassNodeMaterial = createNodeMaterial((material) => {
  const position = attribute('position', 'vec3');
  const offset = attribute('offset', 'vec3');
  const orientation = attribute('orientation', 'vec4');
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

  // Position transformation for vertex shader
  const transformPosition = Fn(() => {
    vUv.assign(uv());

    // Root rotation based on angle attributes
    const rootQ = vec4(0.0, halfRootAngleSin, 0.0, halfRootAngleCos);

    // Combine with orientation quaternion
    const combinedQ = qmul(orientation, rootQ);

    // Scale and transform position
    const transformedPos = applyQuaternion(position.xyz, combinedQ).add(offset);

    // Sample terrain height at the grass position and adjust Y
    const terrainHeight = getTerrainHeight(transformedPos.xz);
    transformedPos.y.assign(transformedPos.y.add(terrainHeight));

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
    return calculateGrassColor(vPosition, uvValue);
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

// Export the grass color calculation for reuse in terrain
export const calculateGrassColor = Fn<[Node, Node]>(([position, uvValue]) => {
  // Grass color parameters
  const bottomColor = uniform(color('#339933'));
  const topColor = uniform(color('#66a61a'));
  const darkPatchColor = uniform(color('#1a801a'));
  const lightPatchColor = uniform(color('#8cbf00'));

  // Noise control parameters
  const noiseScale = uniform(0.05);
  const noiseQuantize = uniform(4.0);
  const noiseMixStrength = uniform(0.5);
  const edgeHighlightStrength = uniform(0.01);
  const colorVariation = uniform(0.8);

  // Calculate moving noise pattern
  const moveSpeed = float(0.2);

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
  const combinedStaticNoise = staticNoise1.add(staticNoise2).add(staticNoise3);

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
  const quantizedNoise = floor(fbmValue.mul(noiseQuantize)).div(noiseQuantize);

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

  return grassColor;
});
