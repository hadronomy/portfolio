import { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { motion, useTime } from 'framer-motion-3d';

export default function RotatingCube(props: any) {
  return (
    <motion.mesh
      {...props}
      animate={{
        rotateX: 2 * Math.PI,
        transition: { duration: 3, repeat: Infinity, ease: 'anticipate' }
      }}
      position={[1.8, 0.3, -5.0]}
    >
      <motion.boxGeometry args={[2, 2, 2]} />
      <motion.meshStandardMaterial />
    </motion.mesh>
  );
}
