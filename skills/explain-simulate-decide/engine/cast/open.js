// Open-library actors: CC0 glTF/GLB models (e.g. Kenney, Poly Pizza), normalised
// to stage size. Credits travel with the actor into the Decide panel.
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';
import { group, lerp, THREE } from './kit.js';

export default async function build({ url, credit }) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = Math.min(2.6 / Math.max(size.y, 0.01), 2.4 / Math.max(size.x, size.z, 0.01));
  model.scale.setScalar(s);
  const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
  model.position.set(-centre.x, -box.min.y * s, -centre.z);
  const mats = [];
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.receiveShadow = true;
      if (o.material && 'emissiveIntensity' in o.material) {
        o.material = o.material.clone();
        o.material.emissive = o.material.color?.clone?.() || new THREE.Color('#fff');
        mats.push(o.material);
      }
    }
  });
  const object = group();
  object.add(model);
  return {
    object,
    height: size.y * s,
    credit,
    setValue(v) {
      object.scale.setScalar(lerp(0.88, 1.1, v));
      for (const m of mats) m.emissiveIntensity = lerp(0, 0.2, v);
    },
  };
}
