import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const canvas=document.getElementById("heroCanvas");
const status=document.getElementById("status");

const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setClearColor("#07080d");
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.1;

const scene=new THREE.Scene();
scene.background=new THREE.Color("#07080d");

const camera=new THREE.PerspectiveCamera(32,1,.1,100);
camera.position.set(0,1,4.2);

const controls=new OrbitControls(camera,canvas);
controls.target.set(0,.55,0);
controls.enableDamping=true;
controls.enablePan=false;
controls.autoRotate=true;
controls.autoRotateSpeed=.35;

scene.add(new THREE.HemisphereLight(0xffffff,0x202035,1.2));
const key=new THREE.DirectionalLight(0xffffff,3);
key.position.set(4,6,5);
scene.add(key);

let hero=null;

function materialize(root){
  root.traverse(o=>{
    if(!o.isMesh)return;
    const n=o.name||"";
    if(n.includes("GEM")||n.includes("EYE")||n.includes("SEAL")||n.includes("WEAPON")){
      o.material=new THREE.MeshStandardMaterial({color:"#9364FF",emissive:"#6D31FF",emissiveIntensity:1.8});
    }else if(n.includes("GOLD")){
      o.material=new THREE.MeshStandardMaterial({color:"#A67C32",metalness:1,roughness:.25});
    }else if(n.includes("ARMOR")){
      o.material=new THREE.MeshStandardMaterial({color:"#111214",metalness:.95,roughness:.18});
    }else if(n.includes("HAIR")){
      o.material=new THREE.MeshStandardMaterial({color:"#ECEDEF",side:THREE.DoubleSide});
    }else{
      o.material=new THREE.MeshStandardMaterial({color:"#F2E5DF",roughness:.52});
    }
  });
}

new GLTFLoader().load(
  "./assets/hero/lilith_character.glb",
  gltf=>{
    hero=gltf.scene;
    materialize(hero);
    scene.add(hero);
    status.textContent="REAL GLB LOADED";
  },
  e=>{
    if(e.total)status.textContent="GLB LOADING "+Math.round(e.loaded/e.total*100)+"%";
    else status.textContent="GLB LOADING";
  },
  err=>{
    console.error(err);
    status.textContent="GLB LOAD FAILED";
  }
);

function resize(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
}

function loop(t){
  resize();
  if(hero){
    const time=t*.001;
    hero.position.y=Math.sin(time*1.4)*.018;
  }
  controls.update();
  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
