import type * as THREE from 'three/webgpu';

export type Node<TNodeType = unknown> = THREE.Node<TNodeType>;
export type BoolNode = THREE.Node<'bool'>;
export type FloatNode = THREE.Node<'float'>;
export type IntNode = THREE.Node<'int'>;
export type UIntNode = THREE.Node<'uint'>;
export type ScalarNode = BoolNode | FloatNode | IntNode | UIntNode;
export type Vec2Node = THREE.Node<'vec2'>;
export type Vec3Node = THREE.Node<'vec3'>;
export type Vec4Node = THREE.Node<'vec4'>;
export type ColorNode = THREE.Node<'color'>;

interface TLSMaterials {
  // biome-ignore lint/suspicious/noExplicitAny: for now
  nodeMaterial: any;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends TLSMaterials {}
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends TLSMaterials {}
  }
}
