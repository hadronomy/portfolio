/**
 * The covers that are drawn rather than photographed.
 *
 * A project with no honest capture — a language, an emulator, a solver — gets a
 * cover that draws its subject instead of a screenshot of a terminal. Each one
 * is a WGSL fragment shader in `src/shaders`, rendered live with WebGPU and
 * shipped with a poster frame from the same shader (`bun run covers:render`).
 *
 * `posterTime` picks the moment the poster freezes. It is a composition
 * decision: the still has to read as a finished print on its own, because it is
 * what a visitor without WebGPU, or with reduced motion, keeps looking at.
 */
export interface ShaderCover {
  readonly id: string;
  readonly posterTime: number;
}

export const shaderCovers = [
  /** Recovery: the backlog is still stacked and already crossing. */
  { id: 'inari', posterTime: 14.2 },
  /** The loop branch is taken: the gutter arc is lit end to end. */
  { id: 'ram', posterTime: 6.22 },
  /** One tour complete, one just out of the depot, a loaded haul in flight. */
  { id: 'routes', posterTime: 15.1 },
] as const satisfies readonly ShaderCover[];

export type ShaderCoverId = (typeof shaderCovers)[number]['id'];
