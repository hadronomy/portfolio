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
import { Suspense, useEffect, useMemo, useState } from 'react';
import { DEG2RAD } from 'three/src/math/MathUtils.js';
import * as THREE from 'three/webgpu';

import { grassNodeMaterial } from './grass-material';
import { gridNodeMaterial } from './grid-material';
import { terrainNodeMaterial } from './terrain-material';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      nodeMaterial: any;
      instancedBufferAttribute: any;
    }
  }
}

extend(THREE as any);

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

  const [dpr, setDpr] = useState(1);
  const [isHovering, setIsHovering] = useState(false);

  // High-level states for the loading sequence
  const [isGPUReady, setIsGPUReady] = useState(false);
  const [showScene, setShowScene] = useState(false);

  // Trigger visual fade-in shortly after GPU reports ready
  useEffect(() => {
    if (isGPUReady) {
      const timeout = setTimeout(() => setShowScene(true), 100);
      return () => clearTimeout(timeout);
    }
  }, [isGPUReady]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#030304',
        overflow: 'hidden',
      }}
    >
      {/* Visual Overlay for Blur/Fade effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          pointerEvents: 'none',
          backdropFilter: showScene ? 'blur(0px)' : 'blur(20px)',
          backgroundColor: showScene ? 'rgba(0,0,0,0)' : 'rgba(3, 3, 4, 1)',
          transition: 'backdrop-filter 1.5s ease, background-color 1.2s ease',
        }}
      />

      <Canvas
        // Modern WebGPU Pattern
        gl={async (canvasProps) => {
          const renderer = new THREE.WebGPURenderer(canvasProps as any);
          await renderer.init();
          return renderer;
        }}
        frameloop={
          !isGPUReady
            ? 'never'
            : showScene && !isHovering && !showStats
              ? 'demand'
              : 'always'
        }
        camera={camera}
        dpr={dpr}
        onPointerEnter={() => setIsHovering(true)}
        onPointerLeave={() => setIsHovering(false)}
        // onCreated ensures the renderer is finished and the domElement exists
        onCreated={() => setIsGPUReady(true)}
        style={{
          opacity: showScene ? 1 : 0,
          transform: showScene ? 'scale(1)' : 'scale(1.05)',
          transition: 'opacity 1.5s ease, transform 2s ease-out',
        }}
        {...rest}
      >
        <PerformanceMonitor
          onDecline={() => setDpr((prev) => Math.max(0.5, prev * 0.75))}
          onIncline={() => setDpr((prev) => Math.min(2, prev * 1.1))}
        />

        {isGPUReady && (
          <Suspense fallback={null}>
            <SceneContent showStats={showStats}>{children}</SceneContent>
          </Suspense>
        )}
      </Canvas>
    </div>
  );
}

/**
 * Scene Logic
 * Only rendered once isGPUReady is true
 */
function SceneContent({
  children,
  showStats,
}: {
  children?: React.ReactNode;
  showStats?: boolean;
}) {
  return (
    <>
      <AdaptiveDpr pixelated />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />

      <Grass instances={150000} />

      {showStats && (
        <>
          <StatsGl className="absolute top-0 left-0" />
          <WorldPlane />
          <OrbitControls makeDefault />
        </>
      )}
      {children}
    </>
  );
}

export function WorldPlane() {
  const material = useMemo(() => gridNodeMaterial(), []);
  return (
    <Plane
      position={[0, 0, 0]}
      scale={[1000, 1000, 0]}
      rotation={[-90 * DEG2RAD, 0, 0]}
    >
      <primitive object={material} attach="material" />
    </Plane>
  );
}

interface GrassProps {
  instances?: number;
}

export function Grass({ instances = 5000 }: GrassProps) {
  const { nodes } = useGLTF('/anime-grass.glb');
  const bladeMesh = nodes.GrassBlade as THREE.Mesh;
  const width = 100;

  const baseGeometry = useMemo(() => {
    const geo = bladeMesh.geometry.clone();
    geo.computeBoundingBox();
    const minY = geo.boundingBox!.min.y;
    geo.translate(0, -minY, 0);
    return geo;
  }, [bladeMesh]);

  const terrainGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, width, 128, 128);
    geo.rotateX(-Math.PI * 0.5);
    return geo;
  }, [width]);

  const grassMaterial = useMemo(() => grassNodeMaterial(), []);
  const terrainMaterial = useMemo(() => terrainNodeMaterial(), []);

  const attributeData = useMemo(
    () => getAttributeData(instances, width),
    [instances, width],
  );

  return (
    <group>
      <mesh geometry={terrainGeo} receiveShadow>
        <primitive object={terrainMaterial} attach="material" />
      </mesh>

      <mesh frustumCulled={false}>
        <instancedBufferGeometry
          index={baseGeometry.index}
          instanceCount={instances}
          attributes-position={baseGeometry.attributes.position}
          attributes-uv={baseGeometry.attributes.uv}
          attributes-normal={baseGeometry.attributes.normal}
        >
          <instancedBufferAttribute
            attach="attributes-offset"
            args={[attributeData.offsets, 3]}
          />
          <instancedBufferAttribute
            attach="attributes-orientation"
            args={[attributeData.orientations, 4]}
          />
          <instancedBufferAttribute
            attach="attributes-halfRootAngleSin"
            args={[attributeData.halfRootAngleSin, 1]}
          />
          <instancedBufferAttribute
            attach="attributes-halfRootAngleCos"
            args={[attributeData.halfRootAngleCos, 1]}
          />
        </instancedBufferGeometry>
        <primitive object={grassMaterial} attach="material" />
      </mesh>
    </group>
  );
}

function getAttributeData(instances: number, width: number) {
  const offsets = new Float32Array(instances * 3);
  const orientations = new Float32Array(instances * 4);
  const halfRootAngleSin = new Float32Array(instances);
  const halfRootAngleCos = new Float32Array(instances);

  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const cells = Math.ceil(Math.sqrt(instances));
  const cellSize = width / cells;

  for (let i = 0; i < instances; i++) {
    const i3 = i * 3;
    const i4 = i * 4;

    const x =
      (i % cells) * cellSize - width / 2 + (Math.random() - 0.5) * cellSize;
    const z =
      Math.floor(i / cells) * cellSize -
      width / 2 +
      (Math.random() - 0.5) * cellSize;

    offsets[i3] = x;
    offsets[i3 + 1] = 0;
    offsets[i3 + 2] = z;

    const angle = Math.random() * Math.PI * 2;
    halfRootAngleSin[i] = Math.sin(angle * 0.5);
    halfRootAngleCos[i] = Math.cos(angle * 0.5);

    _e.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
    _q.setFromEuler(_e);
    orientations[i4] = _q.x;
    orientations[i4 + 1] = _q.y;
    orientations[i4 + 2] = _q.z;
    orientations[i4 + 3] = _q.w;
  }

  return { offsets, orientations, halfRootAngleSin, halfRootAngleCos };
}

useGLTF.preload('/anime-grass.glb');
