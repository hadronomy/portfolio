import { motion } from 'framer-motion-3d';

export type RotatingCubeProps = {};

export function RotatingCube({}: RotatingCubeProps) {
  return (
    <motion.mesh
      animate={{
        rotateX: 2 * Math.PI,
        transition: { duration: 3, repeat: Infinity, ease: 'anticipate' }
      }}
      position={[0.0, 0.25, -7.0]}
    >
      <motion.boxGeometry args={[2, 2, 2]} />
      <motion.meshStandardMaterial />
    </motion.mesh>
  );
}
