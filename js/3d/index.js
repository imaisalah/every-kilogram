// Entry point for the 3D layer. Loads after the classic scripts, registers the
// shared 3D helpers and asset loader, then starts the game.
import * as engine from './engine.js';
import './loader.js';
import { createTitle } from './title.js';

const SMD = globalThis.SMD;
SMD.three = { engine, createTitle };
if (SMD.applyLang) SMD.applyLang();

// "#dev-<screen>" opens a screen on a ready-made career (for development).
const dev = /^#dev-(\w+)$/.exec(location.hash);
if (dev && SMD.ui.screens[dev[1]]) {
  SMD.quickStartCareer();
  SMD.go(dev[1]);
} else SMD.go('start');
