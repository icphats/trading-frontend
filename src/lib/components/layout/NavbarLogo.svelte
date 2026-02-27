<script lang="ts">
  let logoEl: HTMLElement | undefined = $state();
  let isHovering = $state(false);
  let rotation = $state(0);
  let speed = $state(0);
  let phase: 'idle' | 'spinning' | 'rolling' | 'returning' = $state('idle');
  let position = $state({ x: 0, y: 0 });
  let velocity = { x: 0, y: 0 };
  let originalRect: DOMRect | null = $state(null);
  let animationFrame: number | null = null;
  let bounceCount = 0;

  // Party trail - store velocity with each point for direction
  type TrailPoint = { x: number; y: number; vx: number; vy: number; time: number };
  let trail = $state<TrailPoint[]>([]);
  const TRAIL_LIFETIME = 1200; // ms
  const TRAIL_COLORS = ['#1A35D3', '#43CEFF', '#592683', '#EC1E79', '#F05A24', '#FABD3B'];
  const GRADIENT = `linear-gradient(to right, ${TRAIL_COLORS.join(', ')})`;

  const SPEED_INCREMENT = 0.09;
  const MAX_SPIN_SPEED = 50;
  const GRAVITY = 0.5;
  const BOUNCINESS = 0.9;
  const FRICTION = 0.998;
  const MIN_BOUNCES = 12;

  function startAnimation() {
    if (animationFrame) return;

    const animate = () => {
      const now = Date.now();

      if (phase === 'spinning') {
        if (!isHovering) {
          // Smoothly decelerate when mouse leaves during spin
          speed *= 0.96;
          rotation += speed;

          // Ease rotation back to 0
          const normalizedRotation = ((rotation % 360) + 360) % 360;
          const targetRotation = normalizedRotation > 180 ? 360 : 0;
          const rotationDiff = targetRotation - normalizedRotation;
          rotation = normalizedRotation + rotationDiff * 0.08;

          if (speed < 0.5 && Math.abs(rotationDiff) < 2) {
            phase = 'idle';
            speed = 0;
            rotation = 0;
            animationFrame = null;
            return;
          }
        } else {
          speed += SPEED_INCREMENT;
          rotation += speed;

          if (speed >= MAX_SPIN_SPEED) {
            phase = 'rolling';
            if (logoEl) {
              originalRect = logoEl.getBoundingClientRect();
            }
            // Launch forward (right) with upward velocity
            velocity = {
              x: 12 + Math.random() * 5,
              y: -14
            };
            bounceCount = 0;
            trail = [];
          }
        }
      } else if (phase === 'rolling') {
        // Apply gravity
        velocity.y += GRAVITY;

        // Apply friction to horizontal movement
        velocity.x *= FRICTION;

        position = {
          x: position.x + velocity.x,
          y: position.y + velocity.y
        };

        // Add trail point with velocity
        trail = [
          ...trail.filter((p) => now - p.time < TRAIL_LIFETIME),
          { x: position.x, y: position.y, vx: velocity.x, vy: velocity.y, time: now }
        ];

        const logoSize = 32;
        const left = originalRect?.left ?? 0;
        const top = originalRect?.top ?? 0;

        const currentX = left + position.x;
        const currentY = top + position.y;

        // Bounce off walls
        if (currentX <= 0) {
          velocity.x = Math.abs(velocity.x) * BOUNCINESS;
          position.x = -left;
          bounceCount++;
        } else if (currentX + logoSize >= window.innerWidth) {
          velocity.x = -Math.abs(velocity.x) * BOUNCINESS;
          position.x = window.innerWidth - left - logoSize;
          bounceCount++;
        }

        // Bounce off ceiling
        if (currentY <= 0) {
          velocity.y = Math.abs(velocity.y) * BOUNCINESS;
          position.y = -top;
          bounceCount++;
        }

        // Bounce off floor (main bounce surface)
        if (currentY + logoSize >= window.innerHeight) {
          velocity.y = -Math.abs(velocity.y) * BOUNCINESS;
          position.y = window.innerHeight - top - logoSize;
          bounceCount++;
        }

        // Rotation based on horizontal velocity
        rotation += velocity.x * 0.8;

        if (bounceCount >= MIN_BOUNCES && Math.abs(velocity.y) < 2 && Math.abs(velocity.x) < 2) {
          phase = 'returning';
        }
      } else if (phase === 'returning') {
        // Fade out trail
        trail = trail.filter((p) => now - p.time < TRAIL_LIFETIME);

        position = {
          x: position.x * 0.9,
          y: position.y * 0.9
        };

        // Normalize rotation and ease toward 0
        const normalizedRotation = ((rotation % 360) + 360) % 360;
        const targetRotation = normalizedRotation > 180 ? 360 : 0;
        const rotationDiff = targetRotation - normalizedRotation;
        rotation = normalizedRotation + rotationDiff * 0.15;

        if (Math.abs(position.x) < 1 && Math.abs(position.y) < 1 && trail.length === 0) {
          phase = 'idle';
          position = { x: 0, y: 0 };
          speed = 0;
          rotation = 0;
          animationFrame = null;
          return;
        }
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
  }

  function handleMouseEnter() {
    isHovering = true;
    if (phase === 'idle') {
      phase = 'spinning';
      speed = 1;
      startAnimation();
    }
  }

  function handleMouseLeave() {
    isHovering = false;
  }

  function getTrailOpacity(time: number): number {
    const age = Date.now() - time;
    return Math.max(0, 1 - age / TRAIL_LIFETIME);
  }

  function getTrailAngle(vx: number, vy: number): number {
    // Point opposite to velocity direction
    return Math.atan2(-vy, -vx) * (180 / Math.PI);
  }

  $effect(() => {
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  });
</script>

<!-- Party trail -->
{#if trail.length > 0}
  <div class="pointer-events-none fixed inset-0" style="z-index: 9998;">
    {#each trail as point, i (i)}
      {@const opacity = getTrailOpacity(point.time)}
      {@const left = (originalRect?.left ?? 0) + point.x + 16}
      {@const top = (originalRect?.top ?? 0) + point.y + 16}
      {@const angle = getTrailAngle(point.vx, point.vy)}
      {@const trailSpeed = Math.sqrt(point.vx * point.vx + point.vy * point.vy)}
      {@const trailLength = Math.min(50, trailSpeed * 3)}
      <div
        class="absolute flex flex-col"
        style="
          left: {left}px;
          top: {top}px;
          transform: translate(0, -50%) rotate({angle}deg);
          transform-origin: left center;
          opacity: {opacity};
        "
      >
        {#each TRAIL_COLORS as color}
          <div
            style="
              width: {trailLength}px;
              height: 3px;
              background: {color};
              border-radius: 2px;
            "
          ></div>
        {/each}
      </div>
    {/each}
  </div>
{/if}

<a
  id="top-left-nav"
  href="/"
  aria-label="Go Home"
  bind:this={logoEl}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  style="transform: translate({position.x}px, {position.y}px); {phase !== 'idle' ? 'z-index: 9999; position: relative;' : ''}"
>
  <img
    src="/tokens/party.svg"
    alt="Party"
    class="max-h-[28px] md:max-h-[32px] max-w-[28px] md:max-w-[32px]"
    style="transform: rotate({rotation}deg);"
  />
</a>
