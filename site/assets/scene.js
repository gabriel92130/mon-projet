/* GS HORIZON — expérience 3D « Vers l'horizon »
   Voiture de sport originale modélisée en code (Three.js), pilotée par le défilement.
   Chapitres : 0 intro · 1 inspection (scan laser) · 2 garantie · 3 en route · 4 lever de soleil */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const root = document.documentElement;
const section = document.getElementById('xp');
const canvas = document.getElementById('xp-canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (section && canvas && !reduced) {
  try { start(); } catch (err) { console.warn('[GSH] 3D indisponible', err); root.classList.remove('xp-live'); }
}

function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const mobile = innerWidth < 760;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  root.classList.add('xp-live');

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a1020, 16, 70);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 500);

  const pmrem = new THREE.PMREMGenerator(renderer);
  // Environnement studio : bandes lumineuses fines → reflets en lignes sur la carrosserie
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0b0e18, side: THREE.BackSide })));
  const strip = (w, h, x, y, z, ry, rx, c) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c, c, c * 1.05), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); envScene.add(m);
  };
  strip(26, 0.25, 0, 7, -6, 0, Math.PI / 2.6, 2.2);
  strip(26, 0.25, 0, 7, 6, 0, -Math.PI / 2.6, 2.2);
  strip(26, 0.12, 0, 9, 0, 0, Math.PI / 2, 1.2);
  const horizonBand = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 1.2, 48, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.3, 0.55), side: THREE.BackSide }));
  envScene.add(horizonBand);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;

  /* ---------- Ciel (dégradé, soleil, étoiles) ---------- */
  const sunDir = new THREE.Vector3(1, -0.1, 0).normalize();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(200, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uDay: { value: 0 }, uSun: { value: sunDir }, uTime: { value: 0 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `
        uniform float uDay; uniform vec3 uSun; uniform float uTime; varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir); float h = d.y;
          vec3 top = mix(vec3(.004,.006,.02), vec3(.05,.07,.2), uDay);
          vec3 hor = mix(vec3(.02,.04,.11), vec3(.62,.2,.05), uDay);
          vec3 col = mix(hor, top, smoothstep(-.02, .42, h));
          float s = max(dot(d, uSun), 0.);
          col += vec3(1.,.5,.1) * pow(s, 10.) * .35 * uDay;
          col += vec3(1.4,1.05,.25) * smoothstep(.9975, .999, s) * 1.6 * uDay;
          vec3 g = floor(d * 260.);
          float st = step(.9982, hash(g)) * smoothstep(.04, .3, h) * (1. - uDay);
          col += st * (.55 + .45 * sin(uTime * 2. + hash(g) * 40.));
          gl_FragColor = vec4(col, 1.);
        }`,
    }),
  );
  scene.add(sky);

  /* ---------- Sol miroir ---------- */
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(90, 72),
    new THREE.MeshStandardMaterial({ color: 0x07090f, roughness: 0.48, metalness: 0.3, transparent: true, opacity: 0.88 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Marquages de route (défilent quand la voiture roule)
  const dashGeo = new THREE.PlaneGeometry(1.4, 0.07); dashGeo.rotateX(-Math.PI / 2);
  const dashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.35), transparent: true, opacity: 0, toneMapped: false });
  const DASHES = 36, SPACING = 3.2;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, DASHES * 2);
  dashes.position.y = 0.005;
  scene.add(dashes);
  const dummy = new THREE.Object3D();

  /* ---------- Lumières ---------- */
  const hemi = new THREE.HemisphereLight(0x8fa4ff, 0x0a0a10, 0.22);
  const sun = new THREE.DirectionalLight(0xffb15a, 0);
  sun.position.set(40, 6, 0);
  const rim = new THREE.DirectionalLight(0x7f9bff, 2.2);
  rim.position.set(-6, 5, -7);
  scene.add(hemi, sun, rim);

  /* ---------- Voiture ---------- */
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x1d4fb8, metalness: 0.6, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x05070c, metalness: 0.7, roughness: 0.16, clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 0.45 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0.3, roughness: 0.6 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.92 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb9bdc6, metalness: 1, roughness: 0.22, envMapIntensity: 1.2 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.4, roughness: 0.4 });
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false });
  const wireMat = new THREE.LineBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.6 });

  // Sécurité : borne la luminance des matériaux (évite les pixels infinis/NaN que le halo transforme en carrés)
  const safe = (m, cap = 4) => {
    m.customProgramCacheKey = () => 'safe-' + cap;
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if (any(isnan(gl_FragColor.rgb)) || any(isinf(gl_FragColor.rgb))) gl_FragColor.rgb = vec3(0.0);
        gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(${cap.toFixed(1)}));`);
    };
  };
  [paint, trim, tireMat, rimMat, caliperMat].forEach((m) => safe(m));
  safe(glass, 0.45);

  // Plans de découpe pour le scan : la carrosserie disparaît dans la bande, le filaire apparaît
  const cutA = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 99);
  const cutB = new THREE.Plane(new THREE.Vector3(1, 0, 0), -99);
  const wireA = new THREE.Plane(new THREE.Vector3(1, 0, 0), -99);
  const wireB = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 99);
  [paint, glass, trim].forEach((m) => { m.clippingPlanes = [cutA, cutB]; m.clipIntersection = true; });
  wireMat.clippingPlanes = [wireA, wireB];
  const setBand = (a, b) => { cutA.constant = a; cutB.constant = -b; wireA.constant = -a; wireB.constant = b; };

  // Normales invalides (NaN) → pixels NaN que le halo transforme en carrés blancs : on les neutralise
  function clean(g) {
    g.computeVertexNormals();
    const n = g.attributes.normal.array;
    for (let k = 0; k < n.length; k += 3) {
      if (!Number.isFinite(n[k]) || !Number.isFinite(n[k + 1]) || !Number.isFinite(n[k + 2]) || (n[k] === 0 && n[k + 1] === 0 && n[k + 2] === 0)) { n[k] = 0; n[k + 1] = 1; n[k + 2] = 0; }
    }
    return g;
  }
  // Silhouette compacte sportive inspirée d'une 308 GT Line (4,37 m × 1,85 m × 1,44 m, empattement 2,68 m).
  // Évocation stylisée, sans logo ni marque.
  function bodyGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-1.98, 0.33);
    s.lineTo(-1.88, 0.33);
    s.absarc(-1.34, 0.35, 0.54, Math.PI, 0, true);
    s.lineTo(0.8, 0.33);
    s.absarc(1.34, 0.35, 0.54, Math.PI, 0, true);
    s.lineTo(1.98, 0.33);
    s.bezierCurveTo(2.1, 0.33, 2.13, 0.42, 2.12, 0.52);      // bouclier avant
    s.bezierCurveTo(2.11, 0.62, 2.06, 0.68, 1.95, 0.71);     // nez
    s.bezierCurveTo(1.5, 0.78, 1.05, 0.84, 0.7, 0.88);       // long capot
    s.bezierCurveTo(0.0, 0.9, -1.0, 0.95, -1.62, 1.02);      // ligne de caisse qui remonte
    s.bezierCurveTo(-1.82, 1.04, -1.95, 1.0, -1.99, 0.9);    // haut du hayon
    s.bezierCurveTo(-2.03, 0.78, -2.04, 0.62, -2.02, 0.5);   // hayon presque vertical
    s.bezierCurveTo(-2.0, 0.4, -1.99, 0.36, -1.985, 0.335);
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.52, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.14, bevelSegments: 8, curveSegments: 40 });
    g.translate(0, 0, -0.76);
    return clean(g);
  }
  function cabinGeometry() {
    const s = new THREE.Shape();
    s.moveTo(0.78, 0.84);
    s.bezierCurveTo(0.45, 1.05, 0.15, 1.26, -0.12, 1.31);    // pare-brise incliné
    s.bezierCurveTo(-0.5, 1.36, -1.0, 1.35, -1.38, 1.27);    // pavillon
    s.bezierCurveTo(-1.6, 1.21, -1.78, 1.08, -1.88, 0.96);   // lunette arrière fuyante
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.14, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 7, curveSegments: 32 });
    g.translate(0, 0, -0.57);
    return clean(g);
  }
  const bodyGeo = bodyGeometry();
  const cabinGeo = cabinGeometry();
  const bodyWire = new THREE.WireframeGeometry(bodyGeo);
  const cabinWire = new THREE.EdgesGeometry(cabinGeo, 20);
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x030304, metalness: 0.5, roughness: 0.18, clearcoat: 1, envMapIntensity: 0.9 });
  const rimDark = new THREE.MeshStandardMaterial({ color: 0x1a1b1f, metalness: 0.8, roughness: 0.35 });
  safe(gloss); safe(rimDark);
  gloss.clippingPlanes = [cutA, cutB]; gloss.clipIntersection = true;

  const box = (w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    return m;
  };

  // Jante bi-ton diamantée, 5 doubles branches
  function wheel() {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 48), tireMat);
    tire.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.25, 40), rimDark);
    rim.rotation.x = Math.PI / 2;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.012, 8, 48), rimMat);
    lip.position.z = 0.125;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.27, 20), rimMat);
    cap.rotation.x = Math.PI / 2;
    w.add(tire, rim, lip, cap);
    for (let i = 0; i < 5; i++) {
      for (const o of [-0.13, 0.13]) {
        const spoke = box(0.2, 0.035, 0.03, rimMat, 0, 0, 0.12);
        const a = (i / 5) * Math.PI * 2 + o;
        spoke.position.set(Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.12);
        spoke.rotation.z = a;
        w.add(spoke);
      }
    }
    const spin = new THREE.Group(); spin.add(w);
    const caliper = box(0.11, 0.15, 0.06, caliperMat, 0.14, 0.08, 0.07);
    const holder = new THREE.Group(); holder.add(spin, caliper);
    return { holder, spin };
  }

  function buildCar(withWire) {
    const car = new THREE.Group();
    car.add(new THREE.Mesh(bodyGeo, paint));
    car.add(new THREE.Mesh(cabinGeo, glass));
    car.add(box(3.6, 0.07, 1.62, trim, 0, 0.2, 0));                              // bas de caisse
    car.add(box(0.3, 0.03, 1.26, gloss, -1.5, 1.42, 0, 0, 0, 0.12));            // becquet
    [-1, 1].forEach((side) => {
      car.add(box(0.16, 0.09, 0.12, gloss, 0.62, 0.98, side * 0.86));           // rétroviseurs noirs
      // Avant : phare effilé + « griffe » lumineuse verticale qui descend dans le bouclier
      car.add(box(0.05, 0.045, 0.42, headMat, 2.21, 0.665, side * 0.55, 0, side * 0.32, 0));
      car.add(box(0.05, 0.3, 0.045, headMat, 2.255, 0.46, side * 0.7, side * 0.25, side * 0.42, 0));
      // Arrière : trois griffes rouges de chaque côté
      for (let k = 0; k < 3; k++) {
        car.add(box(0.03, 0.12, 0.028, tailMat, -2.185, 0.82, side * (0.5 + k * 0.1), side * 0.35, 0, 0));
      }
    });
    car.add(box(0.04, 0.22, 0.95, gloss, 2.255, 0.47, 0));                       // calandre sans cadre
    car.add(box(0.04, 0.07, 1.2, trim, 2.24, 0.33, 0));                          // entrée d'air basse
    car.add(box(0.04, 0.14, 1.5, gloss, -2.165, 0.82, 0));                       // bandeau noir arrière
    car.add(box(0.02, 0.012, 0.9, tailMat, -2.19, 0.775, 0));                    // filet lumineux
    const spins = [];
    [[1.34, 1], [1.34, -1], [-1.34, 1], [-1.34, -1]].forEach(([x, side]) => {
      const { holder, spin } = wheel();
      holder.position.set(x, 0.34, side * 0.78);
      if (side < 0) holder.rotation.y = Math.PI;
      car.add(holder);
      spins.push({ spin, side });
    });
    if (withWire) {
      car.add(new THREE.LineSegments(bodyWire, wireMat));
      car.add(new THREE.LineSegments(cabinWire, wireMat));
    }
    return { car, spins };
  }

  const main = buildCar(true);
  const mirror = buildCar(false);
  mirror.car.scale.y = -1;
  scene.add(main.car, mirror.car);
  const allSpins = [...main.spins, ...mirror.spins];

  // Faisceaux des phares
  const beams = [-1, 1].map((side) => {
    const l = new THREE.SpotLight(0xfff0d6, 0, 30, 0.42, 0.7, 1.4);
    l.position.set(2.2, 0.66, side * 0.55);
    l.target.position.set(10, 0, side * 1.2);
    scene.add(l, l.target);
    return l;
  });
  const tailGlow = new THREE.PointLight(0xff2a1a, 0, 6, 2);
  tailGlow.position.set(-2.6, 0.8, 0);
  scene.add(tailGlow);

  // Barre laser du scan
  const laser = new THREE.Group();
  const laserCore = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.9, 2.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.3, 0.3), toneMapped: false }));
  const laserSheet = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9), new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  laserSheet.rotation.y = Math.PI / 2;
  laser.add(laserCore, laserSheet);
  laser.position.y = 0.85;
  laser.visible = false;
  scene.add(laser);

  /* ---------- Post-traitement (halo lumineux) ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.42, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /* ---------- Caméra : une position par chapitre ---------- */
  const KEYS = [
    { p: [5.6, 1.05, 4.9], t: [0.2, 0.6, 0] },     // 0 intro, 3/4 avant
    { p: [0.4, 1.35, 7.4], t: [0, 0.65, 0] },      // 1 inspection, profil
    { p: [-5.4, 2.5, 4.6], t: [0, 0.6, 0] },       // 2 garantie, 3/4 arrière
    { p: [-7.6, 1.25, 1.2], t: [6, 0.9, 0] },      // 3 en route, caméra de poursuite
    { p: [-10.5, 2.3, 4.2], t: [18, 1.6, 0] },     // 4 lever de soleil
  ];
  const v3 = (a) => new THREE.Vector3(...a);
  const keyP = KEYS.map((k) => v3(k.p));
  const keyT = KEYS.map((k) => v3(k.t));
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  const ease = (x) => x * x * (3 - 2 * x);
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const band = (x, a, b) => clamp01((x - a) / (b - a));

  /* ---------- Interface superposée ---------- */
  const chaps = [...section.querySelectorAll('[data-chap]')];
  const rail = [...section.querySelectorAll('[data-rail]')];
  const callouts = [...section.querySelectorAll('[data-anchor]')].map((el) => ({ el, v: v3(el.dataset.anchor.split(',').map(Number)) }));
  const speedEl = section.querySelector('#xp-speed');
  const gaugeEl = section.querySelector('#xp-gauge');
  const tmp = new THREE.Vector3();

  rail.forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.rail);
    const r = section.getBoundingClientRect();
    const total = section.offsetHeight - innerHeight;
    scrollTo({ top: scrollY + r.top + total * (i / (KEYS.length - 1)) + 2, behavior: 'smooth' });
  }));

  // Teintes de carrosserie
  const targetPaint = new THREE.Color(0x1d4fb8);
  section.querySelectorAll('[data-paint]').forEach((b) => b.addEventListener('click', () => {
    targetPaint.set(b.dataset.paint);
    section.querySelectorAll('[data-paint]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const label = section.querySelector('#xp-paint-name'); if (label) label.textContent = b.getAttribute('aria-label');
  }));

  // Pointeur : léger parallaxe
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => { pointer.x = e.clientX / innerWidth - 0.5; pointer.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  /* ---------- Boucle ---------- */
  const state = { p: 0, travel: 0, spin: 0 };
  const clock = new THREE.Clock();
  let introStart = performance.now();
  let visible = true, activeChap = -1;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) clock.getDelta(); }, { rootMargin: '100px' }).observe(section);

  const scrollProgress = () => {
    const r = section.getBoundingClientRect();
    return clamp01(-r.top / (section.offsetHeight - innerHeight || 1));
  };

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    state.p += (scrollProgress() - state.p) * (1 - Math.exp(-dt * 5));
    const p = state.p;
    const intro = clamp01((performance.now() - introStart) / 2600);

    // Phares : extinction → double flash → allumage
    const ms = performance.now() - introStart;
    let head = ms < 450 ? 0 : ms < 560 ? 1 : ms < 700 ? 0.08 : ms < 820 ? 1 : 1;
    head *= 1 - band(p, 0.82, 1) * 0.5;
    headMat.color.setRGB(3.2 * head, 3.1 * head, 2.7 * head);

    // Nuit → lever du soleil
    const day = ease(band(p, 0.62, 1));
    beams.forEach((b) => { b.intensity = 45 * head * (1 - day * 0.8); });
    sky.material.uniforms.uDay.value = day;
    sky.material.uniforms.uTime.value = time;
    sunDir.set(1, -0.09 + day * 0.15, 0).normalize();
    const hor = new THREE.Color().setRGB(0.02 + day * 0.6, 0.04 + day * 0.16, 0.11 - day * 0.06);
    scene.fog.color.copy(hor);
    sun.intensity = day * 1.1;
    hemi.intensity = 0.22 + day * 0.5;
    paint.envMapIntensity = 1.3 + day * 0.3;
    rim.intensity = 2.2 * (1 - day * 0.6);

    // Feux arrière : s'allument au chapitre « garantie »
    const tail = 0.25 + band(p, 0.36, 0.5) * 0.75;
    tailMat.color.setRGB(3 * tail, 0.12 * tail, 0.07 * tail);
    tailGlow.intensity = 6 * tail;

    // Scan laser (chapitre 1)
    const scan = band(p, 0.12, 0.36);
    if (scan > 0 && scan < 1) {
      const x = 2.9 - scan * 5.8;
      setBand(x, x + 1.6);
      laser.visible = true; laser.position.x = x;
    } else { setBand(99, 99); laser.visible = false; }

    // Route : la voiture roule
    const speed = band(p, 0.6, 0.78) * (1 - band(p, 0.93, 1) * 0.6);
    state.travel += speed * dt * 24;
    state.spin += speed * dt * 24 / 0.36;
    allSpins.forEach(({ spin, side }) => { spin.rotation.z = -state.spin * side; });
    dashMat.opacity = 0.15 + speed * 0.7;
    for (let i = 0; i < DASHES; i++) {
      const x = ((i * SPACING - state.travel) % (DASHES * SPACING) + DASHES * SPACING) % (DASHES * SPACING) - 30;
      [-1.75, 1.75].forEach((z, k) => { dummy.position.set(x, 0, z); dummy.updateMatrix(); dashes.setMatrixAt(i * 2 + k, dummy.matrix); });
    }
    dashes.instanceMatrix.needsUpdate = true;
    const bob = Math.sin(time * 22) * 0.004 * speed;
    main.car.position.y = bob; mirror.car.position.y = -bob;

    // Caméra
    const seg = Math.min(p * (KEYS.length - 1), KEYS.length - 1.0001);
    const i = Math.floor(seg), f = ease(seg - i);
    camPos.lerpVectors(keyP[i], keyP[i + 1], f);
    camTgt.lerpVectors(keyT[i], keyT[i + 1], f);
    const aspect = camera.aspect;
    const zoom = aspect < 1 ? 1 + (1 - aspect) * 1.25 : 1;
    camPos.sub(camTgt).multiplyScalar(zoom * (1 + (1 - ease(intro)) * 1.4)).add(camTgt);
    pointer.sx += (pointer.x - pointer.sx) * dt * 3; pointer.sy += (pointer.y - pointer.sy) * dt * 3;
    camPos.x += pointer.sx * 0.6; camPos.y += -pointer.sy * 0.3 + Math.sin(time * 0.6) * 0.04;
    camPos.y += Math.sin(time * 31) * 0.006 * speed;
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    // Cadrage : la voiture se place à l'opposé du texte (desktop) ou au-dessus (mobile)
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const wide = W > 860;
    const shifts = wide ? [-0.13, -0.16, 0.17, -0.16, 0] : [0, 0, 0, 0, 0];
    const lifts = wide ? [0, 0, 0, 0, 0] : [0.1, 0.17, 0.17, 0.12, -0.1];
    const sh = shifts[i] + (shifts[i + 1] - shifts[i]) * f;
    const li = lifts[i] + (lifts[i + 1] - lifts[i]) * f;
    camera.setViewOffset(W, H, sh * W, li * H, W, H);

    paint.color.lerp(targetPaint, 1 - Math.exp(-dt * 4));
    bloom.strength = 0.7 + (1 - intro) * 0.6;

    composer.render();

    // Interface
    const chap = Math.round(p * (KEYS.length - 1));
    if (chap !== activeChap && intro > 0.55) {
      activeChap = chap;
      chaps.forEach((c) => c.classList.toggle('is-on', Number(c.dataset.chap) === chap));
      rail.forEach((b) => b.setAttribute('aria-current', Number(b.dataset.rail) === chap ? 'step' : 'false'));
    }
    const calloutOn = scan > 0.05 && p < 0.4;
    callouts.forEach(({ el, v }, k) => {
      const on = calloutOn && scan > 0.15 + k * 0.17;
      tmp.copy(v).project(camera);
      const sx = (tmp.x * 0.5 + 0.5) * canvas.clientWidth;
      const sy = (-tmp.y * 0.5 + 0.5) * canvas.clientHeight;
      el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      el.classList.toggle('is-on', on && tmp.z < 1);
    });
    if (speedEl) {
      const kmh = Math.round(speed * 130 + Math.sin(time * 3) * speed * 2);
      speedEl.textContent = String(Math.max(0, kmh));
      gaugeEl.style.strokeDashoffset = String(251 - 251 * 0.75 * speed);
    }
  }
  requestAnimationFrame(frame);
  setTimeout(() => root.classList.add('xp-intro-done'), 1500);
}
