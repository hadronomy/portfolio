import {
  attribute,
  cameraProjectionMatrix,
  color,
  cos,
  cross,
  Fn,
  float,
  floor,
  max,
  mix,
  mod,
  modelViewMatrix,
  normalLocal,
  pow,
  sin,
  smoothstep,
  texture,
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

export const grassBottomColor = uniform(color('#339933'));
export const grassTopColor = uniform(color('#66a61a'));
export const grassDarkPatchColor = uniform(color('#1a801a'));
export const grassLightPatchColor = uniform(color('#8cbf00'));

export const grassNodeMaterial = (grassTexture: THREE.Texture) =>
  createNodeMaterial((material) => {
    const position = attribute('position', 'vec3');
    const offset = attribute('offset', 'vec3');
    const orientation = attribute('orientation', 'vec4');
    const halfRootAngleSin = attribute('halfRootAngleSin', 'float');
    const halfRootAngleCos = attribute('halfRootAngleCos', 'float');
    const textureIndex = attribute('textureIndex', 'float');

    const vPosition = varying(vec3(), 'vPosition');
    const vNormal = varying(vec3(), 'vNormal');
    const vUv = varying(vec3(), 'vUv');

    const ambientStrength = uniform(0.7);
    const diffuseStrength = uniform(1.5);
    const specularStrength = uniform(1.0);
    const translucencyStrength = uniform(1.5);
    const shininess = uniform(120);
    const sunColour = uniform(new THREE.Color(1.0, 1.0, 1.0));
    const lightDirection = uniform(
      new THREE.Vector3(1.0, 0.0, 0.0).normalize(),
    );

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

    const applyQuaternion = Fn<[Node, Node]>(([v, q]) => {
      const temp = cross(q.xyz, v).mul(2.0);
      return v.add(temp.mul(q.w)).add(cross(q.xyz, temp));
    });

    const calculateAtlasUV = Fn(() => {
      const baseUV = uv();
      const safeUV = baseUV.mul(0.9).add(0.05);
      const scaledUV = safeUV.mul(0.5);
      const col = mod(textureIndex, 2.0);
      const row = floor(textureIndex.div(2.0));
      const uvOffset = vec2(col.mul(0.5), row.mul(0.5));
      return scaledUV.add(uvOffset);
    });

    const transformPosition = Fn(() => {
      vUv.assign(uv());

      const rootQ = vec4(0.0, halfRootAngleSin, 0.0, halfRootAngleCos);
      const combinedQ = qmul(orientation, rootQ);
      const transformedPos = applyQuaternion(position.xyz, combinedQ).add(
        offset,
      );
      const terrainHeight = getTerrainHeight(transformedPos.xz);
      transformedPos.y.assign(transformedPos.y.add(terrainHeight));

      vPosition.assign(transformedPos);

      const windStrength = float(0.3);
      const windFrequency = float(0.5);
      const windEffect = pow(position.y, 2.0).mul(windStrength);
      const windTime = time.mul(windFrequency);

      const noiseValue = noise2D(
        vec2(vPosition.x.add(windTime), vPosition.z.add(windTime.mul(0.5))),
      );

      const windDisplacement = vec3(
        sin(windTime.add(vPosition.x.mul(0.5)))
          .mul(noiseValue)
          .mul(windEffect),
        0.0,
        cos(windTime.mul(0.7).add(vPosition.z.mul(0.5)))
          .mul(noiseValue)
          .mul(windEffect),
      );

      const windFactor = smoothstep(0.2, 0.6, position.y);
      vPosition.assign(vPosition.add(windDisplacement.mul(windFactor)));
      vNormal.assign(applyQuaternion(normalLocal, combinedQ));

      return cameraProjectionMatrix
        .mul(modelViewMatrix)
        .mul(vec4(vPosition, 1.0));
    });

    // MOVED: Discard must be inside this Fn
    const calculateFragment = Fn(() => {
      const atlasCoords = calculateAtlasUV();
      const maskSample = texture(grassTexture, atlasCoords).r;

      // DISCARD HERE - inside the Fn context
      maskSample.lessThan(0.6).discard();

      const baseColor = calculateGrassColor(vPosition, vUv);
      const detailFactor = maskSample.mul(0.5).add(0.5);
      const finalColor = baseColor.mul(detailFactor);

      return vec4(finalColor, 1.0);
    });

    material.vertexNode = transformPosition();

    // IMPORTANT: Fix normal for PBR/Environment calculations
    material.normalNode = vec3(0.0, 1.0, 0.0);

    // Call the Fn to get the output node
    material.fragmentNode = calculateFragment();

    material.side = THREE.DoubleSide;
    material.transparent = false; // Cutout mode, not transparency

    return material;
  });

// Helper (unchanged)
export const calculateGrassColor = Fn<[Node, Node]>(([position, uvValue]) => {
  const bottomColor = grassBottomColor;
  const topColor = grassTopColor;
  const darkPatchColor = grassDarkPatchColor;
  const lightPatchColor = grassLightPatchColor;
  const noiseScale = uniform(0.05);
  const noiseQuantize = uniform(4.0);
  const noiseMixStrength = uniform(0.5);
  const edgeHighlightStrength = uniform(0.01);
  const colorVariation = uniform(0.8);

  const moveSpeed = float(0.2);
  const noisePos = vec2(
    position.x.mul(noiseScale).add(time.mul(moveSpeed)),
    position.z.mul(noiseScale).add(time.mul(moveSpeed).mul(0.7)),
  );

  const noise1 = snoise(noisePos);
  const noise2 = snoise(noisePos.mul(2.0)).mul(0.5);
  const noise3 = snoise(noisePos.mul(4.0)).mul(0.25);
  const combinedNoise = noise1.add(noise2).add(noise3);

  const staticNoiseScale = float(0.1);
  const staticNoisePos = vec2(
    position.x.mul(staticNoiseScale),
    position.z.mul(staticNoiseScale),
  );
  const staticNoise1 = snoise(staticNoisePos);
  const staticNoise2 = snoise(staticNoisePos.mul(3.0)).mul(0.4);
  const staticNoise3 = snoise(staticNoisePos.mul(6.0)).mul(0.2);
  const combinedStaticNoise = staticNoise1.add(staticNoise2).add(staticNoise3);

  const finalNoise = combinedNoise.mul(0.6).add(combinedStaticNoise.mul(0.4));
  const brightnessVariation = finalNoise.mul(0.2).add(0.9);

  const fbmCoord = vec2(
    position.x.mul(noiseScale),
    position.z.mul(noiseScale),
  ).add(vec2(15.5, 7.2));
  const fbmValue = fbm(fbmCoord, float(5), float(2.0), float(0.5));
  const quantizedNoise = floor(fbmValue.mul(noiseQuantize)).div(noiseQuantize);

  const heightGradient = uvValue.y;

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
  const gradientColor = mix(
    baseTopColor,
    baseBottomColor,
    heightGradient,
  ).toVar();

  const noiseColor = mix(darkPatchColor, lightPatchColor, fbmValue).toVar();
  gradientColor.assign(mix(gradientColor, noiseColor, noiseMixStrength));

  // const edgeHighlight = smoothstep(
  //   0.2,
  //   0.3,
  //   abs(fbmValue.sub(0.5)).mul(2.0),
  // ).mul(edgeHighlightStrength);
  // gradientColor.addAssign(vec3(edgeHighlight));

  const grassColor = gradientColor.toVar();
  grassColor.mulAssign(brightnessVariation);

  // const rootDarkening = float(1.0).sub(
  //   pow(max(0.0, uvValue.y.oneMinus().mul(1.3)), 2.0).mul(0.5),
  // );
  // grassColor.mulAssign(rootDarkening);

  return grassColor;
});
