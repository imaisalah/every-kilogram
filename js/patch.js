// The mission patch: an embroidered badge drawn from the design itself.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});

  const PLANET_ART = {
    mars: (cx, cy, r) => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#B8481F"/>
      <path d="M${cx - r * 0.7} ${cy - r * 0.2} q ${r * 0.4} ${-r * 0.25} ${r * 0.9} ${-r * 0.05} t ${r * 0.5} ${r * 0.2}" stroke="#8E3214" stroke-width="${r * 0.12}" fill="none" stroke-linecap="round"/>
      <circle cx="${cx + r * 0.25}" cy="${cy + r * 0.35}" r="${r * 0.12}" fill="#8E3214"/>
      <path d="M${cx - r * 0.45} ${cy - r * 0.86} a ${r} ${r} 0 0 1 ${r * 0.9} 0" stroke="#F3E9DE" stroke-width="${r * 0.14}" fill="none" stroke-linecap="round"/>`,
    venus: (cx, cy, r) => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#E2B867"/>
      <path d="M${cx - r * 0.95} ${cy - r * 0.15} q ${r} ${-r * 0.35} ${r * 1.9} 0" stroke="#F4DDA0" stroke-width="${r * 0.16}" fill="none"/>
      <path d="M${cx - r * 0.9} ${cy + r * 0.3} q ${r} ${-r * 0.25} ${r * 1.8} 0" stroke="#C99A48" stroke-width="${r * 0.12}" fill="none"/>`,
    jupiter: (cx, cy, r) => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#D8B48A"/>
      <path d="M${cx - r} ${cy - r * 0.35} h ${2 * r} M${cx - r} ${cy + r * 0.05} h ${2 * r} M${cx - r} ${cy + r * 0.45} h ${2 * r}" stroke="#A9724A" stroke-width="${r * 0.13}"/>
      <ellipse cx="${cx + r * 0.3}" cy="${cy + r * 0.25}" rx="${r * 0.2}" ry="${r * 0.11}" fill="#B5502E"/>
      <circle cx="${cx - r * 1.35}" cy="${cy - r * 0.9}" r="${r * 0.16}" fill="#E9E3D2" stroke="#B9A98A" stroke-width="1"/>`,
    earth: (cx, cy, r) => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#2A6BB0"/>
      <path d="M${cx - r * 0.2} ${cy - r * 0.9} q ${r * 0.35} ${r * 0.3} ${r * 0.1} ${r * 0.8} q ${-r * 0.1} ${r * 0.35} ${r * 0.25} ${r * 0.95}" stroke="#6F8A3C" stroke-width="${r * 0.32}" fill="none" stroke-linecap="round"/>
      <path d="M${cx - r * 0.05} ${cy - r * 0.15} l ${r * 0.06} ${r * 0.5}" stroke="#3FA7D6" stroke-width="${r * 0.08}" stroke-linecap="round"/>
      <path d="M${cx - r * 0.85} ${cy + r * 0.2} q ${r * 0.5} ${-r * 0.2} ${r * 0.9} ${r * 0.05}" stroke="#F2F5F7" stroke-width="${r * 0.1}" fill="none" stroke-linecap="round" opacity="0.8"/>`,
    moon: (cx, cy, r) => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#B9B9B4"/>
      <circle cx="${cx - r * 0.3}" cy="${cy - r * 0.2}" r="${r * 0.22}" fill="#8E8E89"/>
      <circle cx="${cx + r * 0.35}" cy="${cy + r * 0.25}" r="${r * 0.15}" fill="#8E8E89"/>
      <circle cx="${cx + r * 0.05}" cy="${cy + r * 0.7}" r="${r * 0.12}" fill="#5E7F9E"/>`,
  };
  const ART_FOR = { nile: 'earth', weather: 'earth', moon: 'moon', mars: 'mars', venus: 'venus', jupiter: 'jupiter' };
  const DEST_NAME = { nile: 'EARTH', weather: 'EARTH', moon: 'MOON', mars: 'MARS', venus: 'VENUS', jupiter: 'EUROPA' };

  const clipId = () => 'p' + Math.random().toString(36).slice(2, 8);

  // design: the design object; info: { year } optional.
  function patchSVG(design, info) {
    const id = clipId();
    const name = (design.name || 'Mission').toUpperCase();
    const destName = DEST_NAME[design.mission] || '';
    const year = info && info.year ? ` ${info.year}` : '';
    const ring = '#D9A21B';
    const field = '#14273C';
    const insts = design.instruments || [];

    // Spacecraft silhouette, scaled from the design.
    const sx = 86;
    const sy = 92;
    const armLen = Math.min(46, 6 + Math.sqrt(design.arrays || 0) * 5.2);
    const dishR = { 1: 5, 2: 8, 3: 11 }[design.dish] || 6;
    let craft = '';
    if (design.arrays > 0) {
      craft += `<rect x="${sx - 9 - armLen}" y="${sy - 6}" width="${armLen}" height="12" fill="#2F6FB0" stroke="#9EC5F4" stroke-width="1"/>`;
      craft += `<rect x="${sx + 9}" y="${sy - 6}" width="${armLen}" height="12" fill="#2F6FB0" stroke="#9EC5F4" stroke-width="1"/>`;
      const lines = Math.max(1, Math.round(armLen / 7));
      for (let k = 1; k < lines; k++) {
        const dx = (armLen / lines) * k;
        craft += `<path d="M${sx - 9 - dx} ${sy - 6} v12 M${sx + 9 + dx} ${sy - 6} v12" stroke="#9EC5F4" stroke-width="0.6"/>`;
      }
    }
    if (insts.includes('sounder') || insts.includes('iceRadar')) {
      const L = insts.includes('iceRadar') ? 34 : 24;
      craft += `<path d="M${sx - 4} ${sy + 9} l ${-L * 0.6} ${L * 0.8} M${sx + 4} ${sy + 9} l ${L * 0.6} ${L * 0.8}" stroke="#E9EEF2" stroke-width="1.6"/>`;
    }
    if (insts.includes('mag')) craft += `<path d="M${sx + 9} ${sy + 6} l 30 18" stroke="#E9EEF2" stroke-width="1.2"/><circle cx="${sx + 40}" cy="${sy + 24.5}" r="2.4" fill="#E9EEF2"/>`;
    for (let k = 0; k < (design.rtg || 0); k++) craft += `<rect x="${sx - 7 + k * 6}" y="${sy + 9}" width="3.5" height="13" rx="1" fill="#C25B3A"/>`;
    craft += `<rect x="${sx - 9}" y="${sy - 9}" width="18" height="18" rx="2" fill="#D9A21B" stroke="#7A5A0C" stroke-width="1"/>`;
    if (design.shield) craft += `<rect x="${sx - 5}" y="${sy - 5}" width="10" height="10" fill="none" stroke="#7A5A0C" stroke-width="${Math.min(3, design.shield / 40)}"/>`;
    craft += `<ellipse cx="${sx}" cy="${sy - 9 - dishR * 0.45}" rx="${dishR}" ry="${dishR * 0.45}" fill="#E9EEF2" stroke="#A9B6C2" stroke-width="1"/>`;
    if (insts.includes('sar')) craft += `<rect x="${sx - 30}" y="${sy + 13}" width="60" height="5" fill="#E9EEF2"/>`;
    if (insts.includes('hires')) craft += `<rect x="${sx + 6}" y="${sy - 20}" width="7" height="12" fill="#C9D3DC"/>`;

    // One star per instrument along the top.
    let stars = '';
    const n = insts.length;
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (1.25 + (0.5 * (k + 1)) / (n + 1));
      const x = 100 + Math.cos(a) * 62;
      const y = 100 + Math.sin(a) * 62;
      stars += `<path d="M${x} ${y - 4.5} L${x + 1.3} ${y - 1.3} L${x + 4.5} ${y} L${x + 1.3} ${y + 1.3} L${x} ${y + 4.5} L${x - 1.3} ${y + 1.3} L${x - 4.5} ${y} L${x - 1.3} ${y - 1.3} Z" fill="#F4E4B5"/>`;
    }

    const planet = PLANET_ART[ART_FOR[design.mission] || 'mars'](138, 132, 30);
    const orbitTilt = { mars: -18, venus: -12, jupiter: -24 }[design.mission] ?? -16;

    return `<svg class="patch" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(SMD.t ? SMD.t('patch.aria', 'Mission patch for {name}', { name: design.name }) : 'Mission patch for ' + design.name)}">
      <defs>
        <clipPath id="${id}c"><circle cx="100" cy="100" r="73"/></clipPath>
        <path id="${id}t" d="M 100 100 m -84 0 a 84 84 0 1 1 168 0"/>
        <path id="${id}b" d="M 100 100 m -86 0 a 86 86 0 0 0 172 0"/>
        <pattern id="${id}w" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V2.6" stroke="#fff" stroke-width="0.7" opacity="0.07"/></pattern>
        <pattern id="${id}g" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)"><path d="M0 0V2.4" stroke="#5c430a" stroke-width="0.7" opacity="0.22"/></pattern>
      </defs>
      <circle cx="100" cy="100" r="98" fill="${ring}"/>
      <circle cx="100" cy="100" r="98" fill="url(#${id}g)"/>
      <circle cx="100" cy="100" r="97" fill="none" stroke="#7A5A0C" stroke-width="2.6" stroke-dasharray="0.7 0.8" opacity="0.55"/>
      <circle cx="100" cy="100" r="94" fill="none" stroke="#7A5A0C" stroke-width="1.2" stroke-dasharray="2.2 1.6"/>
      <circle cx="100" cy="100" r="75" fill="${field}" stroke="#7A5A0C" stroke-width="1.5"/>
      <circle cx="100" cy="100" r="74" fill="url(#${id}w)"/>
      <g clip-path="url(#${id}c)">
        ${planet}
        <ellipse cx="138" cy="132" rx="60" ry="17" transform="rotate(${orbitTilt} 138 132)" fill="none" stroke="#E9EEF2" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>
        ${stars}
        ${craft}
      </g>
      <circle cx="100" cy="100" r="73" fill="none" stroke="#F4E4B5" stroke-width="0.8" stroke-dasharray="1.6 1.6" opacity="0.6"/>
      <text font-family="Archivo, 'Arial Narrow', sans-serif" font-weight="800" font-size="15" letter-spacing="2" fill="#14273C"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${escapeXml(name)}</textPath></text>
      <text font-family="Archivo, 'Arial Narrow', sans-serif" font-weight="700" font-size="11" letter-spacing="2.5" fill="#14273C" dy="9"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${destName}${year}</textPath></text>
    </svg>`;
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
  }

  // Render the patch to a PNG and download it.
  function downloadPatch(design, info) {
    const svg = patchSVG(design, info).replace('<svg ', '<svg width="800" height="800" ');
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 800;
      c.height = 800;
      c.getContext('2d').drawImage(img, 0, 0, 800, 800);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = `${(design.name || 'mission').toLowerCase()}-patch.png`;
      a.click();
    };
    img.src = url;
  }

  SMD.patch = { patchSVG, downloadPatch, escapeXml };
})();
