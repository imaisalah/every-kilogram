// Contract check for the Last Light sets (docs/LASTLIGHT.md), run in the page:
//   node tools/shot.mjs "http://127.0.0.1:<port>/tools/ll-sets.html?set=pad&hud=0" out.png 500 tools/ll-sets-check.js
// Loads every set, checks the anchors, the API and the zero-g volume, then
// prints a JSON summary; "ok" must be true.
for (let i = 0; i < 150 && !window.testReady; i++) await new Promise((r) => setTimeout(r, 200));
const { loadSet } = await import(new URL('js/ll/sets/index.js', document.baseURI).href);
const THREE = LL.THREE;
const PAD = ['start', 'van', 'kwame', 'nadia', 'tower_base', 'elevator', 'arm_start', 'whiteroom', 'crate_o2', 'crate_co2', 'crate_cam', 'hatch', 'seat_you'];
const INSIDE = ['start', 'seat_you', 'seat_yusuf', 'seat_lena', 'seat_grace', 'window', 'panel_left', 'panel_center', 'panel_right', 'valve', 'tunnel_a', 'tunnel_b', 'hab_bench', 'hab_window', 'hab_lockers', 'medkit'];
for (let i = 1; i <= 8; i++) INSIDE.push('breaker_' + i);
for (let i = 1; i <= 10; i++) INSIDE.push('locker_' + i);
const API = ['update', 'setAlarm', 'setPower', 'dispose'];
const out = { ok: true, sets: {} };
const fail = (id, msg) => {
  out.ok = false;
  (out.sets[id].problems = out.sets[id].problems || []).push(msg);
};
for (const id of ['pad', 'capsule', 'tunnel', 'habitat']) {
  out.sets[id] = {};
  let set;
  try {
    set = await loadSet(id, {});
  } catch (e) {
    out.sets[id].problems = ['create failed: ' + e.message];
    out.ok = false;
    continue;
  }
  const want = id === 'pad' ? PAD : INSIDE;
  const missing = want.filter((n) => !set.anchors || !set.anchors[n] || !set.anchors[n].isObject3D);
  if (missing.length) fail(id, 'missing anchors: ' + missing.join(', '));
  for (const f of API) if (typeof set[f] !== 'function') fail(id, 'no ' + f + '()');
  if (!set.group || !set.group.isObject3D) fail(id, 'no group');
  if (!set.colliders) fail(id, 'no colliders');
  // Anchors must be inside the set's group.
  for (const n of want) {
    const a = set.anchors && set.anchors[n];
    if (!a) continue;
    let p = a;
    while (p && p !== set.group) p = p.parent;
    if (!p) fail(id, `anchor ${n} is not in the group`);
  }
  if (id === 'pad') {
    if (!set.walkable) fail(id, 'no walkable');
  } else {
    const v = set.volume;
    if (!v || !v.min || !v.max) fail(id, 'no volume');
    else {
      // Every interior anchor (feet point) should already be valid in the volume.
      const off = [];
      for (const n of want) {
        const a = set.anchors[n];
        if (!a) continue;
        const w = a.getWorldPosition(new THREE.Vector3());
        const q = w.clone();
        if (typeof v.clamp === 'function') v.clamp(q);
        if (q.distanceTo(w) > 0.35) off.push(`${n} (${q.distanceTo(w).toFixed(2)} m)`);
      }
      out.sets[id].anchorsMovedByClamp = off;
      // The tunnel must connect: walk the clamp from the capsule start to the habitat bench.
      const a = set.anchors.tunnel_a && set.anchors.tunnel_a.getWorldPosition(new THREE.Vector3());
      const b = set.anchors.tunnel_b && set.anchors.tunnel_b.getWorldPosition(new THREE.Vector3());
      if (a && b && typeof v.clamp === 'function') {
        const p = a.clone();
        let stuck = 0;
        for (let s = 0; s <= 40; s++) {
          const t = a.clone().lerp(b, s / 40);
          p.lerp(t, 1);
          v.clamp(p);
          if (p.distanceTo(t) > 0.4) stuck++;
        }
        if (stuck) fail(id, `the clamp blocks the tunnel at ${stuck}/41 steps`);
      }
    }
  }
  try {
    set.setAlarm(true);
    set.setPower(0.2);
    set.update(0.016, 1, LL.camera);
    set.setAlarm(false);
    set.setPower(1);
  } catch (e) {
    fail(id, 'state calls threw: ' + e.message);
  }
  let meshes = 0;
  let tris = 0;
  set.group.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  Object.assign(out.sets[id], { anchors: Object.keys(set.anchors || {}).length, meshes, triangles: Math.round(tris), lights: (set.lights || []).length });
  try {
    set.dispose();
  } catch (e) {
    fail(id, 'dispose threw: ' + e.message);
  }
}
return out;
