import type { ShaderCoverId } from '~/lib/shader-covers';

export interface WorkProject {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly summary: string;
  readonly year: string;
  readonly cover: {
    readonly src: string;
    readonly alt: string;
    readonly width: number;
    readonly height: number;
    /**
     * Names the shader that draws this cover live, for a project with no
     * honest capture to show. `src` stays required and stays the poster frame
     * of that same shader: it is what the markup ships, what a browser without
     * WebGPU keeps, and what the cursor shows on hover.
     */
    readonly shader?: ShaderCoverId;
  };
  readonly href: `/${string}` | `https://${string}`;
}
