import type * as THREE from 'three/webgpu';

export type Node = THREE.TSL.ShaderNodeObject<THREE.Node>;

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
