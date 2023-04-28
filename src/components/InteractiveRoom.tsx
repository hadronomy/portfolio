'use client';

import { Canvas } from '@react-three/fiber';
import { motion } from 'framer-motion-3d';
import { useState, HTMLAttributes } from 'react';
import { PerformanceMonitor } from '@react-three/drei';

import RotatingCube from '~/components/3d/RotatingCube';

type InteractiveRoomProps = HTMLAttributes<HTMLCanvasElement>;

export default function InteractiveRoom({}: InteractiveRoomProps) {
  const [badPerf, degrade] = useState(false);

  return (
    <Canvas
      shadows
      dpr={[1, badPerf ? 1.5 : 2]}
      camera={{
        fov: 50,
        near: 0.1,
        far: 1000,
        position: [0, 0, 0]
      }}
    >
      <PerformanceMonitor onDecline={() => degrade(true)} />
      <color attach="background" args={['#000000']} />
      <Scene />
    </Canvas>
  );
}

type SceneProps = {};

function Scene({}: SceneProps) {
  return (
    <motion.group dispose={null}>
      <motion.ambientLight />
      <RotatingCube />
    </motion.group>
  );
}
