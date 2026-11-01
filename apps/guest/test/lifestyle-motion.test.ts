import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comfortPose, comfortTransform } from '../src/lib/lifestyle-motion.ts';

test('overscroll is bounded and all four photos settle front-facing before release', () => {
  for (let index = 0; index < 4; index++) {
    assert.deepEqual(comfortPose(-1, index), comfortPose(0, index));
    assert.deepEqual(comfortPose(2, index), comfortPose(1, index));
    const settled = comfortPose(.9, index);
    assert.equal(Math.abs(settled.rotateY), 0);
    assert.equal(Math.abs(settled.rotateX), 0);
    assert.ok(Math.abs(settled.rotateZ) <= 3);
    assert.ok(Math.abs(settled.x) < .001 && Math.abs(settled.y) < .001);
  }
});

test('each staggered flight reveals its back and is identical when scrolling backwards', () => {
  const samples = Array.from({ length: 101 }, (_, index) => index / 100);
  const edgeCrossings: number[] = [];
  for (let card = 0; card < 4; card++) {
    const poses = samples.map(progress => comfortPose(progress, card));
    assert.ok(poses.some(pose => Math.abs(pose.rotateY) > 95 && Math.abs(pose.rotateY) < 265));
    edgeCrossings.push(poses.findIndex(pose => Math.abs(pose.rotateY) < 270));
    const forward = samples.map(progress => comfortTransform(progress, card));
    const backward = [...samples].reverse().map(progress => comfortTransform(progress, card)).reverse();
    assert.deepEqual(backward, forward);
  }
  assert.equal(new Set(edgeCrossings).size, 4);
});
