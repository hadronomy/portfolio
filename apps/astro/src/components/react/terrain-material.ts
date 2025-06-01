import {
  Fn,
  Loop,
  cross,
  float,
  mx_noise_float,
  positionLocal,
  sign,
  transformNormalToView,
  uniform,
  varying,
  vec2,
  vec3,
} from 'three/tsl';

import { calculateGrassColor } from './grass-material';
import { createNodeMaterial } from './nodes/utils';

import type { Node } from '~/components/react/nodes/types';

// Terrain elevation function based on Three.js WebGPU example
export const getTerrainHeight = Fn<[Node]>(([position2D]) => {
  const noiseIterations = uniform(3); // Reduced iterations for smoother terrain
  const positionFrequency = uniform(0.01);
  const warpFrequency = uniform(2); // Reduced warp frequency for smoother distortion
  const warpStrength = uniform(0.3); // Reduced warp strength for gentler distortion
  const strength = uniform(20); // Increased strength for more dramatic height differences
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
        .mul(float(i).mul(1.5)) // Reduced multiplier for less dramatic octave scaling
        .add(float(i).mul(987))
        .toVar('noiseInput');
      const noise = mx_noise_float(noiseInput, 1, 0)
        .div(float(i).add(1).mul(1.5)) // Reduced divisor for smoother blending
        .toVar('noise');
      elevation.addAssign(noise);
    },
  );

  const elevationSign = sign(elevation).toVar('elevationSign');
  elevation.assign(elevation.abs().pow(1.5).mul(elevationSign).mul(strength)); // Reduced power for gentler curves

  return elevation;
});

export const terrainNodeMaterial = createNodeMaterial((material) => {
  const vNormal = varying(vec3(), 'vNormal');
  const vPosition = varying(vec3(), 'vPosition');

  // Terrain parameters
  const normalLookUpShift = uniform(0.01);
  const offset = uniform(vec2(0, 0));

  // Position node for vertex displacement
  const positionNode = Fn(() => {
    // Neighbours positions for normal calculation
    const neighbourA = positionLocal.xyz
      .add(vec3(normalLookUpShift, 0.0, 0.0))
      .toVar('neighbourA');
    const neighbourB = positionLocal.xyz
      .add(vec3(0.0, 0.0, normalLookUpShift.negate()))
      .toVar('neighbourB');

    // Elevations
    const position = positionLocal.xyz.toVar('position');
    const elevation = getTerrainHeight(positionLocal.xz).toVar('elevation');
    position.y.addAssign(elevation);

    neighbourA.y.addAssign(getTerrainHeight(neighbourA.xz));
    neighbourB.y.addAssign(getTerrainHeight(neighbourB.xz));

    // Compute normal
    const toA = neighbourA.sub(position).normalize().toVar('toA');
    const toB = neighbourB.sub(position).normalize().toVar('toB');
    vNormal.assign(cross(toA, toB));

    // Varyings
    vPosition.assign(position.add(vec3(offset.x, 0, offset.y)));

    return position;
  });

  // Color node for terrain texturing
  const colorNode = Fn(() => {
    // Use the same grass color calculation as the grass material
    // For terrain, we use a flat UV where y=0 to get the base grass color
    const terrainUv = vec2(0, 0);
    const grassColor = calculateGrassColor(vPosition, terrainUv);

    const finalColor = grassColor.toVar('finalColor');

    // Keep existing logic for different terrain features if needed
    // You can uncomment and modify these if you want variations based on elevation/slope
    /*
    // Rock based on slope
    const normalDotUp = dot(vNormal, vec3(0, 1, 0)).toVar('normalDotUp');
    const rockMix = step(0.5, normalDotUp)
      .oneMinus()
      .mul(step(-0.06, vPosition.y))
      .toVar('rockMix');
    finalColor.assign(rockMix.mix(finalColor, colorRock));

    // Snow with noise threshold
    const snowNoise = mx_noise_float(vPosition.xz.mul(25), 1, 0).toVar(
      'snowNoise',
    );
    const snowThreshold = snowNoise.mul(0.1).add(0.45).toVar('snowThreshold');
    const snowMix = step(snowThreshold, vPosition.y).toVar('snowMix');
    finalColor.assign(snowMix.mix(finalColor, colorSnow));
    */

    return finalColor;
  });

  // Apply nodes to material
  material.positionNode = positionNode();
  material.normalNode = transformNormalToView(vNormal);
  material.colorNode = colorNode();

  // Material properties
  // material.metalness = 0;
  // material.roughness = 0.5;
  // material.side = THREE.DoubleSide;

  return material;
});
