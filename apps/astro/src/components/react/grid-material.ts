import {
  Fn,
  abs,
  cameraPosition,
  color,
  dFdx,
  dFdy,
  float,
  fract,
  length,
  max,
  min,
  mix,
  positionLocal,
  positionWorld,
  smoothstep,
  uniform,
  vec2,
  vec4,
} from 'three/tsl';
import * as THREE from 'three/webgpu';

import type { Node } from '~/components/react/nodes/types';
import { createNodeMaterial } from './nodes/utils';

export const gridNodeMaterial = createNodeMaterial((material) => {
  const CROSS_GRID_SCALE = float(300.0); // Controls cross density, not size
  const MAIN_LINE_GRID_SCALE = float(100.0); // Bigger cells for main lines

  // Fixed cross size in world space (independent of grid scale)
  const CROSS_SIZE_WORLD = float(0.0005); // Fixed world space size
  const CROSS_ARM_LENGTH_REL = float(0.5);
  const CROSS_STROKE_WIDTH_REL = float(0.12);

  const MAIN_LINE_THICKNESS = float(0.001); // Thinner lines

  // Distance fade parameters
  const FADE_START_DISTANCE = float(100.0); // Distance where fade starts
  const FADE_END_DISTANCE = float(500.0); // Distance where grid is completely invisible

  // Colors
  const BG_COLOR = uniform(color(0.03, 0.03, 0.04));
  const CROSS_COLOR = uniform(color(0.3, 0.3, 0.9));
  const MAIN_LINE_COLOR = uniform(color(0.95, 0.95, 0.95)); // Explicit white

  const sdfBox = Fn<[Node, Node]>(([p, b]) => {
    const d = abs(p).sub(b);
    return length(max(d, float(0.0))).add(min(max(d.x, d.y), float(0.0)));
  });

  // Screen-space anti-aliasing helper
  const getScreenSpaceAA = Fn<[Node]>(([coord]) => {
    const fw = length(vec2(dFdx(coord), dFdy(coord)));
    return fw;
  });

  // Use world space for consistent positioning
  const worldUV = positionLocal.xy.toVar('worldUV');

  // Create grid in world space for crosses (smaller cells) - offset by 0.5 to align with main grid corners
  const crossGridUV = worldUV
    .mul(CROSS_GRID_SCALE)
    .add(float(0.5))
    .toVar('crossGridUV');
  const crossCellUV = fract(crossGridUV).toVar('crossCellUV');
  const pCross = crossCellUV.sub(float(0.5)).toVar('pCross');

  // Screen-space derivatives for cross grid
  const crossAA = getScreenSpaceAA(crossGridUV).toVar('crossAA');

  // Fixed cross size with screen-space compensation
  const armLenHalf = CROSS_SIZE_WORLD.mul(CROSS_ARM_LENGTH_REL)
    .div(float(2.0))
    .mul(CROSS_GRID_SCALE)
    .toVar('armLenHalf');
  const strokeWidthHalf = CROSS_SIZE_WORLD.mul(CROSS_STROKE_WIDTH_REL)
    .div(float(2.0))
    .mul(CROSS_GRID_SCALE)
    .toVar('strokeWidthHalf');

  const sdfHBar = sdfBox(pCross, vec2(armLenHalf, strokeWidthHalf)).toVar(
    'sdfHBar',
  );
  const sdfVBar = sdfBox(pCross, vec2(strokeWidthHalf, armLenHalf)).toVar(
    'sdfVBar',
  );

  const crossSDF = min(sdfHBar, sdfVBar).toVar('crossSDF');
  const crossMask = float(1.0)
    .sub(smoothstep(crossAA.negate(), crossAA, crossSDF))
    .toVar('crossMask');

  // Create grid for main lines (bigger cells)
  const mainLineGridUV = worldUV
    .mul(MAIN_LINE_GRID_SCALE)
    .toVar('mainLineGridUV');
  const mainLineCellUV = fract(mainLineGridUV).toVar('mainLineCellUV');

  // Screen-space derivatives for main grid
  const mainLineAA = getScreenSpaceAA(mainLineGridUV).toVar('mainLineAA');

  // Calculate distance to cell borders
  const distToLeft = mainLineCellUV.x.toVar('distToLeft');
  const distToRight = float(1.0).sub(mainLineCellUV.x).toVar('distToRight');
  const distToBottom = mainLineCellUV.y.toVar('distToBottom');
  const distToTop = float(1.0).sub(mainLineCellUV.y).toVar('distToTop');

  // Find minimum distance to any border
  const distToBorder = min(
    min(distToLeft, distToRight),
    min(distToBottom, distToTop),
  ).toVar('distToBorder');

  // Main line thickness in grid space
  const mainLineThickness = MAIN_LINE_THICKNESS.toVar('mainLineThickness');

  // Create border mask with screen-space anti-aliasing
  const mainLinesMask = float(1.0)
    .sub(
      smoothstep(
        mainLineThickness.div(float(2.0)).sub(mainLineAA),
        mainLineThickness.div(float(2.0)).add(mainLineAA),
        distToBorder,
      ),
    )
    .toVar('mainLinesMask');

  // Layer the elements - crosses on top of main lines
  const finalColor = BG_COLOR;
  const mix1Color = mix(finalColor, MAIN_LINE_COLOR, mainLinesMask).toVar(
    'mix1Color',
  );
  const mix2Color = mix(mix1Color, CROSS_COLOR, crossMask).toVar('mix2Color');

  // Calculate distance from camera for fade
  const distanceFromCamera = length(positionWorld.sub(cameraPosition)).toVar(
    'distanceFromCamera',
  );

  // Calculate distance fade factor (1.0 at close distance, 0.0 at far distance)
  const distanceFade = float(1.0)
    .sub(smoothstep(FADE_START_DISTANCE, FADE_END_DISTANCE, distanceFromCamera))
    .toVar('distanceFade');

  // Calculate total alpha based on visible elements and distance fade
  const totalAlpha = max(mainLinesMask, crossMask)
    .mul(distanceFade)
    .toVar('totalAlpha');

  material.fragmentNode = vec4(mix2Color.xyz, totalAlpha);
  material.side = THREE.DoubleSide;

  // Enable transparency
  material.transparent = true;
  material.alphaTest = 0.0;

  return material;
});
