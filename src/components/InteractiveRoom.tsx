import { Canvas } from '@react-three/fiber';
import { motion, useTime } from 'framer-motion-3d';
import { useState } from 'react';
import { PerformanceMonitor } from '@react-three/drei';
import RotatingCube from '@components/3d/RotatingCube';

export default function InteractiveRoom() {
  const [badPerf, degrade] = useState(false);
  return (
    <Canvas shadows dpr={[1, badPerf ? 1.5 : 2]}>
      <PerformanceMonitor onDecline={() => degrade(true)} />
      <color attach="background" args={['#000000']} />
      <Scene />
    </Canvas>
  );
}

function Scene(props: any) {
  const time = useTime();
  return (
    <motion.group {...props} dispose={null}>
      <motion.ambientLight />
      <RotatingCube />
    </motion.group>
  );
}
