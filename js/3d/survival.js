// 3D for the survival segments (js/story/survival.js drives it): the capsule
// interior, the player's astronaut floating in microgravity, the crew, and a
// camera per segment. Returns a scene object for engine.mount plus handles.
//
// Movement in the cabin goes through the shared controller (docs/CONTROLS.md,
// mode 'zeroG'); the cabin cone is enforced on top of its box volume.
import { THREE, getRenderer } from './engine.js';
import { createController } from './controller.js';
import { createAstronaut } from './astronaut.js';
import { createCapsuleInterior, CREW_LOOKS, sitPose, floatPose, liePose } from './capsule.js';

const SMD = globalThis.SMD || {};
const CABIN_TOP = 2.85;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const reducedMotion = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches || !!(SMD.settings && SMD.settings.reducedMotion);
  } catch (e) {
    return false;
  }
};

function ctlStyled() {
  try {
    const probe = document.createElement('div');
    probe.className = 'ctl-layer';
    probe.hidden = false;
    document.body.appendChild(probe);
    const ok = getComputedStyle(probe).position === 'absolute' || getComputedStyle(probe).position === 'fixed';
    probe.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

// Shelter berths on the floor bay (x along the cabin, b1 in the middle).
const BERTH_X = { b1: -0.27, b2: -0.85, b3: 0.33, b4: 0.9 };

export function createSurvivalScene(opts = {}) {
  const mode = opts.mode || 'power';
  const reduced = reducedMotion();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080c);
  const camera = new THREE.PerspectiveCamera(mode === 'burn' ? 40 : 58, 1, 0.03, 60);
  const outsideFor = { power: 'both', co2: 'earth', storm: 'farside', burn: 'earth', entry: 'space' };
  const cap = createCapsuleInterior({ outside: outsideFor[mode] || 'both' });
  scene.add(cap.group);
  const dom = getRenderer().domElement;

  // ---------- People ----------
  const app = opts.appearance || (SMD.avatar ? SMD.avatar.get() : null);
  const helmet = mode === 'entry';
  const me = createAstronaut(app, { helmet, blob: false, shadows: false });
  cap.group.add(me.group);
  const crew = {};
  ['yusuf', 'lena', 'grace'].forEach((id) => {
    const a = createAstronaut(Object.assign({}, CREW_LOOKS[id], (opts.crewLooks || {})[id] || {}), { helmet, blob: false, shadows: false });
    cap.group.add(a.group);
    crew[id] = a;
  });
  const seated = new Set(['yusuf', 'lena', 'grace']);
  function seat(id, a) {
    const s = cap.seats[id];
    a.group.position.copy(s.position);
    a.group.quaternion.copy(s.quaternion);
    a.group.rotation.x = -0.18;
  }
  Object.keys(crew).forEach((id) => {
    seat(id, crew[id]);
    cap.addBreather(crew[id].group);
  });
  cap.addBreather(me.group);
  const look = (a, p) => a.lookAt(p);

  // ---------- Camera helpers ----------
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  let shake = 0;
  function frame(pos, at, snap) {
    if (snap || !camPos.lengthSq()) {
      camPos.copy(pos);
      camTarget.copy(at);
    }
    rig.pos = pos.clone();
    rig.at = at.clone();
  }
  const rig = { pos: new THREE.Vector3(), at: new THREE.Vector3() };
  const camClamp = (p) => {
    p.y = clamp(p.y, 0.25, 2.75);
    const r = cap.radiusAt(p.y) - 0.14;
    const d = Math.hypot(p.x, p.z);
    if (d > r) {
      p.x *= r / d;
      p.z *= r / d;
    }
    return p;
  };

  // ---------- Per-mode setup ----------
  let ctl = null;
  let reach = 0;
  let reachT = 0;
  let carry = null;
  const pickers = [];
  const handles = {};
  let time = 0;

  if (mode === 'power') {
    me.group.position.set(-0.62, 0.4, 0.82);
    me.group.rotation.y = 0.35;
    frame(new THREE.Vector3(0.55, 2.3, -1.05), new THREE.Vector3(-0.15, 1.2, 1.25), true);
    look(me, cap.panels.group);
    handles.reach = () => {
      reachT = 0.7;
    };
  }

  if (mode === 'co2') {
    me.group.position.copy(cap.anchors.start.position);
    me.group.position.y = 0.55;
    camera.position.set(0, 1.8, 1.4);
    ctl = createController({
      camera,
      dom,
      character: me,
      mode: 'zeroG',
      volume: cap.volume,
      // The controller's own prompt and thumb stick once its CSS is linked;
      // until then js/story/survival.js draws the prompt.
      overlay: ctlStyled() ? opts.overlay || null : false,
      prompt: ctlStyled(),
      rig: { distance: 1.7, height: 1.25, shoulder: 0.25, min: 0.8, max: 2.6, pitch: [-0.6, 0.9], fov: 62, pitch0: 0.2 },
      speeds: { float: 1.2, turn: 10 },
      // The cabin is a cone: march out from the pivot until the wall.
      cameraClear: (origin, dir, want) => {
        const p = new THREE.Vector3();
        for (let d = 0.1; d <= want; d += 0.05) {
          p.copy(origin).addScaledVector(dir, d);
          if (p.y < 0.2 || p.y > CABIN_TOP || Math.hypot(p.x, p.z) > cap.radiusAt(p.y) - 0.16) return Math.max(0.3, d - 0.05);
        }
        return want;
      },
      interactables: [],
    });
    // Face the aft lockers with the camera in the open space by the panel.
    ctl.teleport(me.group.position, Math.PI);
    handles.controller = ctl;
    handles.ownPrompt = !ctlStyled();
    // Click or tap a locker / the work surface to float there.
    cap.lockers.forEach((l) => {
      l.door.userData.pick = l.id;
      l.group.children[0].userData.pick = l.id;
      pickers.push(l.door, l.group.children[0]);
    });
    cap.bench.children.forEach((c) => {
      c.userData.pick = 'bench';
      pickers.push(c);
    });
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    ctl.on('tap', (info) => {
      ndc.set(info.ndc.x, info.ndc.y);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickers, false)[0];
      if (hit && handles.onPick) {
        handles.onPick(hit.object.userData.pick);
        return true;
      }
      return false;
    });
    // Where to float to reach a locker / the bench (feet origin).
    handles.approach = (id) => {
      const a = id === 'bench' ? cap.anchors.bench : (cap.lockers.find((l) => l.id === id) || {}).anchor;
      if (!a) return null;
      const p = a.getWorldPosition(new THREE.Vector3());
      cap.group.worldToLocal(p);
      // Float with the chest at the locker, legs clear of the seat backs.
      p.y = Math.max(0.55, p.y - 0.95);
      return cap.volume.clamp(p);
    };
    handles.interactPoint = (id) => {
      const a = id === 'bench' ? cap.anchors.bench : (cap.lockers.find((l) => l.id === id) || {}).anchor;
      return a;
    };
    handles.goTo = (id, onArrive) => {
      const p = handles.approach(id);
      if (!p) return;
      ctl.moveTo(p, { onArrive });
      if (reduced) {
        ctl.teleport(p);
        if (onArrive) setTimeout(onArrive, 0);
      }
    };
    handles.reach = () => {
      reachT = 0.7;
    };
    // The adapter grows on the bench as steps are done.
    const adapter = new THREE.Group();
    cap.bench.add(adapter);
    adapter.position.copy(cap.bench.userData.top);
    const mats = {
      cart: new THREE.MeshStandardMaterial({ color: 0x8f989e, roughness: 0.5, metalness: 0.4 }),
      cover: new THREE.MeshStandardMaterial({ color: 0x2f6fa8, roughness: 0.7, side: THREE.DoubleSide }),
      bag: new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.2, transparent: true, opacity: 0.45, depthWrite: false }),
      hose: new THREE.MeshStandardMaterial({ color: 0xb4302c, roughness: 0.6 }),
      tape: new THREE.MeshStandardMaterial({ color: 0x8a8f93, roughness: 0.8 }),
      sock: new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 1 }),
    };
    const parts = {
      cartridge: new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mats.cart),
      cover: new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 16, 1, true, 0, Math.PI), mats.cover),
      bag: new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), mats.bag),
      hose: new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 24, Math.PI * 0.9), mats.hose),
      tape: new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.04, 20, 1, true), mats.tape),
      sock: new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mats.sock),
    };
    parts.cartridge.position.y = 0.1;
    parts.cover.position.y = 0.2;
    parts.cover.rotation.z = Math.PI / 2;
    parts.bag.position.y = 0.16;
    parts.bag.scale.set(1, 1.05, 1);
    parts.hose.position.set(0.12, 0.3, 0);
    parts.hose.rotation.z = -0.6;
    parts.tape.position.y = 0.14;
    parts.sock.position.set(0.14, 0.26, 0);
    Object.values(parts).forEach((p) => {
      p.visible = false;
      adapter.add(p);
    });
    handles.showPart = (id) => {
      if (parts[id]) parts[id].visible = true;
    };
  }

  if (mode === 'storm') {
    Object.values(cap.seatMeshes).forEach((s) => (s.visible = false));
    me.group.position.set(0, 0.12, -1.3);
    frame(new THREE.Vector3(0.02, 2.45, 0.62), new THREE.Vector3(0.02, 0.0, -0.55), true);
    camera.fov = 62;
    const bagGeo = new THREE.BoxGeometry(0.42, 0.13, 0.34);
    const water = new THREE.MeshStandardMaterial({ color: 0x9cc7e8, roughness: 0.35, metalness: 0.05 });
    const stow = new THREE.MeshStandardMaterial({ color: 0xd9cfb4, roughness: 0.95 });
    const stacks = {};
    Object.keys(BERTH_X).forEach((b) => {
      const g = new THREE.Group();
      g.position.set(BERTH_X[b], 0.5, -0.25);
      cap.group.add(g);
      stacks[b] = g;
      // A thin mat marks each berth.
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.8), new THREE.MeshStandardMaterial({ color: b === 'b4' ? 0x6b4a2a : 0x2f4a66, roughness: 1 }));
      mat.rotation.x = -Math.PI / 2;
      mat.position.set(BERTH_X[b], 0.012, -0.12);
      cap.group.add(mat);
    });
    const pile = new THREE.Group();
    pile.position.set(0, 0.25, -1.55);
    cap.group.add(pile);
    handles.setBags = (berths, pool) => {
      Object.keys(stacks).forEach((b) => {
        const g = stacks[b];
        while (g.children.length) g.remove(g.children[0]);
        (berths[b] || []).forEach((k, i) => {
          const m = new THREE.Mesh(bagGeo, k === 'water' ? water : stow);
          m.position.set((i % 2) * 0.04 - 0.02, i * 0.14, (i % 2 ? 1 : -1) * 0.25);
          m.rotation.y = (i % 3) * 0.08;
          g.add(m);
        });
      });
      while (pile.children.length) pile.remove(pile.children[0]);
      let i = 0;
      ['water', 'stow'].forEach((k) => {
        for (let n = 0; n < (pool[k] || 0); n++, i++) {
          const m = new THREE.Mesh(bagGeo, k === 'water' ? water : stow);
          m.position.set(((i % 4) - 1.5) * 0.45, Math.floor(i / 4) * 0.14, 0);
          pile.add(m);
        }
      });
    };
    handles.setCrew = (where) => {
      // where: { castId: berthId|null }
      ['you', 'yusuf', 'lena', 'grace'].forEach((id, k) => {
        const a = id === 'you' ? me : crew[id];
        const b = where[id];
        a.userData = a.userData || {};
        if (b) {
          a.group.position.set(BERTH_X[b], 0.14, 0.68);
          a.group.rotation.set(-Math.PI / 2, 0, 0);
          a.lying = true;
        } else {
          a.lying = false;
          a.group.rotation.set(0, Math.PI + (k - 1.5) * 0.4, 0);
          // Waiting by the aft lockers, below the camera's line of sight.
          a.group.position.set((k - 1.5) * 0.62, 0.12, -1.3 + Math.abs(k - 1.5) * 0.12);
        }
      });
      seated.clear();
    };
    handles.carry = (kind, berth, seconds) => {
      const from = new THREE.Vector3(0, 0.45, -1.35);
      const to = new THREE.Vector3(BERTH_X[berth], 0.55, -0.55);
      const m = new THREE.Mesh(bagGeo, kind === 'water' ? water : stow);
      cap.group.add(m);
      carry = { from, to, t: 0, dur: Math.max(0.2, seconds), mesh: m };
      if (me.lying) return;
    };
    handles.setCrew({});
  }

  if (mode === 'burn') {
    me.group.visible = false;
    const w = cap.windows[0];
    const f = w.frame;
    const eye = f.pos.clone().addScaledVector(f.normal, 0.52);
    frame(eye, f.pos.clone().addScaledVector(f.normal, -5), true);
    // Earth straight out of the window, lit from the window's "up" side so
    // the terminator runs across the middle (Apollo 13's COAS picture).
    const out = f.normal.clone().negate();
    cap.setView({ earth: { dir: out.toArray(), deg: 9, spin: 2.2 }, moon: null, sun: f.up.toArray() });
    const qp = new THREE.Quaternion();
    const qr = new THREE.Quaternion();
    handles.setAttitude = (pitchDeg, rollDeg) => {
      qp.setFromAxisAngle(f.right, (pitchDeg * Math.PI) / 180);
      qr.setFromAxisAngle(out, (rollDeg * Math.PI) / 180);
      cap.setAttitude(qr.clone().multiply(qp));
    };
    handles.setAttitude(0, 0);
    // Where the window centre lands on screen, for the HTML reticle.
    handles.windowScreen = () => {
      const p = f.pos.clone();
      cap.group.localToWorld(p);
      p.project(camera);
      return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
    };
  }

  if (mode === 'entry') {
    me.group.visible = false;
    const s = cap.seats.you.position;
    frame(new THREE.Vector3(s.x + 0.02, s.y + 1.62, s.z + 0.05), new THREE.Vector3(-0.15, 1.75, 1.6), true);
    camera.fov = 70;
    cap.setView('space');
    handles.setPlasma = (k) => cap.setPlasma(k);
    handles.setSky = (k) => cap.setSky(k);
  }

  handles.setShake = (k) => {
    shake = reduced ? 0 : clamp(k, 0, 1.5);
  };

  // ---------- Frame update ----------
  function update(dt) {
    dt = Math.min(dt || 0, 0.1);
    time += dt;
    cap.update(dt);
    if (reachT > 0) reachT -= dt;
    reach += ((reachT > 0 ? 1 : 0) - reach) * Math.min(1, dt * 7);
    if (ctl) {
      // The controller animates the astronaut (its zero-g float pose).
      ctl.update(dt);
      cap.volume.clamp(me.group.position);
      if (reach > 0.02) {
        me.joints.shR.rotation.x = -1.35 * reach - 0.5 * (1 - reach);
        me.joints.elR.rotation.x = -0.2;
      }
    } else {
      me.update(dt);
      if (me.lying) liePose(me);
      else floatPose(me, time, { reach, carry: !!carry, still: reduced });
    }
    Object.keys(crew).forEach((id) => {
      const a = crew[id];
      a.update(dt);
      if (a.lying) liePose(a);
      else if (seated.has(id)) sitPose(a);
      else floatPose(a, time + id.length, { still: reduced });
    });
    // Gentle zero-g bob for the floating commander.
    if (mode === 'power' && !reduced) {
      me.group.position.y = 0.4 + Math.sin(time * 0.7) * 0.025;
      me.group.rotation.z = Math.sin(time * 0.45) * 0.04;
    }
    if (carry) {
      carry.t += dt;
      const u = clamp(carry.t / carry.dur);
      const e = u * u * (3 - 2 * u);
      const p = new THREE.Vector3().lerpVectors(carry.from, carry.to, e);
      p.y += Math.sin(u * Math.PI) * 0.35;
      carry.mesh.position.copy(p);
      if (!me.lying) {
        me.group.position.set(p.x, p.y - 1.05, p.z - 0.3);
        me.group.rotation.y = Math.atan2(carry.to.x - carry.from.x, carry.to.z - carry.from.z);
      }
      if (u >= 1) {
        cap.group.remove(carry.mesh);
        carry = null;
      }
    }
    if (!ctl) {
      camPos.lerp(rig.pos, Math.min(1, dt * 3));
      camTarget.lerp(rig.at, Math.min(1, dt * 3));
      camera.position.copy(camPos);
      if (shake > 0) {
        const s = shake * 0.012;
        camera.position.x += (Math.random() - 0.5) * s;
        camera.position.y += (Math.random() - 0.5) * s;
      }
      camera.lookAt(camTarget);
    }
  }

  const sceneObj = {
    scene,
    camera,
    exposure: 1.05,
    update,
    onResize(w, h) {
      // Phones: pull the fixed cameras back a little so the panel fits.
      camera.fov = mode === 'burn' ? (w < h ? 58 : 40) : w < h ? 72 : mode === 'entry' ? 70 : mode === 'storm' ? 62 : 58;
      camera.updateProjectionMatrix();
    },
    dispose() {
      if (ctl) ctl.dispose();
      me.dispose();
      Object.values(crew).forEach((a) => a.dispose());
      cap.dispose();
    },
    // Handles for the segment script.
    mode,
    capsule: cap,
    me,
    crew,
    controller: ctl,
    handles,
    frame,
  };
  return sceneObj;
}
