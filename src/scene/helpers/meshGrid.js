export function createGridPositions(spacing = 1) {
  const p = spacing;
  return [
    [-p, -p, -p],
    [p, -p, -p],
    [-p, p, -p],
    [p, p, -p],
    [-p, -p, p],
    [p, -p, p],
    [-p, p, p],
    [p, p, p],
  ];
}
