import * as THREE from 'three/webgpu';

export function createNodeMaterial(
  callback: (material: THREE.NodeMaterial) => THREE.NodeMaterial,
): () => THREE.NodeMaterial {
  return () => callback(new THREE.NodeMaterial());
}
