import {
  cross,
  Fn,
  float,
  floor,
  Loop,
  mix,
  mx_noise_float,
  positionLocal,
  sign,
  transformNormalToView,
  uniform,
  varying,
  vec2,
  vec3,
} from 'three/tsl';

import type { Node } from '~/components/react/nodes/types';

import {
  grassBottomColor,
  grassDarkPatchColor,
  grassLightPatchColor,
  grassTopColor,
} from './grass-material';
import { fbm, snoise } from './nodes';
import { createNodeMaterial } from './nodes/utils';

export const getTerrainHeight = Fn<[Node]>(([position2D]) => {
  const noiseIterations = uniform(3);
  const positionFrequency = uniform(0.01);
  const warpFrequency = uniform(2);
  const warpStrength = uniform(0.3);
  const strength = uniform(20);
  const offset = uniform(vec2(0, 0));

  const warpedPosition = position2D.add(offset).toVar('warpedPosition');
  warpedPosition.addAssign(
    mx_noise_float(
      warpedPosition.mul(positionFrequency).mul(warpFrequency),
      1,
      0,
    ).mul(warpStrength),
  );

  const elevation = float(0).toVar('elevation');
  Loop(
    {
      type: 'uint',
      start: float(1),
      end: noiseIterations.toFloat(),
      condition: '<=',
    },
    ({ i }) => {
      const noiseInput = warpedPosition
        .mul(positionFrequency)
        .mul(float(i).mul(1.5))
        .add(float(i).mul(987))
        .toVar('noiseInput');
      const noise = mx_noise_float(noiseInput, 1, 0)
        .div(float(i).add(1).mul(1.5))
        .toVar('noise');
      elevation.addAssign(noise);
    },
  );

  const elevationSign = sign(elevation).toVar('elevationSign');
  elevation.assign(elevation.abs().pow(1.5).mul(elevationSign).mul(strength));

  return elevation;
});

// Terrain color calculation using same logic as grass
const calculateTerrainColor = Fn<[Node]>(([position]) => {
  // Match the uniforms from grass-material
  const noiseScale = uniform(0.05);
  const noiseQuantize = uniform(4.0);
  const noiseMixStrength = uniform(0.5);
  const colorVariation = uniform(0.8);

  // Static noise (same as grass)
  const staticNoiseScale = float(0.1);
  const staticNoisePos = vec2(
    position.x.mul(staticNoiseScale),
    position.z.mul(staticNoiseScale),
  );
  const staticNoise1 = snoise(staticNoisePos);
  const staticNoise2 = snoise(staticNoisePos.mul(3.0)).mul(0.4);
  const staticNoise3 = snoise(staticNoisePos.mul(6.0)).mul(0.2);
  const combinedStaticNoise = staticNoise1.add(staticNoise2).add(staticNoise3);

  // FBM noise (same as grass)
  const fbmCoord = vec2(
    position.x.mul(noiseScale),
    position.z.mul(noiseScale),
  ).add(vec2(15.5, 7.2));
  const fbmValue = fbm(fbmCoord, float(5), float(2.0), float(0.5));
  const quantizedNoise = floor(fbmValue.mul(noiseQuantize)).div(noiseQuantize);

  // For terrain: use middle gradient (0.3) to match the "field" look of grass
  // instead of just the dark roots (0.0) or bright tips (1.0)
  const heightGradient = float(0.3);

  const brightnessVariation = combinedStaticNoise.mul(0.2).add(0.9);

  // Use the imported shared uniforms
  const baseBottomColor = mix(
    grassBottomColor,
    grassDarkPatchColor,
    quantizedNoise.mul(colorVariation),
  );
  const baseTopColor = mix(
    grassTopColor,
    grassLightPatchColor,
    quantizedNoise.mul(colorVariation),
  );

  const gradientColor = mix(baseTopColor, baseBottomColor, heightGradient);

  const noiseColor = mix(grassDarkPatchColor, grassLightPatchColor, fbmValue);
  const finalColor = mix(gradientColor, noiseColor, noiseMixStrength).mul(
    brightnessVariation,
  );

  return finalColor;
});

export const terrainNodeMaterial = createNodeMaterial((material) => {
  const vNormal = varying(vec3(), 'vNormal');
  const vPosition = varying(vec3(), 'vPosition');

  const normalLookUpShift = uniform(0.01);
  const offset = uniform(vec2(0, 0));

  const positionNode = Fn(() => {
    const neighbourA = positionLocal.xyz
      .add(vec3(normalLookUpShift, 0.0, 0.0))
      .toVar('neighbourA');
    const neighbourB = positionLocal.xyz
      .add(vec3(0.0, 0.0, normalLookUpShift.negate()))
      .toVar('neighbourB');

    const position = positionLocal.xyz.toVar('position');
    const elevation = getTerrainHeight(positionLocal.xz).toVar('elevation');
    position.y.addAssign(elevation);

    neighbourA.y.addAssign(getTerrainHeight(neighbourA.xz));
    neighbourB.y.addAssign(getTerrainHeight(neighbourB.xz));

    const toA = neighbourA.sub(position).normalize().toVar('toA');
    const toB = neighbourB.sub(position).normalize().toVar('toB');
    vNormal.assign(cross(toA, toB));
    vPosition.assign(position.add(vec3(offset.x, 0, offset.y)));

    return position;
  });

  // Color node
  const colorNode = Fn(() => {
    return calculateTerrainColor(vPosition);
  });

  material.positionNode = positionNode();
  material.normalNode = transformNormalToView(vNormal);
  material.colorNode = colorNode();

  return material;
});
