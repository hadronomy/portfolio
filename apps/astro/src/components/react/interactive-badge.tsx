import {
  Environment,
  Lightformer,
  useGLTF,
  useTexture,
} from '@react-three/drei';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  type RapierRigidBody,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from '@react-three/rapier';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { type RefObject, useEffect, useRef, useState } from 'react';
import * as THREE from 'three/webgpu';

extend({ MeshLineGeometry, MeshLineMaterial });

interface Meshline {
  // biome-ignore lint/suspicious/noExplicitAny: for now
  meshLineGeometry: any;
  // biome-ignore lint/suspicious/noExplicitAny: for now
  meshLineMaterial: any;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends Meshline {}
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends Meshline {}
  }
}

// Add after the existing imports and before the extend call
interface RigidBodyWithLerped extends RapierRigidBody {
  lerped?: THREE.Vector3;
}

export function InteractiveBadge() {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 25 }}>
      <Physics interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
        <Band />
      </Physics>
      <Environment blur={0.75}>
        <Lightformer
          intensity={2}
          color="white"
          position={[0, -1, 5]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={3}
          color="white"
          position={[-1, -1, 1]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={3}
          color="white"
          position={[1, 1, 1]}
          rotation={[0, 0, Math.PI / 3]}
          scale={[100, 0.1, 1]}
        />
        <Lightformer
          intensity={10}
          color="white"
          position={[-10, 0, 14]}
          rotation={[0, Math.PI / 2, Math.PI / 3]}
          scale={[100, 10, 1]}
        />
      </Environment>
    </Canvas>
  );
}

function Band({ minSpeed = 10, maxSpeed = 50 }) {
  const band = useRef<THREE.Mesh<MeshLineGeometry, MeshLineMaterial>>(null);
  const fixed = useRef<RigidBodyWithLerped>(null);
  const j1 = useRef<RigidBodyWithLerped>(null);
  const j2 = useRef<RigidBodyWithLerped>(null);
  const j3 = useRef<RigidBodyWithLerped>(null);
  const card = useRef<RigidBodyWithLerped>(null);
  const segmentProps = {
    type: 'dynamic' as const,
    canSleep: true,
    colliders: false as const,
    angularDamping: 2,
    linearDamping: 2,
  };
  const { nodes, materials } = useGLTF('/tag.glb') as unknown as {
    nodes: {
      card: THREE.Mesh;
      clip: THREE.Mesh;
      clamp: THREE.Mesh;
    };
    materials: {
      base: THREE.MeshPhysicalMaterial;
      metal: THREE.Material;
    };
  };
  const texture = useTexture('band.jpg');

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const { width, height } = useThree((state) => state.size);
  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
  );
  const [dragged, drag] = useState<THREE.Vector3 | false>(false);
  const [hovered, hover] = useState(false);

  useRopeJoint(
    fixed as RefObject<RapierRigidBody>,
    j1 as RefObject<RapierRigidBody>,
    [[0, 0, 0], [0, 0, 0], 1],
  ); // prettier-ignore
  useRopeJoint(
    j1 as RefObject<RapierRigidBody>,
    j2 as RefObject<RapierRigidBody>,
    [[0, 0, 0], [0, 0, 0], 1],
  ); // prettier-ignore
  useRopeJoint(
    j2 as RefObject<RapierRigidBody>,
    j3 as RefObject<RapierRigidBody>,
    [[0, 0, 0], [0, 0, 0], 1],
  ); // prettier-ignore
  useSphericalJoint(
    j3 as RefObject<RapierRigidBody>,
    card as RefObject<RapierRigidBody>,
    [
      [0, 0, 0],
      [0, 1.45, 0],
    ],
  ); // prettier-ignore

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? 'grabbing' : 'grab';
      // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
      return () => void (document.body.style.cursor = 'auto');
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      for (const ref of [card, j1, j2, j3, fixed]) {
        ref.current?.wakeUp();
      }
      if (card.current) {
        card.current.setNextKinematicTranslation({
          x: vec.x - dragged.x,
          y: vec.y - dragged.y,
          z: vec.z - dragged.z,
        });
      }
    }
    if (
      fixed.current &&
      j1.current &&
      j2.current &&
      j3.current &&
      card.current
    ) {
      for (const ref of [j1, j2]) {
        if (ref.current) {
          if (!ref.current.lerped) {
            ref.current.lerped = new THREE.Vector3().copy(
              ref.current.translation(),
            );
          }
          const clampedDistance = Math.max(
            0.1,
            Math.min(
              1,
              ref.current.lerped.distanceTo(ref.current.translation()),
            ),
          );
          ref.current.lerped.lerp(
            ref.current.translation(),
            delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed)),
          );
        }
      }
      curve.points[0].copy(j3.current.translation());
      if (j2.current?.lerped) curve.points[1].copy(j2.current.lerped);
      if (j1.current?.lerped) curve.points[2].copy(j1.current.lerped);
      curve.points[3].copy(fixed.current.translation());
      if (band.current) {
        band.current.geometry.setPoints(curve.getPoints(32));
      }
      // Tilt it back towards the screen
      ang.copy(card.current.angvel());
      rot.copy(card.current.rotation());
      card.current.setAngvel(
        { x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z },
        false,
      );
    }
  });

  curve.curveType = 'chordal';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody
          ref={fixed}
          type="fixed"
          canSleep={segmentProps.canSleep}
          angularDamping={segmentProps.angularDamping}
          linearDamping={segmentProps.linearDamping}
          colliders={false}
        />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? 'kinematicPosition' : 'dynamic'}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => {
              const target = e.target as Element;
              if (target && 'releasePointerCapture' in target) {
                target.releasePointerCapture(e.pointerId);
              }
              drag(false);
            }}
            onPointerDown={(e) => {
              const target = e.target as Element;
              if (target && 'setPointerCapture' in target) {
                target.setPointerCapture(e.pointerId);
              }
              if (card.current) {
                drag(
                  new THREE.Vector3()
                    .copy(e.point)
                    .sub(vec.copy(card.current.translation())),
                );
              }
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial
                map={materials.base.map}
                map-anisotropy={16}
                clearcoat={1}
                clearcoatRoughness={0.15}
                roughness={0.3}
                metalness={0.5}
              />
            </mesh>
            <mesh
              geometry={nodes.clip.geometry}
              material={materials.metal}
              material-roughness={0.3}
            />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="white"
          depthTest={false}
          resolution={[width, height]}
          useMap
          map={texture}
          repeat={[-3, 1]}
          lineWidth={1}
        />
      </mesh>
    </>
  );
}
