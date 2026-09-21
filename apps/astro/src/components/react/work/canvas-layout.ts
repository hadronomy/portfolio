export interface PrintPlacement {
  x: number;
  y: number;
  width: number;
  rotation: number;
  depth: number;
}

const spreadPositions = [
  { x: -330, y: -145, width: 350, rotation: -8 },
  { x: 125, y: -70, width: 390, rotation: 5 },
  { x: -210, y: 175, width: 290, rotation: -3 },
  { x: 405, y: 195, width: 280, rotation: -9 },
];

export function placePrints(
  count: number,
  selected: number,
  spread: boolean,
  hovered: number | null,
): PrintPlacement[] {
  return Array.from({ length: count }, (_, index) => {
    const group = Math.floor(index / 4);
    const local = index % 4;
    if (spread) {
      return {
        ...spreadPositions[local],
        x: spreadPositions[local].x + group * 1180,
        depth: index === hovered || index === selected ? count + 1 : index,
      };
    }
    const selectedLocal = group === Math.floor(selected / 4) ? selected % 4 : 0;
    const rank = (local - selectedLocal + 4) % 4;
    const positions = [
      { x: -35, y: 65, width: 380, rotation: -4 },
      { x: -155, y: -35, width: 360, rotation: -17 },
      { x: 65, y: -85, width: 360, rotation: 8 },
      { x: 205, y: 15, width: 340, rotation: 19 },
    ];
    const position = positions[rank];
    const peek = hovered !== null && hovered !== index && rank !== 0;
    return {
      ...position,
      x: position.x + group * 1050 + (peek ? (position.x < 0 ? -30 : 30) : 0),
      rotation: position.rotation + (peek ? (position.x < 0 ? -3 : 3) : 0),
      depth: 4 - rank,
    };
  });
}

export function printHeight(width: number) {
  return width * 0.75 + 58;
}

export function compositionBounds(prints: readonly PrintPlacement[]) {
  const left = Math.min(...prints.map((p) => p.x - p.width * 0.6));
  const right = Math.max(...prints.map((p) => p.x + p.width * 0.6));
  const top = Math.min(...prints.map((p) => p.y - printHeight(p.width) * 0.6));
  const bottom = Math.max(
    ...prints.map((p) => p.y + printHeight(p.width) * 0.6),
  );
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
  };
}
