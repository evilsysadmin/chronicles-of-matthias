// Pure town layout shared by the renderer and the rules: which '#' blocks
// are houses and which street cell is each house's door. Keeping one source
// guarantees you enter exactly the building whose door you see.

// Solid interior '#' blocks of at least 2×2 cells become houses (a block may
// back onto the town wall; the wall itself is never part of a block),
// ordered north-west → south-east for a stable style mapping.
export function settlementHouseBlocks(grid, width, height) {
  const seen = new Set();
  const blocks = [];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (grid[y]?.[x] !== '#' || seen.has(x + ',' + y)) continue;
      const cells = [];
      const queue = [{ x, y }];
      seen.add(x + ',' + y);
      while (queue.length) {
        const cell = queue.pop();
        cells.push(cell);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cell.x + dx;
          const ny = cell.y + dy;
          const key = nx + ',' + ny;
          const interior = nx > 0 && ny > 0 && nx < width - 1 && ny < height - 1;
          if (interior && grid[ny]?.[nx] === '#' && !seen.has(key)) { seen.add(key); queue.push({ x: nx, y: ny }); }
        }
      }
      const xs = cells.map(c => c.x);
      const ys = cells.map(c => c.y);
      const minX = Math.min(...xs); const maxX = Math.max(...xs);
      const minY = Math.min(...ys); const maxY = Math.max(...ys);
      const solid = cells.length === (maxX - minX + 1) * (maxY - minY + 1);
      if (!solid || maxX - minX < 1 || maxY - minY < 1) continue;
      blocks.push({ cells, minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 });
    }
  }
  return blocks;
}

// Wide blocks face north/south, tall blocks east/west — always toward the
// side whose door cell is walkable and nearer the town centre.
export function settlementHouseFacing(block, grid, center) {
  const { minX, maxX, minY, maxY } = block;
  const cx = Math.round(block.cx);
  const cy = Math.round(block.cy);
  const open = ({ x, y }) => grid[y]?.[x] === '.';
  const options = (maxX - minX) >= (maxY - minY)
    ? [
      { yaw: 0, door: { x: cx, y: maxY + 1 }, toward: center.y >= block.cy },
      { yaw: Math.PI, door: { x: cx, y: minY - 1 }, toward: center.y < block.cy },
    ]
    : [
      { yaw: Math.PI / 2, door: { x: maxX + 1, y: cy }, toward: center.x >= block.cx },
      { yaw: -Math.PI / 2, door: { x: minX - 1, y: cy }, toward: center.x < block.cx },
    ];
  return options.find(o => o.toward && open(o.door)) || options.find(o => open(o.door)) || options[0];
}

