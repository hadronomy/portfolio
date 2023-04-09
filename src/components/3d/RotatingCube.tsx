import { useState, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { motion, useTime } from "framer-motion-3d"

export default function RotatingCube() {
  return (
    <motion.mesh animate={{ rotateX: 2 * Math.PI, transition: { duration: 3, repeat: Infinity, ease: "anticipate" }}}>
      <motion.boxGeometry args={[2, 2, 2]} />
      <motion.meshStandardMaterial />
    </motion.mesh>
  )
}
