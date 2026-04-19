<script setup lang="ts">
import { gsap } from 'gsap';
import { onBeforeUnmount, onMounted, ref } from 'vue';

class Vector2D {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

class Vector3D {
  constructor(
    public x: number,
    public y: number,
    public z: number,
  ) {}
}

const createSeededRandom = (seed: number) => {
  let current = seed;

  return () => {
    current = (current * 1664525 + 1013904223) % 4294967296;
    return current / 4294967296;
  };
};

class AnimationController {
  private readonly timeline: gsap.core.Timeline;
  private readonly stars: Star[];
  private time = 0;

  private readonly changeEventTime = 0.32;
  private readonly cameraZ = -400;
  private readonly cameraTravelDistance = 3400;
  private readonly startDotYOffset = 28;
  private readonly viewZoom = 100;
  private readonly trailLength = 84;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly size: { width: number; height: number; max: number },
  ) {
    const random = createSeededRandom(1234);
    const starCount = Math.round(Math.min(5600, Math.max(2600, this.size.max * 2.8)));

    this.stars = Array.from(
      { length: starCount },
      () => new Star(this.cameraZ, this.cameraTravelDistance, random),
    );

    this.timeline = gsap.timeline({ repeat: -1 });
    this.timeline.to(this, {
      time: 1,
      duration: 15,
      repeat: -1,
      ease: 'none',
      onUpdate: () => this.render(),
    });

    this.render();
  }

  public ease(p: number, g: number): number {
    if (p < 0.5) {
      return 0.5 * Math.pow(2 * p, g);
    }

    return 1 - 0.5 * Math.pow(2 * (1 - p), g);
  }

  public easeOutElastic(x: number): number {
    const c4 = (2 * Math.PI) / 4.5;

    if (x <= 0) {
      return 0;
    }

    if (x >= 1) {
      return 1;
    }

    return Math.pow(2, -8 * x) * Math.sin((x * 8 - 0.75) * c4) + 1;
  }

  public map(value: number, start1: number, stop1: number, start2: number, stop2: number): number {
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
  }

  public constrain(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  public lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
  }

  public getCameraZ(): number {
    return this.cameraZ;
  }

  public getViewZoom(): number {
    return this.viewZoom;
  }

  public spiralPath(p: number): Vector2D {
    const progress = this.ease(this.constrain(1.2 * p, 0, 1), 1.8);
    const turns = 6;
    const theta = 2 * Math.PI * turns * Math.sqrt(progress);
    const radius = Math.min(210, this.size.max * 0.17) * Math.sqrt(progress);

    return new Vector2D(
      radius * Math.cos(theta),
      radius * Math.sin(theta) + this.startDotYOffset,
    );
  }

  public rotate(v1: Vector2D, v2: Vector2D, p: number, orientation: boolean): Vector2D {
    const middle = new Vector2D((v1.x + v2.x) / 2, (v1.y + v2.y) / 2);
    const dx = v1.x - middle.x;
    const dy = v1.y - middle.y;
    const angle = Math.atan2(dy, dx);
    const direction = orientation ? -1 : 1;
    const radius = Math.sqrt(dx * dx + dy * dy);
    const bounce = Math.sin(p * Math.PI) * 0.05 * (1 - p);

    return new Vector2D(
      middle.x + radius * (1 + bounce) * Math.cos(angle + direction * Math.PI * this.easeOutElastic(p)),
      middle.y + radius * (1 + bounce) * Math.sin(angle + direction * Math.PI * this.easeOutElastic(p)),
    );
  }

  public showProjectedDot(position: Vector3D, sizeFactor: number) {
    const t2 = this.constrain(this.map(this.time, this.changeEventTime, 1, 0, 1), 0, 1);
    const nextCameraZ =
      this.cameraZ + this.ease(Math.pow(t2, 1.2), 1.8) * this.cameraTravelDistance;

    if (position.z <= nextCameraZ) {
      return;
    }

    const depth = position.z - nextCameraZ;
    const x = (this.viewZoom * position.x) / depth;
    const y = (this.viewZoom * position.y) / depth;
    const stroke = (400 * sizeFactor) / depth;

    this.ctx.lineWidth = stroke;
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.max(0.45, stroke * 0.12), 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawTrail(t1: number) {
    for (let i = 0; i < this.trailLength; i += 1) {
      const factor = this.map(i, 0, this.trailLength, 1.1, 0.1);
      const stroke = (1.3 * (1 - t1) + 3.0 * Math.sin(Math.PI * t1)) * factor;
      const pathTime = t1 - 0.00015 * i;
      const position = this.spiralPath(pathTime);
      const offset = new Vector2D(position.x + 5, position.y + 5);
      const rotated = this.rotate(
        position,
        offset,
        Math.sin(this.time * Math.PI * 2) * 0.5 + 0.5,
        i % 2 === 0,
      );

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      this.ctx.lineWidth = stroke;
      this.ctx.beginPath();
      this.ctx.arc(rotated.x, rotated.y, stroke / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawStartDot() {
    if (this.time <= this.changeEventTime) {
      return;
    }

    const dy = (this.cameraZ * this.startDotYOffset) / this.viewZoom;
    this.showProjectedDot(new Vector3D(0, dy, this.cameraTravelDistance), 2.5);
  }

  public render() {
    this.ctx.clearRect(0, 0, this.size.width, this.size.height);
    this.ctx.fillStyle = '#020408';
    this.ctx.fillRect(0, 0, this.size.width, this.size.height);

    this.ctx.save();
    this.ctx.translate(this.size.width / 2, this.size.height / 2);

    const t1 = this.constrain(this.map(this.time, 0, this.changeEventTime + 0.25, 0, 1), 0, 1);
    const t2 = this.constrain(this.map(this.time, this.changeEventTime, 1, 0, 1), 0, 1);

    this.ctx.rotate(-Math.PI * this.ease(t2, 2.7));
    this.drawTrail(t1);

    this.ctx.fillStyle = 'white';
    for (const star of this.stars) {
      star.render(t1, this);
    }

    this.drawStartDot();
    this.ctx.restore();
  }

  public destroy() {
    this.timeline.kill();
  }
}

class Star {
  private readonly dx: number;
  private readonly dy: number;
  private readonly spiralLocation: number;
  private readonly strokeWeightFactor: number;
  private readonly z: number;
  private readonly angle: number;
  private readonly distance: number;
  private readonly rotationDirection: number;
  private readonly expansionRate: number;
  private readonly finalScale: number;

  constructor(
    cameraZ: number,
    cameraTravelDistance: number,
    random: () => number,
  ) {
    this.angle = random() * Math.PI * 2;
    this.distance = 30 * random() + 15;
    this.rotationDirection = random() > 0.5 ? 1 : -1;
    this.expansionRate = 1.2 + random() * 0.8;
    this.finalScale = 0.7 + random() * 0.6;

    this.dx = this.distance * Math.cos(this.angle);
    this.dy = this.distance * Math.sin(this.angle);
    this.spiralLocation = (1 - Math.pow(1 - random(), 3.0)) / 1.3;

    const initialZ = cameraZ * 0.5 + random() * cameraTravelDistance;
    this.z = initialZ * (1 - 0.3 * this.spiralLocation) + (cameraTravelDistance / 2) * 0.3 * this.spiralLocation;
    this.strokeWeightFactor = Math.pow(random(), 2.0);
  }

  public render(progress: number, controller: AnimationController) {
    const spiralPosition = controller.spiralPath(this.spiralLocation);
    const offsetProgress = progress - this.spiralLocation;

    if (offsetProgress <= 0) {
      return;
    }

    const displacementProgress = controller.constrain(4 * offsetProgress, 0, 1);
    const linear = displacementProgress;
    const elastic = controller.easeOutElastic(displacementProgress);
    const power = Math.pow(displacementProgress, 2);

    let easing = elastic;
    if (displacementProgress < 0.3) {
      easing = controller.lerp(linear, power, displacementProgress / 0.3);
    } else if (displacementProgress < 0.7) {
      const mix = (displacementProgress - 0.3) / 0.4;
      easing = controller.lerp(power, elastic, mix);
    }

    let screenX = spiralPosition.x;
    let screenY = spiralPosition.y;

    if (displacementProgress < 0.3) {
      screenX = controller.lerp(spiralPosition.x, spiralPosition.x + this.dx * 0.3, easing / 0.3);
      screenY = controller.lerp(spiralPosition.y, spiralPosition.y + this.dy * 0.3, easing / 0.3);
    } else if (displacementProgress < 0.7) {
      const mid = (displacementProgress - 0.3) / 0.4;
      const curve = Math.sin(mid * Math.PI) * this.rotationDirection * 1.5;
      const baseX = spiralPosition.x + this.dx * 0.3;
      const baseY = spiralPosition.y + this.dy * 0.3;
      const targetX = spiralPosition.x + this.dx * 0.7;
      const targetY = spiralPosition.y + this.dy * 0.7;
      const perpX = -this.dy * 0.4 * curve;
      const perpY = this.dx * 0.4 * curve;

      screenX = controller.lerp(baseX, targetX, mid) + perpX * mid;
      screenY = controller.lerp(baseY, targetY, mid) + perpY * mid;
    } else {
      const final = (displacementProgress - 0.7) / 0.3;
      const baseX = spiralPosition.x + this.dx * 0.7;
      const baseY = spiralPosition.y + this.dy * 0.7;
      const targetDistance = this.distance * this.expansionRate * 1.5;
      const spiralTurns = 1.2 * this.rotationDirection;
      const spiralAngle = this.angle + spiralTurns * final * Math.PI;
      const targetX = spiralPosition.x + targetDistance * Math.cos(spiralAngle);
      const targetY = spiralPosition.y + targetDistance * Math.sin(spiralAngle);

      screenX = controller.lerp(baseX, targetX, final);
      screenY = controller.lerp(baseY, targetY, final);
    }

    const vx = ((this.z - controller.getCameraZ()) * screenX) / controller.getViewZoom();
    const vy = ((this.z - controller.getCameraZ()) * screenY) / controller.getViewZoom();
    const position = new Vector3D(vx, vy, this.z);

    let sizeMultiplier = 1.0;
    if (displacementProgress < 0.6) {
      sizeMultiplier = 1.0 + displacementProgress * 0.2;
    } else {
      const t = (displacementProgress - 0.6) / 0.4;
      sizeMultiplier = 1.2 * (1.0 - t) + this.finalScale * t;
    }

    controller.showProjectedDot(position, 8.5 * this.strokeWeightFactor * sizeMultiplier);
  }
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animationController: AnimationController | null = null;

const syncCanvas = () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = window.devicePixelRatio || 1;

  const nextWidth = Math.round(width * dpr);
  const nextHeight = Math.round(height * dpr);

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  animationController?.destroy();
  animationController = new AnimationController(ctx, {
    width,
    height,
    max: Math.max(width, height),
  });
};

onMounted(() => {
  syncCanvas();
  window.addEventListener('resize', syncCanvas);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncCanvas);
  animationController?.destroy();
  animationController = null;
});
</script>

<template>
  <div class="spiral-animation" aria-hidden="true">
    <canvas ref="canvasRef" class="spiral-animation__canvas" />
  </div>
</template>
