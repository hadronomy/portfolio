'use client';

import * as React from 'react';
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { motion } from 'framer-motion-3d';

import { RotatingCube } from '~/components/3d/rotating-cube';

export type InteractiveRoomProps = Omit<
  React.ComponentProps<typeof Canvas>,
  'children'
>;

export function InteractiveRoom({}: InteractiveRoomProps) {
  const [badPerf, degrade] = React.useState(false);

  return (
    <Canvas
      shadows
      dpr={[1, badPerf ? 1.5 : 2]}
      camera={{
        fov: 50,
        near: 0.1,
        far: 1000,
        position: [0, 0, 0],
      }}
    >
      <PerformanceMonitor onDecline={() => degrade(true)} />
      <color attach="background" args={['#000000']} />
      <Scene />
    </Canvas>
  );
}

type SceneProps = Record<string, never>;

function Scene({}: SceneProps) {
  return (
    <motion.group dispose={null}>
      <motion.ambientLight />
      <RotatingCube />
    </motion.group>
  );
}
