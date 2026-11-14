/* AGRIXON — field diorama.
   Open-source stack: Three.js (MIT), AWS Terrain Tiles (terrarium), NASA GIBS.
   A single field is cut out of the terrain as a solid block and planted. */
import * as THREE from "./vendor/three.module.js";
import { pickZoom, stageName, gddBetween, synthDaily, plantHeight } from "./field-model.js";

const TILE = 256;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- geo helpers ---------- */
const R = 6378137;
const rad = (d) => (d * Math.PI) / 180;

function lonLatToMeters(lon, lat, lon0, lat0) {
  return [
    (lon - lon0) * rad(1) * R * Math.cos(rad(lat0)),
    -(lat - lat0) * rad(1) * R,
  ];
}
function bboxOf(ring) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < w) w = lon;
    if (lon > e) e = lon;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [w, s, e, n];
}
function lon2tile(lon, z) {
  return ((lon + 180) / 360) * 2 ** z;
}
function lat2tile(lat, z) {
  const r = rad(lat);
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ---------- DEM ---------- */
async function decodeTerrarium(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("DEM " + res.status);
  const bmp = await createImageBitmap(await res.blob());
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
  const out = new Float32Array(bmp.width * bmp.height);
  for (let i = 0; i < out.length; i++) {
    out[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
  }
  return { w: bmp.width, h: bmp.height, data: out };
}

async function loadDem(bbox, z, signal) {
  const [w, s, e, n] = bbox;
  const x0 = Math.floor(lon2tile(w, z)), x1 = Math.floor(lon2tile(e, z));
  const y0 = Math.floor(lat2tile(n, z)), y1 = Math.floor(lat2tile(s, z));
  const nx = x1 - x0 + 1, ny = y1 - y0 + 1;
  const W = nx * TILE, H = ny * TILE;
  const data = new Float32Array(W * H);
  const jobs = [];
  for (let ty = 0; ty < ny; ty++) {
    for (let tx = 0; tx < nx; tx++) {
      const url = `${location.origin}/api/dem/${z}/${x0 + tx}/${y0 + ty}.png`;
      jobs.push(
        decodeTerrarium(url, signal).then((t) => {
          for (let y = 0; y < TILE; y++) {
            const src = y * TILE;
            const dst = (ty * TILE + y) * W + tx * TILE;
            data.set(t.data.subarray(src, src + TILE), dst);
          }
        })
      );
    }
  }
  await Promise.all(jobs);
  return { data, W, H, z, x0, y0 };
}

function sampleDem(dem, lon, lat) {
  const px = (lon2tile(lon, dem.z) - dem.x0) * TILE;
  const py = (lat2tile(lat, dem.z) - dem.y0) * TILE;
  const x = clamp(px, 0, dem.W - 1.001), y = clamp(py, 0, dem.H - 1.001);
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const i = yi * dem.W + xi;
  const a = dem.data[i], b = dem.data[i + 1], c = dem.data[i + dem.W], d = dem.data[i + dem.W + 1];
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

/* ---------- imagery ---------- */
async function loadImagery(bbox, date, layer, signal) {
  const z = 9;
  const [w, s, e, n] = bbox;
  const x0 = Math.floor(lon2tile(w, z)), x1 = Math.floor(lon2tile(e, z));
  const y0 = Math.floor(lat2tile(n, z)), y1 = Math.floor(lat2tile(s, z));
  const nx = x1 - x0 + 1, ny = y1 - y0 + 1;
  const canvas = document.createElement("canvas");
  canvas.width = nx * TILE;
  canvas.height = ny * TILE;
  const g = canvas.getContext("2d");
  const jobs = [];
  let failed = 0;
  for (let ty = 0; ty < ny; ty++) {
    for (let tx = 0; tx < nx; tx++) {
      const url = `${location.origin}/api/nasa/gibs/tile/${layer}/${date}/${z}/${y0 + ty}/${x0 + tx}`;
      jobs.push(
        fetch(url, { signal })
          .then((r) => (r.ok ? r.blob() : null))
          .then((b) => (b ? createImageBitmap(b) : null))
          .then((img) => {
            if (img) g.drawImage(img, tx * TILE, ty * TILE);
            else failed++;
          })
          .catch(() => { failed++; })
      );
    }
  }
  await Promise.all(jobs);
  return { canvas, failed, total: nx * ny, zoom: z };
}

/* ---------- plant sprites ---------- */
function plantTexture(kind) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 256);
  g.lineCap = "round";
  const stem = (x, top, wdt, col) => {
    g.strokeStyle = col;
    g.lineWidth = wdt;
    g.beginPath();
    g.moveTo(x, 252);
    g.quadraticCurveTo(x + 3, (252 + top) / 2, x, top);
    g.stroke();
  };
  if (kind === "cereal") {
    stem(64, 40, 5, "#e8e8e8");
    for (let i = 0; i < 5; i++) {
      const y = 60 + i * 26;
      g.strokeStyle = "#d8d8d8";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(64, y);
      g.quadraticCurveTo(64 + (i % 2 ? 34 : -34), y - 14, 64 + (i % 2 ? 46 : -46), y - 34);
      g.stroke();
    }
    g.fillStyle = "#f2f2f2";
    for (let i = 0; i < 7; i++) {
      const y = 34 + i * 9;
      g.beginPath();
      g.ellipse(64 + (i % 2 ? 5 : -5), y, 5, 8, i % 2 ? 0.4 : -0.4, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === "legume") {
    stem(64, 70, 5, "#e8e8e8");
    for (let i = 0; i < 4; i++) {
      const y = 90 + i * 34;
      g.strokeStyle = "#dcdcdc";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(64, y);
      g.quadraticCurveTo(64 + (i % 2 ? 40 : -40), y - 10, 64 + (i % 2 ? 52 : -52), y - 26);
      g.stroke();
      g.fillStyle = "#f0f0f0";
      g.beginPath();
      g.ellipse(64 + (i % 2 ? 44 : -44), y - 20, 9, 5, i % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#f4f4f4";
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.ellipse(64 + (i - 1) * 16, 120 + i * 30, 6, 14, 0.2, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    stem(64, 60, 6, "#e8e8e8");
    for (let i = 0; i < 6; i++) {
      const y = 80 + i * 26;
      g.fillStyle = "#ededed";
      g.beginPath();
      g.ellipse(64 + (i % 2 ? 26 : -26), y, 22, 10, i % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- scene ---------- */
export async function open(payload) {
  const { field, crop, crops, season, sowing, harvest, daily, imageryDate, soil } = payload;
  const ring = field.geometry.coordinates[0];
  const bbox = bboxOf(ring);
  const [w, s, e, n] = bbox;
  const lon0 = (w + e) / 2, lat0 = (s + n) / 2;
  const widthM = (e - w) * rad(1) * R * Math.cos(rad(lat0));
  const depthM = (n - s) * rad(1) * R;

  const dlg = buildDialog(field, crop, crops, season);
  const controller = new AbortController();
  let closed = false;
  let cleanup = () => {};
  const close = () => {
    if (closed) return;
    closed = true;
    controller.abort();
    cleanup();
    dlg.close();
    dlg.remove();
  };
  dlg.querySelector('[data-f3d=close]').addEventListener('click', close);
  dlg.addEventListener('cancel', event => { event.preventDefault(); close(); });
  document.body.appendChild(dlg);
  dlg.showModal();

  const canvasHost = dlg.querySelector("#f3d-canvas");
  const status = dlg.querySelector("#f3d-status");
  status.textContent = "Loading terrain and imagery…";

  let dem, imagery;
  try {
    const z = pickZoom(bbox);
    [dem, imagery] = await Promise.all([
      loadDem(bbox, z, controller.signal),
      loadImagery(bbox, imageryDate, "MODIS_Terra_CorrectedReflectance_TrueColor", controller.signal),
    ]);
  } catch (err) {
    if (closed) return;
    status.textContent = "Could not load terrain: " + (err && err.message ? err.message : err);
    return;
  }
  if (closed) return;
  const imageryMissing = imagery.failed === imagery.total;
  if (imageryMissing) {
    status.textContent = "Satellite imagery is unavailable. Showing terrain only.";
  } else if (imagery.failed > 0) {
    status.textContent = `Satellite imagery partially loaded (${imagery.total - imagery.failed}/${imagery.total} tiles).`;
  }

  /* renderer */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch {
    status.textContent = '3D rendering is unavailable on this device. You can close this view and use the field map.';
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasHost.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0E1512");
  const spanM = Math.max(widthM, depthM);
  scene.fog = new THREE.Fog("#0E1512", spanM * 2.2, spanM * 5);

  const camera = new THREE.PerspectiveCamera(38, 1, 1, 60000);
  const target = new THREE.Vector3(0, 0, 0);
  const orbit = { theta: -0.7, phi: 0.95, dist: Math.max(widthM, depthM) * 1.55 };
  const applyCamera = () => {
    const sp = Math.sin(orbit.phi), cp = Math.cos(orbit.phi);
    camera.position.set(
      target.x + orbit.dist * sp * Math.sin(orbit.theta),
      target.y + orbit.dist * cp,
      target.z + orbit.dist * sp * Math.cos(orbit.theta)
    );
    camera.lookAt(target);
  };
  applyCamera();

  /* lights */
  scene.add(new THREE.HemisphereLight("#cfe3ff", "#2a2118", 1.15));
  const sun = new THREE.DirectionalLight("#fff3d6", 2.1);
  sun.position.set(-widthM * 0.7, Math.max(widthM, depthM) * 1.1, depthM * 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  const ext = Math.max(widthM, depthM) * 0.85;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
  sc.near = 1; sc.far = Math.max(widthM, depthM) * 6;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#9FC4E8", 0.55);
  fill.position.set(widthM * 0.8, Math.max(widthM, depthM) * 0.5, -depthM * 0.9);
  scene.add(fill);

  /* heights */
  let minH = Infinity, maxH = -Infinity, sumH = 0, cntH = 0;
  for (const [lon, lat] of ring) {
    const h = sampleDem(dem, lon, lat);
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
    sumH += h; cntH++;
  }
  const meanH = sumH / Math.max(1, cntH);
  const relief = Math.max(1, maxH - minH);
  const vScale = clamp(relief < 8 ? 3.2 : relief < 25 ? 2.2 : 1.4, 1, 4);
  const blockDepth = Math.max(18, Math.max(widthM, depthM) * 0.22);
  const baseY = (minH - blockDepth) * vScale;

  const toLocal = (lon, lat) => {
    const [x, z] = lonLatToMeters(lon, lat, lon0, lat0);
    return [x, z];
  };

  /* top surface: grid displaced by DEM, clipped by the polygon alpha mask */
  const N = 180;
  const pos = new Float32Array((N + 1) * (N + 1) * 3);
  const uv = new Float32Array((N + 1) * (N + 1) * 2);
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const u = i / N, v = j / N;
      const lon = lerp(w, e, u), lat = lerp(s, n, v);
      const [x, z] = toLocal(lon, lat);
      const h = sampleDem(dem, lon, lat);
      const k = (j * (N + 1) + i) * 3;
      pos[k] = x;
      pos[k + 1] = h * vScale;
      pos[k + 2] = z;
      const q = (j * (N + 1) + i) * 2;
      uv[q] = u;
      uv[q + 1] = v;
    }
  }
  const idx = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  topGeo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  topGeo.setIndex(idx);
  topGeo.computeVertexNormals();

  /* imagery + polygon mask in one texture */
  const texCanvas = document.createElement("canvas");
  texCanvas.width = 1024;
  texCanvas.height = 1024;
  const tg = texCanvas.getContext("2d");
  tg.fillStyle = "#6E7A6A";
  tg.fillRect(0, 0, 1024, 1024);
  tg.drawImage(imagery.canvas, 0, 0, 1024, 1024);
  tg.globalCompositeOperation = "destination-in";
  tg.beginPath();
  ring.forEach(([lon, lat], i) => {
    const x = ((lon - w) / (e - w)) * 1024;
    const y = (1 - (lat - s) / (n - s)) * 1024;
    i ? tg.lineTo(x, y) : tg.moveTo(x, y);
  });
  tg.closePath();
  tg.fill();
  const topTex = new THREE.CanvasTexture(texCanvas);
  topTex.colorSpace = THREE.SRGBColorSpace;
  topTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const topMat = new THREE.MeshStandardMaterial({
    map: topTex,
    roughness: 0.96,
    metalness: 0,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.receiveShadow = true;
  scene.add(topMesh);

  /* contour lines from the DEM, clipped to the field */
  const contourGroup = new THREE.Group();
  {
    const M = 64;
    const step = Math.max(1, relief / 6);
    const levels = [];
    for (let lv = Math.ceil(minH / step) * step; lv < maxH; lv += step) levels.push(lv);
    const grid = [];
    for (let j = 0; j <= M; j++) {
      grid[j] = [];
      for (let i = 0; i <= M; i++) {
        const lon = lerp(w, e, i / M), lat = lerp(s, n, j / M);
        grid[j][i] = { h: sampleDem(dem, lon, lat), lon, lat };
      }
    }
    const cpos = [];
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < M; i++) {
        const c00 = grid[j][i], c10 = grid[j][i + 1], c01 = grid[j + 1][i], c11 = grid[j + 1][i + 1];
        for (const lv of levels) {
          const pts = [];
          const edge = (a, b) => {
            if ((a.h < lv) !== (b.h < lv)) {
              const t = (lv - a.h) / (b.h - a.h);
              pts.push([lerp(a.lon, b.lon, t), lerp(a.lat, b.lat, t)]);
            }
          };
          edge(c00, c10); edge(c10, c11); edge(c11, c01); edge(c01, c00);
          const pairs = pts.length === 2 ? [[pts[0], pts[1]]] : pts.length === 4 ? [[pts[0], pts[1]], [pts[2], pts[3]]] : [];
          for (const [a, b] of pairs) {
            if (!pointInRing((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ring)) continue;
            const [x1, z1] = toLocal(a[0], a[1]);
            const [x2, z2] = toLocal(b[0], b[1]);
            cpos.push(x1, sampleDem(dem, a[0], a[1]) * vScale + 0.8, z1, x2, sampleDem(dem, b[0], b[1]) * vScale + 0.8, z2);
          }
        }
      }
    }
    const cgeo = new THREE.BufferGeometry();
    cgeo.setAttribute("position", new THREE.Float32BufferAttribute(cpos, 3));
    contourGroup.add(new THREE.LineSegments(cgeo, new THREE.LineBasicMaterial({ color: "#16241B", transparent: true, opacity: 0.42 })));
    scene.add(contourGroup);
  }

  /* walls: extruded polygon edge down to the base */
  const wallPos = [], wallCol = [], wallIdx = [];
  const cTop = new THREE.Color("#5A4230"), cBot = new THREE.Color("#8A7052");
  let vi = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lonA, latA] = ring[i], [lonB, latB] = ring[i + 1];
    const [xa, za] = toLocal(lonA, latA);
    const [xb, zb] = toLocal(lonB, latB);
    const ha = sampleDem(dem, lonA, latA) * vScale;
    const hb = sampleDem(dem, lonB, latB) * vScale;
    wallPos.push(xa, ha, za, xb, hb, zb, xa, baseY, za, xb, baseY, zb);
    wallCol.push(cTop.r, cTop.g, cTop.b, cTop.r, cTop.g, cTop.b, cBot.r, cBot.g, cBot.b, cBot.r, cBot.g, cBot.b);
    wallIdx.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
    vi += 4;
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute("position", new THREE.Float32BufferAttribute(wallPos, 3));
  wallGeo.setAttribute("color", new THREE.Float32BufferAttribute(wallCol, 3));
  wallGeo.setIndex(wallIdx);
  wallGeo.computeVertexNormals();
  const wallMesh = new THREE.Mesh(
    wallGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide })
  );
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  scene.add(wallMesh);

  /* bottom */
  const shape = new THREE.Shape();
  ring.forEach(([lon, lat], i) => {
    const [x, z] = toLocal(lon, lat);
    i ? shape.lineTo(x, -z) : shape.moveTo(x, -z);
  });
  const bottomGeo = new THREE.ShapeGeometry(shape);
  bottomGeo.rotateX(-Math.PI / 2);
  const bottom = new THREE.Mesh(
    bottomGeo,
    new THREE.MeshStandardMaterial({ color: "#241A12", roughness: 1, side: THREE.DoubleSide })
  );
  bottom.position.y = baseY;
  scene.add(bottom);

  /* plants */
  const kind = crop && crop.family === "legume" ? "legume" : crop && crop.family === "row" ? "row" : "cereal";
  const plantTex = plantTexture(kind);
  const plantGeo = new THREE.PlaneGeometry(1, 1);
  plantGeo.translate(0, 0.5, 0);
  const plantMat = new THREE.MeshStandardMaterial({
    map: plantTex,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
  });

  const spacing = Math.max(5, Math.sqrt((widthM * depthM) / 7000));
  const spots = [];
  for (let z = -depthM / 2; z <= depthM / 2; z += spacing) {
    for (let x = -widthM / 2; x <= widthM / 2; x += spacing) {
      const jx = x + (Math.random() - 0.5) * spacing * 0.7;
      const jz = z + (Math.random() - 0.5) * spacing * 0.7;
      const lon = lon0 + jx / (rad(1) * R * Math.cos(rad(lat0)));
      const lat = lat0 - jz / (rad(1) * R);
      if (!pointInRing(lon, lat, ring)) continue;
      spots.push([jx, jz, sampleDem(dem, lon, lat) * vScale]);
    }
  }
  const count = spots.length;
  const inst = new THREE.InstancedMesh(plantGeo, plantMat, count);
  inst.castShadow = true;
  inst.receiveShadow = false;
  inst.frustumCulled = false;
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const young = new THREE.Color("#7FBF4F"), mid = new THREE.Color("#4E8A3A"), ripe = new THREE.Color("#D4A62A");
  const plantScale = Math.max(3, spacing * 1.6);

  const applyGrowth = (f) => {
    const h = plantHeight(f);
    const sy = plantScale * (0.12 + 0.88 * h);
    const sxz = plantScale * (0.55 + 0.45 * h);
    for (let i = 0; i < count; i++) {
      const [x, z, y] = spots[i];
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, (i * 2.399) % (Math.PI * 2), 0);
      dummy.scale.set(sxz, sy, sxz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      if (f < 0.55) col.copy(young).lerp(mid, f / 0.55);
      else col.copy(mid).lerp(ripe, (f - 0.55) / 0.45);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
  };
  scene.add(inst);

  /* ---------- UI ---------- */
  const timeEl = dlg.querySelector("#f3d-time");
  const dateEl = dlg.querySelector("#f3d-date");
  const playEl = dlg.querySelector("#f3d-play");
  const cropEl = dlg.querySelector("#f3d-crop");
  const hud = dlg.querySelector("#f3d-hud");
  const scaleEl = dlg.querySelector("#f3d-scale");
  const contoursEl = dlg.querySelector("#f3d-contours");
  const plantsEl = dlg.querySelector("#f3d-plants");
  contoursEl.addEventListener("change", () => {
    contourGroup.visible = contoursEl.checked;
    requestRender();
  });
  plantsEl.addEventListener("change", () => {
    syncPlants();
    requestRender();
  });

  const start = sowing || `${season}-05-01`;
  const end = harvest || `${season}-09-30`;
  const series = daily && daily.length ? daily : synthDaily(start, end, lat0);
  const synthetic = !(daily && daily.length);
  const dayMs = 864e5;
  const startMs = Date.parse(start + "T00:00:00Z");
  const endMs = Math.max(Date.parse(end + "T00:00:00Z"), startMs + 30 * dayMs);
  timeEl.min = "0";
  timeEl.max = String(Math.round((endMs - startMs) / dayMs));
  timeEl.value = String(Math.round((endMs - startMs) / dayMs));

  let activeCrop = crop || null;
  cropEl.value = activeCrop ? activeCrop.id : "";
  let playing = false, playTimer = null;
  const syncPlants = () => {
    inst.visible = plantsEl.checked && !!activeCrop;
  };

  const update = () => {
    const day = Number(timeEl.value);
    const date = new Date(startMs + day * dayMs).toISOString().slice(0, 10);
    const base = activeCrop ? activeCrop.gddBase : 0;
    const target = activeCrop ? activeCrop.gddTarget : 1800;
    const { gdd, days } = gddBetween(series, start, date, base);
    const f = activeCrop ? clamp(gdd / Math.max(1, target), 0, 1) : 0;
    applyGrowth(f);
    syncPlants();
    dateEl.textContent = date;
    const hcm = Math.round(plantHeight(f) * (kind === "cereal" ? 95 : kind === "legume" ? 70 : 110));
    hud.innerHTML = `
      <div class="f3d-row"><span>Crop</span><b>${esc(activeCrop ? activeCrop.name : "Not assigned")}</b></div>
      <div class="f3d-row"><span>Sowing</span><b>${esc(start)}</b></div>
      <div class="f3d-row"><span>Date</span><b>${esc(date)}</b></div>
      <div class="f3d-row"><span>Days</span><b>${days}</b></div>
      <div class="f3d-row"><span>GDD</span><b>${activeCrop ? Math.round(gdd) + " / " + target + " °C·d" : "—"}</b></div>
      <div class="f3d-row"><span>Stage (model)</span><b>${activeCrop ? esc(stageName(f)) : "—"}</b></div>
      <div class="f3d-row"><span>Height (model)</span><b>${activeCrop ? hcm + " cm" : "—"}</b></div>
      <div class="f3d-row"><span>Plants</span><b>${activeCrop ? count + " shown" : "assign a crop"}</b></div>
      <div class="f3d-sep"></div>
      <div class="f3d-row"><span>Area</span><b>${field.areaHa.toFixed(1)} ha</b></div>
      <div class="f3d-row"><span>Elevation</span><b>${Math.round(minH)}–${Math.round(maxH)} m</b></div>
      <div class="f3d-row"><span>Relief</span><b>${relief.toFixed(1)} m</b></div>
      <div class="f3d-row"><span>Soil</span><b>${soil && soil.ph != null ? "pH " + soil.ph : "not set"}</b></div>
      <div class="f3d-sep"></div>
       <div class="f3d-src">DEM: AWS Terrain Tiles (terrarium), z${dem.z}. Imagery: NASA GIBS MODIS Terra ${esc(imageryDate)}, tile zoom ${imagery.zoom}; resampled visualization, not field-scale detail. Growth: ${synthetic ? "climatological fallback (no POWER series loaded)" : "GDD from NASA POWER"}. Not a forecast.</div>
      <div class="f3d-note"><b>Model estimate, not a measurement.</b> Stage and height come from a temperature-sum model. They do not describe the actual crop in this field.</div>`;
    requestRender();
  };

  timeEl.addEventListener("input", update);
  playEl.addEventListener("click", () => {
    playing = !playing;
    playEl.textContent = playing ? "Pause" : "Play";
    if (playing) {
      playTimer = setInterval(() => {
        let v = Number(timeEl.value) + 2;
        if (v > Number(timeEl.max)) v = 0;
        timeEl.value = String(v);
        update();
      }, 90);
    } else clearInterval(playTimer);
  });
  cropEl.addEventListener("change", () => {
    activeCrop = crops.find((c) => c.id === cropEl.value) || null;
    update();
  });

  /* orbit controls */
  let drag = null;
  const el = renderer.domElement;
  el.addEventListener("pointerdown", (ev) => {
    drag = { x: ev.clientX, y: ev.clientY, btn: ev.button };
    el.setPointerCapture(ev.pointerId);
  });
  el.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.x = ev.clientX; drag.y = ev.clientY;
    if (drag.btn === 2) {
      const k = orbit.dist * 0.0012;
      const right = new THREE.Vector3().subVectors(camera.position, target).cross(camera.up).normalize();
      target.addScaledVector(right, -dx * k);
      target.y += dy * k;
    } else {
      orbit.theta -= dx * 0.006;
      orbit.phi = clamp(orbit.phi - dy * 0.005, 0.12, 1.52);
    }
    applyCamera();
    requestRender();
  });
  el.addEventListener("pointerup", () => (drag = null));
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      orbit.dist = clamp(orbit.dist * (1 + Math.sign(e.deltaY) * 0.12), Math.max(widthM, depthM) * 0.35, Math.max(widthM, depthM) * 6);
      applyCamera();
      requestRender();
    },
    { passive: false }
  );

  /* render on demand: no idle GPU loop */
  let renderRequested = false;
  let renderId = null;
  const render = () => {
    renderRequested = false;
    renderId = null;
    if (closed) return;
    // Keep the fog behind the block at any zoom level: a fixed fog range
    // swallowed the whole diorama when the camera was zoomed out.
    const camDist = camera.position.distanceTo(target);
    scene.fog.near = camDist + spanM * 0.9;
    scene.fog.far = camDist + spanM * 3.5;
    renderer.render(scene, camera);
    scaleBar();
  };
  const requestRender = () => {
    if (closed || renderRequested) return;
    renderRequested = true;
    renderId = requestAnimationFrame(render);
  };

  /* resize */
  const resize = () => {
    const r = canvasHost.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
    requestRender();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvasHost);
  resize();

  const scaleBar = () => {
    const dist = camera.position.distanceTo(target);
    const pxPerM = (canvasHost.clientHeight / 2) / (Math.tan(rad(camera.fov / 2)) * dist);
    const targetPx = 90;
    const meters = targetPx / pxPerM;
    const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].reduce((a, b) => (Math.abs(b - meters) < Math.abs(a - meters) ? b : a), 1);
    scaleEl.style.width = Math.round(nice * pxPerM) + "px";
    scaleEl.dataset.label = nice >= 1000 ? nice / 1000 + " km" : nice + " m";
  };

  update();
  if (!imagery.failed) status.textContent = "";

  cleanup = () => {
    if (renderId !== null) cancelAnimationFrame(renderId);
    clearInterval(playTimer);
    ro.disconnect();
    renderer.forceContextLoss();
    renderer.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const m = Array.isArray(o.material) ? o.material : [o.material];
        m.forEach((x) => {
          if (x.map) x.map.dispose();
          x.dispose();
        });
      }
    });
  };
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function buildDialog(field, crop, crops, season) {
  const dlg = document.createElement("dialog");
  dlg.className = "f3d-dialog";
  dlg.innerHTML = `
  <div class="f3d-shell">
    <header class="f3d-head">
      <div>
        <small>FIELD DIORAMA · OPEN SOURCE</small>
        <h2>${esc(field.name)}</h2>
      </div>
      <div class="f3d-head-right">
        <span class="f3d-pill">${esc(season)}</span>
        <button class="icon-btn" data-f3d="close" aria-label="Close">✕</button>
      </div>
    </header>
    <div class="f3d-body">
      <div id="f3d-canvas" class="f3d-canvas">
        <div class="f3d-north">N<span></span></div>
        <div id="f3d-scale" class="f3d-scale"></div>
        <div id="f3d-status" class="f3d-status"></div>
      </div>
      <aside class="f3d-side">
        <div class="f3d-side-head">FIELD STATE</div>
        <div id="f3d-hud" class="f3d-hud"></div>
      </aside>
    </div>
    <footer class="f3d-foot">
      <div class="f3d-controls">
        <label class="f3d-field"><span>Crop</span>
          <select id="f3d-crop">
            <option value=""${crop ? "" : " selected"}>Not assigned</option>
            ${crops
              .filter((c) => c.id !== "fallow")
              .map((c) => `<option value="${esc(c.id)}"${crop && c.id === crop.id ? " selected" : ""}>${esc(c.name)}</option>`)
              .join("")}
          </select>
        </label>
        <label class="f3d-field f3d-grow"><span>Date <b id="f3d-date">—</b></span>
          <input id="f3d-time" type="range" min="0" max="120" value="120">
        </label>
        <label class="f3d-check"><input type="checkbox" id="f3d-contours" checked> Contours</label>
        <label class="f3d-check"><input type="checkbox" id="f3d-plants" checked> Plants</label>
        <button class="btn small" id="f3d-play">Play</button>
      </div>
    </footer>
  </div>`;
  return dlg;
}
