// The character controller's pure math (js/3d/controller.js): camera-relative
// movement, sliding along obstacles, picking the interactable in front of you
// and keeping the camera out of walls. The module imports THREE through the
// browser's import map, so the test swaps that line for a stub and loads the
// source as a data: module.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let M = null;
async function mod() {
  if (M) return M;
  const src = fs.readFileSync(path.join(__dirname, '../js/3d/controller.js'), 'utf8').replace(/^import .*$/m, 'const THREE = {};');
  M = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src));
  return M;
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('W moves away from the camera, D to its right', async () => {
  const { camRelative } = await mod();
  // Camera at yaw 0 sits on +Z of the character and looks toward -Z.
  let d = camRelative(1, 0, 0);
  assert.ok(near(d.x, 0) && near(d.z, -1), 'forward is -Z');
  d = camRelative(0, 1, 0);
  assert.ok(near(d.x, 1) && near(d.z, 0), 'right is +X');
  // Turn the camera a quarter round (it sits on +X, looking toward -X).
  d = camRelative(1, 0, Math.PI / 2);
  assert.ok(near(d.x, -1) && near(d.z, 0, 1e-9), 'forward follows the camera');
  d = camRelative(0, 1, Math.PI / 2);
  assert.ok(near(d.x, 0, 1e-9) && near(d.z, -1), 'right follows the camera');
  // Diagonals never go faster than straight.
  d = camRelative(1, 1, 0.7);
  assert.ok(Math.hypot(d.x, d.z) <= 1 + 1e-9);
});

test('walking into a pillar slides round it instead of sticking', async () => {
  const { resolveGround } = await mod();
  const walk = { circles: [{ x: 0, z: 0, r: 1 }] };
  // Start just outside, heading slightly off-centre into the pillar.
  const p = { x: 0.2, z: 1.31 };
  let progress = 0;
  for (let i = 0; i < 60; i++) {
    const before = p.x;
    p.z -= 0.05; // pushing straight in (-Z)
    resolveGround(p, walk, 0.3);
    assert.ok(Math.hypot(p.x, p.z) >= 1.3 - 1e-9, 'never inside the pillar');
    progress += p.x - before;
  }
  assert.ok(progress > 0.5, `slid sideways ${progress.toFixed(2)} m`);
});

test('walls: boxes and bounds keep the feet out, sliding along', async () => {
  const { resolveGround } = await mod();
  const walk = { boxes: [{ minX: -5, maxX: 5, minZ: -1, maxZ: 0 }], bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } };
  // Diagonal into the wall (from +Z): z stops at the wall, x keeps going.
  const p = { x: 0, z: 1 };
  for (let i = 0; i < 40; i++) {
    p.x += 0.1;
    p.z -= 0.1;
    resolveGround(p, walk, 0.3);
  }
  assert.ok(p.z >= 0.3 - 1e-9, 'stays in front of the wall');
  assert.ok(p.x > 3, 'slid along the wall');
  // Teleported inside the box: pushed out through the nearest side.
  const q = resolveGround({ x: 4.9, z: -0.5 }, walk, 0.3);
  assert.ok(q.x >= 5.3 - 1e-9);
  // Bounds and a round apron.
  const b = resolveGround({ x: 30, z: -30 }, walk, 0.3);
  assert.deepStrictEqual([b.x, b.z], [10, -10]);
  const a = resolveGround({ x: 30, z: 0 }, { inside: { x: 0, z: 0, r: 12 } }, 0.3);
  assert.ok(near(a.x, 12) && near(a.z, 0));
});

test('the target is the nearest interactable in front of you', async () => {
  const { pickTarget } = await mod();
  const items = [
    { id: 'behind', x: 0, z: -1.2, radius: 2 },
    { id: 'ahead', x: 0.3, z: 1.4, radius: 2 },
    { id: 'far', x: 0, z: 4, radius: 2 },
    { id: 'side', x: 1.3, z: 0.1, radius: 2 },
  ];
  // Facing +Z (yaw 0).
  assert.strictEqual(pickTarget({ x: 0, z: 0 }, 0, items).id, 'ahead');
  // Facing -Z: the one behind becomes the target.
  assert.strictEqual(pickTarget({ x: 0, z: 0 }, Math.PI, items).id, 'behind');
  // Facing +X: the one at the side.
  assert.strictEqual(pickTarget({ x: 0, z: 0 }, Math.PI / 2, items).id, 'side');
  // Nothing within reach and in front.
  assert.strictEqual(pickTarget({ x: 20, z: 20 }, 0, items), null);
  // Standing right on one: the angle does not matter.
  assert.strictEqual(pickTarget({ x: 0, z: -1.1 }, 0, items).id, 'behind');
  // Priority wins over distance; disabled ones are skipped.
  const pri = [{ id: 'a', x: 0, z: 0.8, radius: 2 }, { id: 'b', x: 0, z: 1.6, radius: 2, priority: 1 }];
  assert.strictEqual(pickTarget({ x: 0, z: 0 }, 0, pri).id, 'b');
  pri[1].enabled = false;
  assert.strictEqual(pickTarget({ x: 0, z: 0 }, 0, pri).id, 'a');
  // A wide angle (the designer's racks) ignores facing.
  assert.strictEqual(pickTarget({ x: 0, z: 0 }, Math.PI, [{ id: 'r', x: 0, z: 1.4, radius: 2 }], { angle: Math.PI }).id, 'r');
});

test('the current target holds unless another is clearly better', async () => {
  const { pickTarget } = await mod();
  const a = { id: 'a', x: -0.2, z: 1.2, radius: 2 };
  const b = { id: 'b', x: 0.2, z: 1.15, radius: 2 };
  const first = pickTarget({ x: 0, z: 0 }, 0, [a, b]);
  const again = pickTarget({ x: 0, z: 0 }, 0, [a, b], { current: first === a ? a : b });
  assert.strictEqual(again, first, 'no flicker between two close targets');
  const c = { id: 'c', x: 0, z: 0.5, radius: 2 };
  assert.strictEqual(pickTarget({ x: 0, z: 0 }, 0, [a, c], { current: a }).id, 'c', 'a much closer one takes over');
});

test('the camera stops short of walls and footprints', async () => {
  const { clearCircles, clearBoxes } = await mod();
  const o = { x: 0, y: 1.6, z: 0 };
  const d = { x: 0, y: 0, z: 1 }; // looking back along +Z
  // A building footprint 5 m behind (radius 1, 10 m tall).
  const c = clearCircles(o, d, 8, [{ x: 0, z: 6, r: 1, h: 10 }], 0.35, 0.8);
  assert.ok(near(c, 5 - 0.35, 1e-6), `circle clearance ${c}`);
  // A low wall the camera passes over does not count.
  const low = clearCircles(o, { x: 0, y: 0.6, z: 0.8 }, 8, [{ x: 0, z: 6, r: 1, h: 0.5 }]);
  assert.strictEqual(low, 8);
  // A box wall at z = 3..3.2.
  const b = clearBoxes(o, d, 8, [{ minX: -5, maxX: 5, minY: 0, maxY: 3, minZ: 3, maxZ: 3.2 }], 0.3, 0.8);
  assert.ok(near(b, 2.7), `box clearance ${b}`);
  // Nothing in the way: the full distance.
  assert.strictEqual(clearBoxes(o, d, 8, [{ minX: 10, maxX: 11, minY: 0, maxY: 3, minZ: 0, maxZ: 9 }]), 8);
  // Never closer than the minimum.
  assert.strictEqual(clearBoxes(o, d, 8, [{ minX: -5, maxX: 5, minY: 0, maxY: 3, minZ: 0.2, maxZ: 0.4 }], 0.3, 0.8), 0.8);
});
