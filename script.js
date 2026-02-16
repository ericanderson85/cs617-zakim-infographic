import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const FACTS = [
  {
    text: "The Leonard P. Zakim Bunker Hill Memorial Bridge carries ten lanes of I‑93 and U.S. Route 1 across the Charles River.",
    source: "https://www.mass.gov/info-details/the-big-dig-tunnels-and-bridges",
  },
  {
    text: "The bridge is 1,432 feet long, with a 745‑foot main span and a deck width of 183 feet, making it the widest cable‑stayed bridge at the time of completion.",
    source: "https://www.mass.gov/info-details/the-big-dig-tunnels-and-bridges",
  },
  {
    text: "Fourteen elephants crossed the bridge on October 14, 2002, to demonstrate its structural strength prior to opening.",
    source: "https://www.sec.state.ma.us/mus/pdfs/tourbrochure.pdf",
  },
  {
    text: "The bridge is named for civil rights leader Leonard P. Zakim and commemorates the Battle of Bunker Hill.",
    source: "https://www.mass.gov/info-details/the-big-dig-tunnels-and-bridges",
  },
];

const CONFIG = {
  assets: {
    background: "images/no-bridge.jpg",
    subject: "images/zakim-bridge-no-bg.png",
    depth: "images/zakim-bridge-depth-map.png",
  },
  layout: {
    focusX: 0.5,
    overscan: 1.0,
  },
  effect: {
    displacementScale: 0.15,
    displacementSegments: 1024,
    parallaxIntensity: 8,
    smoothing: 0.025,
  },
  camera: {
    fov: 80,
    z: 2,
  },
};

const container = document.getElementById("container");
const viewport = document.getElementById("viewport");

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 100);
camera.position.z = CONFIG.camera.z;

const scene = new THREE.Scene();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(2, 2, 5);
scene.add(dirLight);

const loader = new THREE.TextureLoader();

async function loadAssets() {
  const [bgTex, subjectTex, depthTex] = await Promise.all([
    loader.loadAsync(CONFIG.assets.background),
    loader.loadAsync(CONFIG.assets.subject),
    loader.loadAsync(CONFIG.assets.depth),
  ]);

  bgTex.colorSpace = THREE.SRGBColorSpace;
  subjectTex.colorSpace = THREE.SRGBColorSpace;

  return { bgTex, subjectTex, depthTex };
}

const composition = new THREE.Group();
scene.add(composition);

const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
const pointerNdc = new THREE.Vector2(10, 10);
const raycaster = new THREE.Raycaster();
const tempWorld = new THREE.Vector3();
const tempNdc = new THREE.Vector3();

function createTitleTexture({ highlightZakim = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { texture: null, zakimUvBounds: null };

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "700 190px Georgia, 'Times New Roman', serif";
  const zakimText = "Zakim";
  const bridgeText = " Bridge";
  const zakimMetrics = ctx.measureText(zakimText);
  const bridgeMetrics = ctx.measureText(bridgeText);
  const totalWidth = zakimMetrics.width + bridgeMetrics.width;
  const startX = (canvas.width - totalWidth) / 2;
  const y = canvas.height / 2;

  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "rgba(245, 248, 255, 0.95)";
  ctx.fillText(zakimText, startX, y);
  ctx.fillText(bridgeText, startX + zakimMetrics.width, y);

  if (highlightZakim) {
    ctx.shadowColor = "rgba(96, 165, 250, 0.95)";
    ctx.shadowBlur = 34;
    ctx.fillStyle = "rgba(226, 240, 255, 1)";
    ctx.fillText(zakimText, startX, y);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.generateMipmaps = true;

  const ascent = zakimMetrics.actualBoundingBoxAscent || 120;
  const descent = zakimMetrics.actualBoundingBoxDescent || 45;
  const left = startX;
  const right = startX + zakimMetrics.width;
  const top = y - ascent;
  const bottom = y + descent;
  const zakimUvBounds = {
    uMin: left / canvas.width,
    uMax: right / canvas.width,
    vMin: 1 - bottom / canvas.height,
    vMax: 1 - top / canvas.height,
  };

  return { texture, zakimUvBounds };
}

(async function init() {
  const { bgTex, subjectTex, depthTex } = await loadAssets();

  const bgMat = new THREE.MeshBasicMaterial({
    map: bgTex,
  });

  const subjectMat = new THREE.MeshStandardMaterial({
    map: subjectTex,
    displacementMap: depthTex,
    displacementScale: CONFIG.effect.displacementScale,
    transparent: true,
    alphaTest: 0.01,
    roughness: 0.9,
    metalness: 0.1,
  });

  const imgAspect = bgTex.image.width / bgTex.image.height;

  const bgGeo = new THREE.PlaneGeometry(imgAspect, 1);
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.position.z = -0.1;

  const bgScale = (CONFIG.camera.z - bgMesh.position.z) / CONFIG.camera.z;
  bgMesh.scale.set(bgScale, bgScale, 1);

  const subjectGeo = new THREE.PlaneGeometry(
    imgAspect,
    1,
    CONFIG.effect.displacementSegments,
    CONFIG.effect.displacementSegments,
  );
  const subjectMesh = new THREE.Mesh(subjectGeo, subjectMat);
  subjectMesh.position.z = 0;

  const titleNormal = createTitleTexture({ highlightZakim: false });
  const titleHover = createTitleTexture({ highlightZakim: true });
  let titleMesh = null;
  let titleMat = null;
  if (titleNormal.texture && titleHover.texture) {
    const titleWidth = imgAspect * 0.82;
    const titleHeight = 0.22;
    const titleGeo = new THREE.PlaneGeometry(titleWidth, titleHeight);
    titleMat = new THREE.MeshBasicMaterial({
      map: titleNormal.texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    titleMesh = new THREE.Mesh(titleGeo, titleMat);
    titleMesh.position.set(0, 0.35, 0);
    titleMesh.renderOrder = 1;
  }

  composition.add(bgMesh);
  if (titleMesh) composition.add(titleMesh);
  composition.add(subjectMesh);

  function handleResize() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);

    const visibleHeight =
      2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const visibleWidth = visibleHeight * camera.aspect;

    let scale;
    const viewportAspect = visibleWidth / visibleHeight;

    if (imgAspect > viewportAspect) {
      scale = visibleHeight;
    } else {
      scale = visibleWidth / imgAspect;
    }

    scale *= CONFIG.layout.overscan;

    composition.scale.set(scale, scale, 1);

    const actualWidth = scale * imgAspect;

    const extraWidth = actualWidth - visibleWidth;

    const xOffset = (0.5 - CONFIG.layout.focusX) * extraWidth;

    composition.position.x = xOffset;

    composition.rotation.set(0, 0, 0);
  }

  window.addEventListener("resize", handleResize);
  handleResize();

  const facts = FACTS;
  const bubbleAnchors = [
    { x: 0.2, y: 0.33 },
    { x: 0.39, y: 0.59 },
    { x: 0.6, y: 0.72 },
    { x: 0.79, y: 0.28 },
  ];
  const bubbleColors = [
    {
      bg: "rgba(59, 130, 246, 0.8)",
      border: "rgba(96, 165, 250, 0.95)",
      glow: "rgba(59, 130, 246, 0.6)",
    },
    {
      bg: "rgba(234, 88, 12, 0.8)",
      border: "rgba(251, 146, 60, 0.95)",
      glow: "rgba(234, 88, 12, 0.6)",
    },
    {
      bg: "rgba(34, 197, 94, 0.8)",
      border: "rgba(74, 222, 128, 0.95)",
      glow: "rgba(34, 197, 94, 0.6)",
    },
    {
      bg: "rgba(168, 85, 247, 0.8)",
      border: "rgba(192, 132, 252, 0.95)",
      glow: "rgba(168, 85, 247, 0.6)",
    },
  ];
  const popupOffsets = [
    { x: -140, y: -160 },
    { x: -140, y: -180 },
    { x: -140, y: -160 },
    { x: -140, y: -160 },
  ];

  const bubblesEl = document.getElementById("bubbles");
  const popupsEl = document.getElementById("fact-popups");
  const annotations = [];
  const zakimBounds = titleNormal.zakimUvBounds;

  facts.forEach((fact, i) => {
    const isZakimFact = i === 3;
    const anchor = bubbleAnchors[i] ?? { x: 0.5, y: 0.5 };
    const popupOffset = popupOffsets[i] ?? { x: -120, y: -150 };
    const colors = bubbleColors[i] ?? bubbleColors[0];
    const bubble = document.createElement("button");
    bubble.type = "button";
    bubble.className = "bubble";
    bubble.style.left = "50%";
    bubble.style.top = "50%";
    bubble.style.setProperty("--bubble-bg", colors.bg);
    bubble.style.setProperty("--bubble-border", colors.border);
    bubble.style.setProperty("--glow", colors.glow);
    bubble.setAttribute("aria-label", `Fact ${i + 1}`);

    const popup = document.createElement("div");
    popup.className = "fact-popup";
    popup.style.left = "0px";
    popup.style.top = "0px";
    const textNode = document.createTextNode(fact.text);
    popup.appendChild(textNode);
    if (fact.source) {
      const link = document.createElement("a");
      link.href = fact.source;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = fact.source;
      popup.appendChild(document.createElement("br"));
      popup.appendChild(link);
    }
    popupsEl.appendChild(popup);
    annotations.push({ bubble, popup, anchor, popupOffset });

    if (!isZakimFact) {
      bubble.addEventListener("mouseenter", () => {
        if (!bubble.classList.contains("is-open")) {
          popup.classList.add("is-visible");
        }
      });
      bubble.addEventListener("mouseleave", () => {
        if (!bubble.classList.contains("is-open")) {
          popup.classList.remove("is-visible");
        }
      });
      bubble.addEventListener("click", (e) => {
        e.stopPropagation();
        bubble.classList.toggle("is-open");
        popup.classList.toggle(
          "is-visible",
          bubble.classList.contains("is-open"),
        );
      });
      bubblesEl.appendChild(bubble);
    }
  });

  document.addEventListener("click", (e) => {
    if (!bubblesEl.contains(e.target) && !popupsEl.contains(e.target)) {
      bubblesEl
        .querySelectorAll(".bubble.is-open")
        .forEach((b) => b.classList.remove("is-open"));
      annotations.forEach(({ popup }) => popup.classList.remove("is-visible"));
    }
  });

  viewport.addEventListener("mousemove", (e) => {
    const rect = viewport.getBoundingClientRect();
    mouse.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.targetY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    pointerNdc.set(mouse.targetX, mouse.targetY);
  });

  viewport.addEventListener("mouseleave", () => {
    mouse.targetX = 0;
    mouse.targetY = 0;
    pointerNdc.set(10, 10);
  });

  function animate() {
    requestAnimationFrame(animate);

    mouse.x += (mouse.targetX - mouse.x) * CONFIG.effect.smoothing;
    mouse.y += (mouse.targetY - mouse.y) * CONFIG.effect.smoothing;

    const rotX =
      -mouse.y * THREE.MathUtils.degToRad(CONFIG.effect.parallaxIntensity);
    const rotY =
      mouse.x * THREE.MathUtils.degToRad(CONFIG.effect.parallaxIntensity);

    subjectMesh.rotation.x = rotX;
    subjectMesh.rotation.y = rotY;

    let zakimHovered = false;
    if (titleMesh && titleMat && zakimBounds) {
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.intersectObject(titleMesh, false)[0];
      if (hit?.uv) {
        const pad = 0.015;
        zakimHovered =
          hit.uv.x >= zakimBounds.uMin - pad &&
          hit.uv.x <= zakimBounds.uMax + pad &&
          hit.uv.y >= zakimBounds.vMin - pad &&
          hit.uv.y <= zakimBounds.vMax + pad;
      }
      titleMat.map = zakimHovered ? titleHover.texture : titleNormal.texture;
      titleMat.needsUpdate = true;
      viewport.style.cursor = zakimHovered ? "pointer" : "";
    }

    const containerRect = container.getBoundingClientRect();
    for (const { bubble, popup, anchor, popupOffset } of annotations) {
      tempWorld.set((anchor.x - 0.5) * imgAspect, 0.5 - anchor.y, 0.02);
      subjectMesh.localToWorld(tempWorld);
      tempNdc.copy(tempWorld).project(camera);

      const px = (tempNdc.x * 0.5 + 0.5) * containerRect.width;
      const py = (-tempNdc.y * 0.5 + 0.5) * containerRect.height;
      bubble.style.left = `${px}px`;
      bubble.style.top = `${py}px`;

      popup.style.left = `${containerRect.left + px + popupOffset.x}px`;
      popup.style.top = `${containerRect.top + py + popupOffset.y}px`;
    }

    const fourth = annotations[3];
    if (fourth) {
      const shouldShow =
        zakimHovered ||
        fourth.bubble.classList.contains("is-open") ||
        fourth.bubble.matches(":hover");
      fourth.popup.classList.toggle("is-visible", shouldShow);
    }
    renderer.render(scene, camera);
  }

  animate();
})().catch(console.error);
