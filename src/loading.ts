import * as THREE from "three";
import { LEVELS } from "./levels/index.ts";
import { BALL_RADIUS } from "./level.ts";
import { buildLevel, createScene, initMaterials, makeBall } from "./scene.ts";
import { createSim, initPhysics } from "./sim.ts";
import { GlassTitle } from "./title.ts";
import { h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

// Lets the status paint; a hidden tab never gets a frame, so a timer keeps loading moving.
const nextFrame = () => new Promise<void>((r) => { requestAnimationFrame(() => r()); setTimeout(r, 120); });

// Boot screen: does the slow one-off work (physics WASM, textures, shader compiles,
// a first level build) up front so the menu and the first level start without a hitch.
export class Loading implements Mode {
  private ctx: Ctx;
  private status = h("div", { class: "status" });
  private bar = h("div", { class: "fill" });
  private cancelled = false;

  constructor(ctx: Ctx, onDone: () => void) {
    this.ctx = ctx;
    ctx.overlay.append(
      h("div", { class: "loading" },
        h("div", { class: "bar" }, this.bar),
        this.status,
      ),
    );
    void this.run().then(() => { if (!this.cancelled) onDone(); });
  }

  private async step(i: number, n: number, label: string) {
    this.status.textContent = label;
    this.bar.style.width = `${Math.round((i / n) * 100)}%`;
    await nextFrame();
  }

  private async run() {
    const { renderer, canvas } = this.ctx;
    const n = 4;
    await this.step(0, n, "Painting textures");
    initMaterials(renderer);
    await this.step(1, n, "Starting physics");
    await initPhysics();
    await this.step(2, n, "Compiling shaders");
    renderer.setSize(innerWidth, innerHeight, false);
    const level = LEVELS[0]!;
    const env = createScene();
    const built = buildLevel(level, false);
    const ball = makeBall();
    ball.mesh.position.set(level.pieces[0]!.x, BALL_RADIUS, level.pieces[0]!.z);
    env.scene.add(built.group, ball.mesh);
    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    camera.position.set(4, 3, 6);
    camera.lookAt(0, 0, 0);
    env.scene.add(camera);
    const title = new GlassTitle(renderer, camera, h("div"), "OXARE");
    env.tick(camera);
    renderer.compile(env.scene, camera);
    // A real frame plus one reflection pass hits the shadow and cube-camera variants compile() skips.
    ball.reflect(renderer, env);
    env.render(renderer, camera);
    ball.dispose();
    title.dispose();
    await this.step(3, n, "Building the first level");
    const sim = await createSim(level);
    sim.free();
    await this.step(4, n, "Ready");
  }

  dispose() {
    this.cancelled = true;
    this.ctx.overlay.replaceChildren();
  }
}
