// Real Entoto ground from Highland Exposure (1 m grid). Local frame: x east, z south, y up, origin at the start cell.
export async function loadGround(base = 'assets/') {
  const meta = await (await fetch(base + 'entoto.json')).json();
  const raw = new Uint16Array(await (await fetch(base + 'entoto_h.bin')).arrayBuffer());
  const { x0, z0, step, nx, nz } = meta, H = new Float32Array(nx * nz);
  const OX = meta.start[0], OZ = meta.start[1], OY = meta.start[2];
  for (let i = 0; i < H.length; i++) H[i] = meta.base + raw[i] / 100 - OY;
  const lx0 = x0 - OX, lz0 = z0 - OZ;
  function height(x, z) {
    const u = Math.min(nx - 1.001, Math.max(0, (x - lx0) / step)), v = Math.min(nz - 1.001, Math.max(0, (z - lz0) / step));
    const i = u | 0, j = v | 0, a = u - i, b = v - j, k = j * nx + i;
    return (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) + (H[k + nx] * (1 - a) + H[k + nx + 1] * a) * b;
  }
  const road = meta.road.map(([x, z, y]) => [x - OX, z - OZ, y - OY]);
  // distance to the road centreline and the road's own along-distance
  const cell = 16, grid = new Map();
  for (let i = 0; i < road.length - 1; i++) {
    const [ax, az] = road[i], [bx, bz] = road[i + 1];
    for (let gx = Math.floor(Math.min(ax, bx) / cell) - 1; gx <= Math.floor(Math.max(ax, bx) / cell) + 1; gx++)
      for (let gz = Math.floor(Math.min(az, bz) / cell) - 1; gz <= Math.floor(Math.max(az, bz) / cell) + 1; gz++) {
        const k = gx + ',' + gz; (grid.get(k) || grid.set(k, []).get(k)).push(i);
      }
  }
  function roadInfo(x, z) {
    const list = grid.get(Math.floor(x / cell) + ',' + Math.floor(z / cell)); let best = 1e9, bi = -1, bt = 0;
    if (list) for (const i of list) {
      const [ax, az] = road[i], [bx, bz] = road[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < best) { best = d; bi = i; bt = t; }
    }
    return { d: best, i: bi, t: bt };
  }
  const bounds = [lx0, lx0 + (nx - 1) * step, lz0, lz0 + (nz - 1) * step];
  return { meta, H, nx, nz, step, lx0, lz0, height, road, roadInfo, bounds, origin: [OX, OY, OZ], roadWidth: meta.roadWidth,
    items: meta.items.map(i => ({ ...i, x: i.x - OX, z: i.z - OZ, y: i.y - OY })), home: Object.fromEntries(Object.entries(meta.home).map(([k, [x, z, y, yaw]]) => [k, [x - OX, z - OZ, y - OY, yaw]])) };
}
