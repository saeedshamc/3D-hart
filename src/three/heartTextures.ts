import * as THREE from 'three';

export interface MyocardiumTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createMyocardiumTextures(
  maxAnisotropy: number,
  tint: 'ventricle' | 'atrium' = 'ventricle',
): MyocardiumTextureSet {
  const size = 512;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Base organic myocardial tone (slightly lighter, softer pink-crimson for child's heart)
  const baseGrad = cCtx.createLinearGradient(0, 0, size, size);
  if (tint === 'ventricle') {
    baseGrad.addColorStop(0, '#a8333e');
    baseGrad.addColorStop(0.5, '#962734');
    baseGrad.addColorStop(1, '#7e1e2b');
  } else {
    baseGrad.addColorStop(0, '#8d2a3d');
    baseGrad.addColorStop(0.5, '#782236');
    baseGrad.addColorStop(1, '#681c2f');
  }
  cCtx.fillStyle = baseGrad;
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#787878';
  bCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#484848';
  rCtx.fillRect(0, 0, size, size);

  // Helical myocardial muscle fiber striations
  for (let i = 0; i < 680; i++) {
    const y0 = Math.random() * size;
    const x0 = Math.random() * size;
    const len = 40 + Math.random() * 110;
    const angle = -0.38 + (Math.random() - 0.5) * 0.22;
    const x1 = x0 + Math.cos(angle) * len;
    const y1 = y0 + Math.sin(angle) * len;
    const mx = (x0 + x1) * 0.5 + (Math.random() - 0.5) * 14;
    const my = (y0 + y1) * 0.5 + (Math.random() - 0.5) * 14;

    const isLight = Math.random() > 0.48;
    cCtx.strokeStyle = isLight
      ? 'rgba(220, 118, 124, 0.14)'
      : 'rgba(68, 12, 20, 0.18)';
    cCtx.lineWidth = 1.2 + Math.random() * 2.4;
    cCtx.beginPath();
    cCtx.moveTo(x0, y0);
    cCtx.quadraticCurveTo(mx, my, x1, y1);
    cCtx.stroke();

    bCtx.strokeStyle = isLight
      ? 'rgba(215, 215, 215, 0.28)'
      : 'rgba(55, 55, 55, 0.28)';
    bCtx.lineWidth = 1.6 + Math.random() * 2.4;
    bCtx.beginPath();
    bCtx.moveTo(x0, y0);
    bCtx.quadraticCurveTo(mx, my, x1, y1);
    bCtx.stroke();

    const rv = isLight ? 46 : 95;
    rCtx.strokeStyle = `rgba(${rv}, ${rv}, ${rv}, 0.25)`;
    rCtx.lineWidth = 2.0;
    rCtx.beginPath();
    rCtx.moveTo(x0, y0);
    rCtx.quadraticCurveTo(mx, my, x1, y1);
    rCtx.stroke();
  }

  // Fine subepicardial micro-capillary branching network
  for (let v = 0; v < 42; v++) {
    let cx = Math.random() * size;
    let cy = Math.random() * size;
    let dir = Math.random() * Math.PI * 2;
    cCtx.strokeStyle = 'rgba(72, 14, 28, 0.34)';
    cCtx.lineWidth = 1.1;
    cCtx.beginPath();
    cCtx.moveTo(cx, cy);
    for (let step = 0; step < 9; step++) {
      dir += (Math.random() - 0.5) * 0.7;
      cx += Math.cos(dir) * 16;
      cy += Math.sin(dir) * 16;
      cCtx.lineTo(cx, cy);
    }
    cCtx.stroke();
  }

  // Subtle epicardial adipose mottling patches near base/sulci
  for (let f = 0; f < 30; f++) {
    const fx = Math.random() * size;
    const fy = Math.random() * size;
    const fr = 12 + Math.random() * 26;
    const fg = cCtx.createRadialGradient(fx, fy, 1, fx, fy, fr);
    fg.addColorStop(0, 'rgba(235, 198, 130, 0.14)');
    fg.addColorStop(1, 'rgba(235, 198, 130, 0)');
    cCtx.fillStyle = fg;
    cCtx.beginPath();
    cCtx.arc(fx, fy, fr, 0, Math.PI * 2);
    cCtx.fill();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return {
    map,
    bumpMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      bumpMap.dispose();
      roughnessMap.dispose();
    },
  };
}

export function createVesselWallTexture(
  baseHex: string,
  streakHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 160; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = streakHex;
    ctx.globalAlpha = 0.08 + Math.random() * 0.12;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      size * 0.33,
      y + (Math.random() - 0.5) * 10,
      size * 0.66,
      y + (Math.random() - 0.5) * 10,
      size,
      y,
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.48,
  );
  grad.addColorStop(0, 'rgba(3, 6, 10, 0.85)');
  grad.addColorStop(0.5, 'rgba(4, 8, 14, 0.42)');
  grad.addColorStop(1, 'rgba(4, 8, 14, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
