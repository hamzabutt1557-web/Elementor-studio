import test from "node:test";
import assert from "node:assert/strict";
import { BuildCapacity, CapacityError } from "../lib/build-capacity";
test("burst traffic stays bounded, FIFO and releases slots exactly once", async () => {
  const capacity = new BuildCapacity(2, 3, 1000);
  const signal = new AbortController().signal;
  const first = await capacity.acquire(signal), second = await capacity.acquire(signal);
  const order: number[] = [];
  const queued = [0,1,2].map(i => capacity.acquire(signal).then(release => { order.push(i); return release; }));
  await assert.rejects(capacity.acquire(signal), CapacityError);
  assert.deepEqual(capacity.snapshot, { active: 2, waiting: 3, limit: 2 });
  first(); first();
  const third = await queued[0]; second(); const fourth = await queued[1];
  third(); const fifth = await queued[2]; fourth(); fifth();
  assert.deepEqual(order, [0,1,2]);
  assert.equal(capacity.snapshot.active, 0);
});
test("cancelled queued work never starts and does not block the next caller", async () => {
  const capacity = new BuildCapacity(1, 2);
  const owner = await capacity.acquire(new AbortController().signal);
  const controller = new AbortController();
  const pending = capacity.acquire(controller.signal);
  controller.abort(new Error("Stopped"));
  await assert.rejects(pending, /Stopped/);
  owner();
  const release = await capacity.acquire(new AbortController().signal);
  release();
  assert.equal(capacity.snapshot.waiting, 0);
});
test("queue deadline rejects without releasing a running job", async () => {
  const capacity = new BuildCapacity(1, 1, 10);
  const release = await capacity.acquire(new AbortController().signal);
  await assert.rejects(capacity.acquire(new AbortController().signal), CapacityError);
  assert.equal(capacity.snapshot.active, 1);
  release();
});
test("100 callers complete without exceeding two active conversions", async () => {
  const capacity = new BuildCapacity(2, 100, 2000);
  let running = 0, peak = 0;
  await Promise.all(Array.from({length:100}, async () => {
    const release = await capacity.acquire(new AbortController().signal);
    try { running++; peak = Math.max(peak,running); await new Promise(r=>setTimeout(r,1)); }
    finally { running--; release(); }
  }));
  assert.equal(peak,2);
  assert.equal(capacity.snapshot.active,0);
});
