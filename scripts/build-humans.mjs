#!/usr/bin/env node
// Dev-time build of the film's human cast assets (run once; the outputs are committed).
//
//   node scripts/build-humans.mjs <quaternius-dir>
//
// <quaternius-dir> holds the two CC0 Quaternius packs, unzipped:
//   ubc/Universal Base Characters[Standard]/...   (rigged base bodies, hairstyles)
//   ual/Universal Animation Library[Standard]/... (motion-captured clips on the same skeleton)
//
// Writes compact files to skills/explain-simulate-decide/engine/assets/:
//   human-male.glb, human-female.glb  body + eyes + eyebrows on the UE-mannequin skeleton,
//                                      only POSITION/NORMAL/UV/skin attributes, 1024 px JPEG skin
//   hair.glb                           every hairstyle baked into Head-bone space (plain meshes)
//   moves.glb                          only the clips the cast uses, rotations (+ pelvis
//                                      translation), redundant keys removed
// Textures are resized with macOS `sips`. No Draco or meshopt: the page decodes with the stock
// GLTFLoader and nothing else.
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as THREE from '../skills/explain-simulate-decide/engine/vendor/three/three.module.js';

const src = resolve(process.argv[2] || '');
if (!process.argv[2] || !existsSync(join(src, 'ubc'))) {
  console.error('Usage: node scripts/build-humans.mjs <dir with ubc/ and ual/ unzipped Quaternius packs>');
  process.exit(2);
}
const UBC = join(src, 'ubc', 'Universal Base Characters[Standard]');
const UAL = join(src, 'ual', 'Universal Animation Library[Standard]', 'Unreal-Godot', 'UAL1_Standard.glb');
const BASES = join(UBC, 'Base Characters', 'Godot - UE');
const TEX = join(UBC, 'Base Characters', 'Textures');
const HAIR = join(UBC, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'explain-simulate-decide', 'engine', 'assets');
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'esd-humans-'));
const io = new NodeIO();

/** Resize an image to `px` (longest side) and re-encode it as JPEG. */
function jpeg(file, px, quality = 82) {
  const out = join(tmp, `${px}-${quality}-${file.split('/').pop().replace(/\.\w+$/, '')}.jpg`);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality), '-Z', String(px), file, '--out', out], { stdio: 'ignore' });
  return readFileSync(out);
}

// a 1x1 PNG, for texture files a .gltf names but the pack does not ship (we replace them all)
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
async function readGltf(path) {
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const resources = {};
  for (const b of json.buffers || []) resources[b.uri] = readFileSync(join(dirname(path), b.uri));
  for (const im of json.images || []) {
    const p = join(dirname(path), im.uri);
    resources[im.uri] = existsSync(p) ? readFileSync(p) : PIXEL;
  }
  return io.readJSON({ json, resources });
}

const KEEP = new Set(['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']);
function slimPrimitives(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const sem of prim.listSemantics()) if (!KEEP.has(sem)) prim.setAttribute(sem, null);
    }
  }
}

// ---- base bodies ---------------------------------------------------------------------------
async function buildBase(sex) {
  const Sex = sex[0].toUpperCase() + sex.slice(1);
  const doc = await readGltf(join(BASES, `Superhero_${Sex}_FullBody.gltf`));
  const root = doc.getRoot();
  for (const t of root.listTextures()) t.dispose();
  for (const a of root.listAnimations()) a.dispose();
  slimPrimitives(doc);
  const skinTex = doc.createTexture('skin').setImage(jpeg(join(TEX, sex === 'male' ? 'T_Superhero_Male_Ligh.png' : 'T_Superhero_Female_Light_BaseColor.png'), 1024, 80)).setMimeType('image/jpeg');
  const normalTex = doc.createTexture('skinNormal').setImage(jpeg(join(TEX, `T_Superhero_${Sex}_Normal.png`), 1024, 80)).setMimeType('image/jpeg');
  const eyeTex = doc.createTexture('eye').setImage(jpeg(join(TEX, 'T_Eye_Brown.png'), 256, 85)).setMimeType('image/jpeg');
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const mat = mesh.listPrimitives()[0].getMaterial();
    const kind = /Hair/.test(mat.getName()) ? 'Eyebrows' : /Eye/.test(mat.getName()) ? 'Eyes' : 'Body';
    node.setName(kind);
    mesh.setName(kind);
    mat.setName(kind === 'Body' ? 'skin' : kind === 'Eyes' ? 'eyes' : 'brows');
    mat.setMetallicFactor(0).setRoughnessFactor(kind === 'Eyes' ? 0.2 : 0.62).setMetallicRoughnessTexture(null).setNormalTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
    mat.setBaseColorTexture(kind === 'Body' ? skinTex : kind === 'Eyes' ? eyeTex : null);
    if (kind === 'Body') mat.setNormalTexture(normalTex);
  }
  await doc.transform(prune(), dedup());
  return write(doc, `human-${sex}.glb`);
}

// ---- hairstyles: baked into Head-bone space ------------------------------------------------
async function buildHair() {
  const out = new (await import('@gltf-transform/core')).Document();
  const buffer = out.createBuffer();
  const scene = out.createScene('hair');
  const mats = {};
  const material = (which) => {
    if (mats[which]) return mats[which];
    const tex = out.createTexture(`hair${which}`).setImage(jpeg(join(HAIR, `T_Hair_${which}_BaseColor.png`), 512, 82)).setMimeType('image/jpeg');
    const nrm = out.createTexture(`hair${which}Normal`).setImage(jpeg(join(HAIR, `T_Hair_${which}_Normal.png`), 512, 82)).setMimeType('image/jpeg');
    return (mats[which] = out.createMaterial(`hair${which}`).setBaseColorTexture(tex).setNormalTexture(nrm).setMetallicFactor(0).setRoughnessFactor(0.7));
  };
  for (const style of ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_Beard', 'Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale']) {
    const doc = await readGltf(join(HAIR, `${style}.gltf`));
    const node = doc.getRoot().listNodes().find((n) => n.getMesh() && n.getSkin());
    const skin = node.getSkin();
    const joints = skin.listJoints();
    const head = joints.findIndex((j) => j.getName() === 'Head');
    const ibm = new THREE.Matrix4().fromArray(skin.getInverseBindMatrices().getElement(head, []));
    const meshWorld = new THREE.Matrix4().fromArray(node.getWorldMatrix());
    const m = ibm.multiply(meshWorld);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const prim = node.getMesh().listPrimitives()[0];
    const pos = prim.getAttribute('POSITION');
    const nor = prim.getAttribute('NORMAL');
    const uv = prim.getAttribute('TEXCOORD_0');
    const J = prim.getAttribute('JOINTS_0');
    const W = prim.getAttribute('WEIGHTS_0');
    const P = new Float32Array(pos.getCount() * 3);
    const N = new Float32Array(pos.getCount() * 3);
    const v = new THREE.Vector3();
    let off = 0;
    for (let i = 0; i < pos.getCount(); i++) {
      const j = J.getElement(i, []);
      const w = W.getElement(i, []);
      if (!(j[0] === head && w[0] > 0.999)) off++;
      v.fromArray(pos.getElement(i, [])).applyMatrix4(m).toArray(P, i * 3);
      v.fromArray(nor.getElement(i, [])).applyMatrix3(nm).normalize().toArray(N, i * 3);
    }
    if (off) console.warn(`${style}: ${off} vertices not fully on the Head bone`);
    const which = /MI_Hair_2/.test(prim.getMaterial().getName()) ? 2 : 1;
    const p = out
      .createPrimitive()
      .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(P).setBuffer(buffer))
      .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(N).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(new Float32Array(uv.getArray())).setBuffer(buffer))
      .setIndices(out.createAccessor().setType('SCALAR').setArray(new Uint16Array(prim.getIndices().getArray())).setBuffer(buffer))
      .setMaterial(material(which));
    const name = style.replace('Hair_', '');
    scene.addChild(out.createNode(name).setMesh(out.createMesh(name).addPrimitive(p)));
  }
  return write(out, 'hair.glb');
}

// ---- motion: only the clips the cast plays -------------------------------------------------
// A clean document: the skeleton's nodes, and per clip one shared time track at the source's
// 30 fps with every bone's rotation as a normalized int16 quaternion (GLTFLoader decodes it with
// no extension). Bones keep the character's own lengths: only the pelvis translation travels
// (the bob, the sit, the crouch). Channels that never move keep a single key.
export const CLIPS = ['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Formal_Loop', 'Crouch_Idle_Loop', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Talking_Loop'];
async function buildMoves() {
  const { Document } = await import('@gltf-transform/core');
  const srcDoc = await io.read(UAL);
  const out = new Document();
  const buffer = out.createBuffer();
  const map = new Map();
  const copy = (n) => {
    const c = out.createNode(n.getName()).setTranslation(n.getTranslation()).setRotation(n.getRotation()).setScale(n.getScale());
    map.set(n, c);
    for (const ch of n.listChildren()) if (!ch.getMesh()) c.addChild(copy(ch));
    return c;
  };
  const scene = out.createScene('moves');
  for (const n of srcDoc.getRoot().listScenes()[0].listChildren()) if (!n.getMesh()) scene.addChild(copy(n));
  const acc = (type, arr, norm = false) => out.createAccessor().setType(type).setArray(arr).setNormalized(norm).setBuffer(buffer);
  for (const a of srcDoc.getRoot().listAnimations()) {
    if (!CLIPS.includes(a.getName())) continue;
    const anim = out.createAnimation(a.getName());
    let input = null;
    for (const ch of a.listChannels()) {
      const path = ch.getTargetPath();
      const node = ch.getTargetNode();
      if (path === 'scale' || (path === 'translation' && node.getName() !== 'pelvis')) continue;
      const s = ch.getSampler();
      const times = s.getInput().getArray();
      const vals = s.getOutput().getArray();
      const size = path === 'rotation' ? 4 : 3;
      if (!input) input = acc('SCALAR', new Float32Array(times));
      let still = true;
      for (let i = size; i < vals.length && still; i++) if (Math.abs(vals[i] - vals[i % size]) > 1e-4) still = false;
      const n = still ? 1 : times.length;
      let output;
      if (path === 'rotation') {
        const q = new Int16Array(n * 4);
        for (let i = 0; i < n; i++) {
          // keep successive keys in one hemisphere so linear blending never takes the long way
          let sgn = 1;
          if (i > 0) {
            let dot = 0;
            for (let c = 0; c < 4; c++) dot += vals[i * 4 + c] * (q[(i - 1) * 4 + c] / 32767);
            if (dot < 0) sgn = -1;
          }
          for (let c = 0; c < 4; c++) q[i * 4 + c] = Math.round(Math.max(-1, Math.min(1, sgn * vals[i * 4 + c])) * 32767);
        }
        output = acc('VEC4', q, true);
      } else output = acc('VEC3', new Float32Array(vals.slice(0, n * 3)));
      const sampler = out.createAnimationSampler().setInput(still ? acc('SCALAR', new Float32Array([0])) : input).setOutput(output).setInterpolation('LINEAR');
      anim.addSampler(sampler).addChannel(out.createAnimationChannel().setTargetNode(map.get(node)).setTargetPath(path).setSampler(sampler));
    }
  }
  return write(out, 'moves.glb');
}

async function write(doc, name) {
  const bytes = await io.writeBinary(doc);
  writeFileSync(join(OUT, name), bytes);
  return [name, bytes.length];
}

const sizes = [await buildBase('male'), await buildBase('female'), await buildHair(), await buildMoves()];
let total = 0;
for (const [name, n] of sizes) {
  total += n;
  console.log(`${name.padEnd(18)} ${(n / 1024).toFixed(0).padStart(6)} KB`);
}
console.log(`${'total'.padEnd(18)} ${(total / 1024).toFixed(0).padStart(6)} KB`);
