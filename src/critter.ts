import type * as THREE from "three";

// The protagonist drawn over the physics ball. Which animal it is: swap the export.
export { makeRaccoon as makeCritter } from "./raccoon.ts";

export interface CritterState {
  // The ball's rotation, how fast it spins and rises, whether the player is pushing, and the eye.
  rot: { x: number; y: number; z: number; w: number };
  spin: number;
  rise: number;
  push: boolean;
  eye: THREE.Vector3;
}
export interface Critter { mesh: THREE.Group; update(dt: number, s: CritterState): void; dispose(): void }
