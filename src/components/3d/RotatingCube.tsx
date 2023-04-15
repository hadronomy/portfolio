import { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion, useTime } from 'framer-motion-3d';

type Props = {};

export default function RotatingCube({}: Props) {
  return (
    <motion.mesh
      animate={{
        rotateX: 2 * Math.PI,
        transition: { duration: 3, repeat: Infinity, ease: 'anticipate' }
      }}
      position={[0.0, 0.25, -5.0]}
    >
      <motion.boxGeometry args={[2, 2, 2]} />
      <motion.meshStandardMaterial />
    </motion.mesh>
  );
}
