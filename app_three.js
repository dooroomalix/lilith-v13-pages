import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.getElementById("heroCanvas");
const status = document.getElementById("status");
const errorBox = document.getElementById("error") || document.createElement("div");

status.textContent = "THREE STARTING";

const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setClearColor("#07080d");
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#07080d");

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, .75, 4.3);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, .45, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.32;
controls.minDistance = 1.4;
controls.maxDistance = 7.0;

scene.add(new THREE.HemisphereLight(0xffffff, 0x202035, 2.0));

const key = new THREE.DirectionalLight(0xffffff, 4.8);
key.position.set(4, 6, 5);
scene.add(key);

const fill = new THREE.DirectionalLight(0x8d6dff, 3.2);
fill.position.set(-4, 2, 4);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 2.8);
rim.position.set(0, 4, -5);
scene.add(rim);

let hero = null;

function centerAndFit(root) {
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  root.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 2.35 / maxDim;
  root.scale.setScalar(scale);
  root.position.y -= .05;
}

new GLTFLoader().load(
  "./assets/hero/lilith_character.glb?v=concept1",
  gltf => {
    hero = gltf.scene;
    centerAndFit(hero);
    scene.add(hero);
    status.textContent = "REAL LILITH GLB LOADED";
  },
  e => {
    if(e.total) status.textContent = "GLB LOADING " + Math.round(e.loaded / e.total * 100) + "%";
    else status.textContent = "GLB LOADING";
  },
  err => {
    console.error(err);
    status.textContent = "GLB LOAD FAILED";
    errorBox.textContent = String(err?.message || err);
  }
);

function resize(){
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function loop(t){
  resize();
  if(hero){
    const time = t * 0.001;
    hero.position.y = Math.sin(time * 1.4) * 0.018;
    hero.traverse(o => {
      if(!o.material) return;
      if(o.name.includes("GEM") || o.name.includes("SEAL") || o.name.includes("VIOLET")) {
        o.material.emissiveIntensity = 1.6 + Math.sin(time * 2.2) * .6;
      }
    });
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
