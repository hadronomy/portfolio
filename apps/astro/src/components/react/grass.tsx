import {
  AdaptiveDpr,
  OrbitControls,
  PerformanceMonitor,
  Plane,
  StatsGl,
  useGLTF,
} from '@react-three/drei';
import { Canvas, extend } from '@react-three/fiber';
import type React from 'react';
import { Suspense, useMemo, useState } from 'react';
import { DEG2RAD } from 'three/src/math/MathUtils.js';
import * as THREE from 'three/webgpu';

import { grassNodeMaterial } from './grass-material';
import { gridNodeMaterial } from './grid-material';
import { terrainNodeMaterial } from './terrain-material';

export interface GrassViewProps extends React.ComponentProps<typeof Canvas> {
  showStats?: boolean;
}

export function GrassView(props: GrassViewProps) {
  const {
    children,
    camera = {
      position: [0, 2, 5],
      rotation: [-0.0001, 0, 0],
      fov: 35,
      near: 0.001,
      far: 1000,
    },
    showStats,
    ...rest
  } = props;

  const [grassCount, _setGrassCount] = useState(250000);
  const [dpr, setDpr] = useState(1);
  const [isHovering, setIsHovering] = useState(false);

  return (
    <Canvas
      gl={(props) => {
        // @ts-ignore: needed
        extend(THREE);
        // @ts-ignore: needed
        const renderer = new THREE.WebGPURenderer(props);
        return renderer.init().then(() => renderer);
      }}
      frameloop={showStats || isHovering ? 'always' : 'demand'}
      camera={camera}
      dpr={dpr}
      onPointerEnter={() => setIsHovering(true)}
      onPointerLeave={() => setIsHovering(false)}
      {...rest}
    >
      <PerformanceMonitor
        onDecline={(_fps) => {
          setDpr((prevDpr) => Math.max(0.5, prevDpr * 0.75));
        }}
        onIncline={(_fps) => {
          setDpr((prevDpr) => Math.min(2, prevDpr * 1.1));
        }}
        bounds={(_) => [30, 60]}
        factor={0.5}
      />
      <AdaptiveDpr pixelated />
      <ambientLight intensity={1} />
      {showStats && (
        <StatsGl className="absolute top-0 left-0" horizontal={false} />
      )}
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Suspense>
        <Grass instances={grassCount} />
      </Suspense>
      {showStats && <WorldPlane />}
      {children}
      {showStats && <OrbitControls />}
    </Canvas>
  );
}

export function WorldPlane(_props: {}) {
  const material = gridNodeMaterial();

  return (
    <Plane
      position={[0, 0, 0]}
      scale={[1000, 1000, 0]}
      rotation={[-90 * DEG2RAD, 0, 0]}
    >
      <nodeMaterial {...material} />
    </Plane>
  );
}

interface GrassProps {
  instances?: number;
}

export function Grass({ instances = 5000 }: GrassProps) {
  // Use a more specific type for materialRef
  const { nodes, materials: _ } = useGLTF('/anime-grass.glb');
  const bladeMesh = nodes.GrassBlade as THREE.Mesh;

  // Adjust width based on viewport
  const actualWidth = 100;

  // Use model geometry instead of plane geometry
  const baseGeometry = useMemo(() => {
    // Get the blade geometry from the loaded model
    const modelGeometry = bladeMesh.geometry.clone();

    // Center the geometry at the bottom for proper rotation
    const box = new THREE.Box3().setFromObject(new THREE.Mesh(modelGeometry));
    const center = box.getCenter(new THREE.Vector3());

    // Adjust position so bottom is at origin and blade grows upward
    modelGeometry.translate(-center.x, -box.min.y, -center.z);

    return modelGeometry;
  }, [bladeMesh.geometry]);

  // Generate terrain geometry - large plane that can be repositioned
  const terrainGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1000, 1000, 256, 256);
    geo.rotateX(-Math.PI * 0.5);
    return geo;
  }, []);

  const material = useMemo(() => grassNodeMaterial(), []);
  const terrainMaterial = useMemo(() => terrainNodeMaterial(), []);

  // Get attribute data for all instances (no height calculation needed)
  const attributeData = useMemo(
    () => getAttributeData(instances, actualWidth),
    [instances],
  );

  return (
    <group>
      {/* Procedural terrain */}
      <mesh geometry={terrainGeo} receiveShadow castShadow>
        <nodeMaterial {...terrainMaterial} />
      </mesh>

      {/* Grass instances */}
      <mesh>
        <instancedBufferGeometry
          index={baseGeometry.index}
          instanceCount={instances}
          attributes-position={baseGeometry.attributes.position}
          attributes-uv={baseGeometry.attributes.uv}
          attributes-normal={baseGeometry.attributes.normal}
        >
          <instancedBufferAttribute
            attach={'attributes-offset'}
            args={[new Float32Array(attributeData.offsets), 3]}
          />
          <instancedBufferAttribute
            attach={'attributes-orientation'}
            args={[new Float32Array(attributeData.orientations), 4]}
          />
          <instancedBufferAttribute
            attach={'attributes-halfRootAngleSin'}
            args={[new Float32Array(attributeData.halfRootAngleSin), 1]}
          />
          <instancedBufferAttribute
            attach={'attributes-halfRootAngleCos'}
            args={[new Float32Array(attributeData.halfRootAngleCos), 1]}
          />
        </instancedBufferGeometry>
        <nodeMaterial {...material} />
      </mesh>
    </group>
  );
}

useGLTF.preload('/anime-grass.glb');

// Helper functions
function getAttributeData(instances: number, width: number) {
  const offsets: number[] = [];
  const orientations: number[] = [];
  const sizes: number[] = [];
  const halfRootAngleSin: number[] = [];
  const halfRootAngleCos: number[] = [];

  let quaternion_0 = new THREE.Vector4();
  const quaternion_1 = new THREE.Vector4();

  // Min and max angle for the growth direction (in radians)
  const min = -0.25;
  const max = 0.25;

  // For each instance of the grass blade
  for (let i = 0; i < instances; i++) {
    // Position of the roots
    // Calculate grid dimensions to distribute grass more evenly
    const cellsPerSide = Math.ceil(Math.sqrt(instances));
    const cellSize = width / cellsPerSide;

    // Determine grid position for this instance
    const gridX = Math.floor(i / cellsPerSide);
    const gridZ = i % cellsPerSide;

    // Calculate base position (center of grid cell)
    const baseX = gridX * cellSize - width / 2 + cellSize / 2;
    const baseZ = gridZ * cellSize - width / 2 + cellSize / 2;

    // Add random offset within the cell (80% of cell size to prevent overlap with adjacent cells)
    const jitterSize = cellSize * 0.8;
    const offsetX = baseX + (Math.random() * jitterSize - jitterSize / 2);
    const offsetZ = baseZ + (Math.random() * jitterSize - jitterSize / 2);

    // No height calculation needed - GPU will handle it
    const offsetY = 0;

    offsets.push(offsetX, offsetY, offsetZ);

    // Random growth directions
    // Rotate around Y
    let angle = Math.PI - Math.random() * (2 * Math.PI);
    halfRootAngleSin.push(Math.sin(0.5 * angle));
    halfRootAngleCos.push(Math.cos(0.5 * angle));

    let rotationAxis = new THREE.Vector3(0, 1, 0);
    let x = rotationAxis.x * Math.sin(angle / 2.0);
    let y = rotationAxis.y * Math.sin(angle / 2.0);
    let z = rotationAxis.z * Math.sin(angle / 2.0);
    let w = Math.cos(angle / 2.0);
    quaternion_0.set(x, y, z, w).normalize();

    // Rotate around X
    angle = Math.random() * (max - min) + min;
    rotationAxis = new THREE.Vector3(1, 0, 0);
    x = rotationAxis.x * Math.sin(angle / 2.0);
    y = rotationAxis.y * Math.sin(angle / 2.0);
    z = rotationAxis.z * Math.sin(angle / 2.0);
    w = Math.cos(angle / 2.0);
    quaternion_1.set(x, y, z, w).normalize();

    // Combine rotations to a single quaternion
    quaternion_0 = multiplyQuaternions(quaternion_0, quaternion_1);

    // Rotate around Z
    angle = Math.random() * (max - min) + min;
    rotationAxis = new THREE.Vector3(0, 0, 1);
    x = rotationAxis.x * Math.sin(angle / 2.0);
    y = rotationAxis.y * Math.sin(angle / 2.0);
    z = rotationAxis.z * Math.sin(angle / 2.0);
    w = Math.cos(angle / 2.0);
    quaternion_1.set(x, y, z, w).normalize();

    // Combine rotations to a single quaternion
    quaternion_0 = multiplyQuaternions(quaternion_0, quaternion_1);

    orientations.push(
      quaternion_0.x,
      quaternion_0.y,
      quaternion_0.z,
      quaternion_0.w,
    );

    // Add variety in height
    if (Math.random() < 0.33) {
      // Approximately 1/3 of instances
      sizes.push(0.8 + Math.random() * 1.0); // Range from 0.8 to 1.8
    } else {
      sizes.push(0.8 + Math.random() * 0.2); // Range from 0.8 to 1.0
    }
  }

  return {
    offsets,
    orientations,
    sizes,
    halfRootAngleCos,
    halfRootAngleSin,
  };
}

function multiplyQuaternions(q1: THREE.Vector4, q2: THREE.Vector4) {
  const x = q1.x * q2.w + q1.y * q2.z - q1.z * q2.y + q1.w * q2.x;
  const y = -q1.x * q2.z + q1.y * q2.w + q1.z * q2.x + q1.w * q2.y;
  const z = q1.x * q2.y - q1.y * q2.x + q1.z * q2.w + q1.w * q2.z;
  const w = -q1.x * q2.x - q1.y * q2.y - q1.z * q2.z + q1.w * q2.w;
  return new THREE.Vector4(x, y, z, w);
}

// Remove getYPosition function since it's now handled by terrain material
