export class BubbleManager {
  private container: HTMLElement;
  private bubbles: Bubble[] = [];
  private animationFrameId: number | null = null;
  private bounds: { width: number; height: number } = { width: 0, height: 0 };

  constructor(container: HTMLElement) {
    this.container = container;
    this.updateBounds();
    window.addEventListener("resize", () => this.updateBounds());
    this.startAnimation();
  }

  private updateBounds() {
    this.bounds = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  public addBubble(text: string) {
    const element = document.createElement("div");
    element.className = "message bubble";

    const content = document.createElement("div");
    content.className = "message-content";
    content.textContent = text;
    element.appendChild(content);

    // Initial random position
    const x = Math.random() * (this.bounds.width - 200) + 100;
    const y = Math.random() * (this.bounds.height - 200) + 100;

    // Random velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random(); // 1-2 pixels per frame
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    this.container.appendChild(element);

    // Measure size after append
    const rect = element.getBoundingClientRect();
    // Use diagonal to ensure content fits in circle
    const diagonal = Math.sqrt(rect.width * rect.width + rect.height * rect.height);
    const radius = diagonal / 2;

    // Style adjustments for bubble shape
    element.style.width = `${radius * 2}px`;
    element.style.height = `${radius * 2}px`;
    element.style.position = "fixed";
    element.style.left = "0";
    element.style.top = "0";

    const bubble: Bubble = {
      element,
      x,
      y,
      vx,
      vy,
      radius,
      mass: radius, // approximate mass by size
    };

    // Click to burst
    element.addEventListener("click", () => this.burstBubble(bubble));
    element.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.burstBubble(bubble);
    });

    this.bubbles.push(bubble);
  }

  private burstBubble(bubble: Bubble) {
    const index = this.bubbles.indexOf(bubble);
    if (index === -1) return;

    this.bubbles.splice(index, 1);

    bubble.element.style.transition = "transform 0.2s ease-out, opacity 0.2s ease-out";
    bubble.element.style.transform = `translate(${bubble.x - bubble.radius}px, ${
      bubble.y - bubble.radius
    }px) scale(1.5)`;
    bubble.element.style.opacity = "0";

    setTimeout(() => {
      bubble.element.remove();
    }, 200);
  }

  private startAnimation() {
    const animate = () => {
      this.updatePhysics();
      this.render();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  private updatePhysics() {
    for (let i = 0; i < this.bubbles.length; i++) {
      const b1 = this.bubbles[i];

      // Update position
      b1.x += b1.vx;
      b1.y += b1.vy;

      // Wall collisions
      if (b1.x - b1.radius < 0) {
        b1.x = b1.radius;
        b1.vx *= -1;
      } else if (b1.x + b1.radius > this.bounds.width) {
        b1.x = this.bounds.width - b1.radius;
        b1.vx *= -1;
      }

      if (b1.y - b1.radius < 0) {
        b1.y = b1.radius;
        b1.vy *= -1;
      } else if (b1.y + b1.radius > this.bounds.height) {
        b1.y = this.bounds.height - b1.radius;
        b1.vy *= -1;
      }

      // Bubble collisions
      for (let j = i + 1; j < this.bubbles.length; j++) {
        const b2 = this.bubbles[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = b1.radius + b2.radius;

        if (dist < minDist) {
          // Collision response
          const angle = Math.atan2(dy, dx);
          const sin = Math.sin(angle);
          const cos = Math.cos(angle);

          // Rotate bubble velocities
          const vx1 = b1.vx * cos + b1.vy * sin;
          const vy1 = b1.vy * cos - b1.vx * sin;
          const vx2 = b2.vx * cos + b2.vy * sin;
          const vy2 = b2.vy * cos - b2.vx * sin;

          // Rotate velocities back
          const m1 = b1.mass;
          const m2 = b2.mass;

          // 1D elastic collision along the normal
          const vx1Final = ((m1 - m2) * vx1 + 2 * m2 * vx2) / (m1 + m2);
          const vx2Final = ((m2 - m1) * vx2 + 2 * m1 * vx1) / (m1 + m2);

          b1.vx = vx1Final * cos - vy1 * sin;
          b1.vy = vy1 * cos + vx1Final * sin;
          b2.vx = vx2Final * cos - vy2 * sin;
          b2.vy = vy2 * cos + vx2Final * sin;

          // Separate bubbles to prevent sticking
          const overlap = minDist - dist;
          if (overlap > 0) {
            const separationX = overlap * Math.cos(angle);
            const separationY = overlap * Math.sin(angle);

            b1.x -= separationX / 2;
            b1.y -= separationY / 2;
            b2.x += separationX / 2;
            b2.y += separationY / 2;
          }
        }
      }
    }
  }

  private render() {
    for (const bubble of this.bubbles) {
      // Translate to position (centering the bubble)
      bubble.element.style.transform = `translate(${bubble.x - bubble.radius}px, ${bubble.y - bubble.radius}px)`;
    }
  }
}

interface Bubble {
  element: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
}
