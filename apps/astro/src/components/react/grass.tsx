// eslint-disable jsx-no-undef
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type React from 'react';
import { Suspense, useMemo, useRef } from 'react';
import { usePaneInput, useTweakpane } from 'react-tweakpane';
import { createNoise2D } from 'simplex-noise';
import * as THREE from 'three';
import './GrassMaterial';
import { OrbitControls } from '@react-three/drei';
const noise2D = createNoise2D(Math.random);

export interface GrassViewProps extends React.ComponentProps<typeof Canvas> {}

export function GrassView(props: GrassViewProps) {
  const {
    children,
    camera = { position: [0, 30, 0], fov: 35 },
    ...rest
  } = props;

  return (
    <Canvas camera={camera} {...rest}>
      <ambientLight intensity={10} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Suspense>
        <Grass width={100} instances={500000} />
      </Suspense>
      {children}
      <OrbitControls />
    </Canvas>
  );
}

interface GrassProps {
  width?: number;
  instances?: number;
  bladeWidth?: number;
  bladeHeight?: number;
  joints?: number;
}

export function Grass({
  width = 100,
  instances = 5000,
  // Make blades wider and taller for better visibility
  bladeWidth = 0.3,
  bladeHeight = 1.5,
  joints = 5,
}: GrassProps) {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const materialRef = useRef<any>(null);
  const { viewport } = useThree();

  // Adjust width based on viewport
  const actualWidth = useMemo(() => {
    const { width: viewWidth, height } = viewport.getCurrentViewport();
    return Math.max(viewWidth / 2.5, height) * 2;
  }, [viewport]);

  // Create base blade geometry
  const baseGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(bladeWidth, bladeHeight, 1, joints);
    geo.translate(0, bladeHeight / 2, 0);
    return geo;
  }, [bladeWidth, bladeHeight, joints]);

  // Generate ground geometry with noise
  const groundGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(actualWidth, actualWidth, 32, 32);
    geo.rotateX(-Math.PI / 2);

    // Apply height variation using simplex noise
    const positionAttribute = geo.getAttribute('position');
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const z = positionAttribute.getZ(i);
      const y = getYPosition(x, z);
      positionAttribute.setY(i, y);
    }

    geo.computeVertexNormals();
    return geo;
  }, [actualWidth]);

  // Get attribute data for all instances
  const attributeData = useMemo(
    () => getAttributeData(instances, actualWidth),
    [instances, actualWidth],
  );

  // Update shader time uniform for animation
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.getElapsedTime();
    }
  });

  return (
    <group>
      {/* Grass instances */}
      <mesh>
        <instancedBufferGeometry
          index={baseGeometry.index}
          attributes-position={baseGeometry.attributes.position}
          attributes-uv={baseGeometry.attributes.uv}
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
            attach={'attributes-stretch'}
            args={[new Float32Array(attributeData.stretches), 1]}
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
        <grassMaterial ref={materialRef} toneMapped={false} />
      </mesh>

      {/* Ground */}
      <mesh position={[0, 0, 0]} geometry={groundGeo}>
        <meshStandardMaterial color="#0a3200" roughness={0.8} />
      </mesh>
    </group>
  );
}

// Helper functions
function getAttributeData(instances: number, width: number) {
  const offsets: number[] = [];
  const orientations: number[] = [];
  const stretches: number[] = [];
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
    const offsetX = Math.random() * width - width / 2;
    const offsetZ = Math.random() * width - width / 2;
    const offsetY = getYPosition(offsetX, offsetZ);
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
    if (i < instances / 3) {
      stretches.push(Math.random() * 1.8);
    } else {
      stretches.push(Math.random());
    }
  }

  return {
    offsets,
    orientations,
    stretches,
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

function getYPosition(x: number, z: number) {
  let y = 2 * noise2D(x / 50, z / 50);
  y += 4 * noise2D(x / 100, z / 100);
  y += 0.2 * noise2D(x / 10, z / 10);
  return y;
}
