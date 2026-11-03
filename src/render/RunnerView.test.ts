import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CharacterModel } from './CharacterModel';
import { RunnerView } from './RunnerView';

function fakeModel(): CharacterModel {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1.9, 1)));
  return new CharacterModel(scene, [new THREE.AnimationClip('run', 0.63, [])]);
}

describe('RunnerView character', () => {
  it('only ever holds one character model, however often one is set', () => {
    const view = new RunnerView(new THREE.BoxGeometry(1, 1, 1));
    const a = fakeModel();
    const b = fakeModel();
    view.setModel(a);
    view.setModel(b);
    view.setModel(b);
    const models: THREE.Object3D[] = [];
    view.group.traverse((c) => {
      if (c === a.root || c === b.root) models.push(c);
    });
    expect(models).toEqual([b.root]);
    expect(view.hasModel).toBe(true);
  });

  it('scales the character to the physics height', () => {
    const m = fakeModel();
    const box = new THREE.Box3().setFromObject(m.root);
    expect(box.max.y - box.min.y).toBeCloseTo(1.6, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
  });
});
