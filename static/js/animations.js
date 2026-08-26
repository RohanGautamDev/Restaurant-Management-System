/**
 * DineMind AI — animations.js
 * the-edge.studio inspired kinetic animations, fluid particle physics,
 * magnetic custom cursor, 3D holographic tilt, dynamic card spotlight, and magnetic buttons.
 */

const Motion = {
  mouse: { x: 0, y: 0, targetX: 0, targetY: 0 },
  canvas: null,
  ctx: null,
  particles: [],
  ripples: [],
  mouseVelocity: { x: 0, y: 0, lastX: 0, lastY: 0 },
  animId: null,

  init() {
    this.initMouseTracking();
    this.initFluidCanvas();
    // 3D card tilt and magnetic button pulling disabled for flat, stable, non-zigzagging boxes
    this.initParallaxOrbs();
    this.initClickRipples();
    this.initPinwheelPhysics();
  },

  // ─── 1. Native Mouse Tracking (Particles & Tilt) ───
  initMouseTracking() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.targetX = e.clientX;
      this.mouse.targetY = e.clientY;

      // Track velocity for fluid particles
      this.mouseVelocity.x = e.clientX - this.mouseVelocity.lastX;
      this.mouseVelocity.y = e.clientY - this.mouseVelocity.lastY;
      this.mouseVelocity.lastX = e.clientX;
      this.mouseVelocity.lastY = e.clientY;
    });
  },

  // ─── 2. High-FPS Fluid Canvas with Velocity Physics ───
  initFluidCanvas() {
    this.canvas = document.getElementById('kinetic-canvas');
    if (!this.canvas) return;

    // Disable heavy canvas particle animation loop on mobile devices for smooth 60fps performance
    if (window.innerWidth <= 768 || 'ontouchstart' in window) {
      this.canvas.style.display = 'none';
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      if (window.innerWidth <= 768) {
        if (this.animId) cancelAnimationFrame(this.animId);
        this.canvas.style.display = 'none';
      } else {
        this.canvas.style.display = 'block';
      }
    });

    // Generate fluid kinetic nodes (desktop only)
    const count = 35;
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        originX: Math.random() * this.canvas.width,
        originY: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2.2 + 1.2,
        color: i % 3 === 0 ? 'rgba(79, 142, 255, 0.45)' : i % 3 === 1 ? 'rgba(245, 200, 66, 0.4)' : 'rgba(0, 212, 184, 0.35)',
      });
    }

    this.renderCanvas();
  },

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  renderCanvas() {
    if (!this.ctx || !this.canvas || window.innerWidth <= 768) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const mouseX = this.mouse.targetX;
    const mouseY = this.mouse.targetY;

    // Update & draw particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Interaction with mouse position
      const dx = mouseX - p.x;
      const dy = mouseY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 140) {
        const force = (1 - dist / 140) * 1.8;
        p.vx -= (dx / dist) * force;
        p.vy -= (dy / dist) * force;
      }

      // Physics integration + dampening
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Natural gentle float back
      p.vx += (Math.random() - 0.5) * 0.05;
      p.vy += (Math.random() - 0.5) * 0.05;

      // Bounds bounce
      if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

      // Draw particle circle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();

      // Fluid network lines
      for (let j = i + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j];
        const dist2 = Math.hypot(p.x - p2.x, p.y - p2.y);

        if (dist2 < 110) {
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = `rgba(120, 150, 255, ${0.14 * (1 - dist2 / 110)})`;
          this.ctx.lineWidth = 0.7;
          this.ctx.stroke();
        }
      }
    }

    // Render expanding click ripples
    for (let r = this.ripples.length - 1; r >= 0; r--) {
      const rip = this.ripples[r];
      rip.radius += rip.growth;
      rip.opacity -= 0.02;

      if (rip.opacity <= 0) {
        this.ripples.splice(r, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(245, 200, 66, ${rip.opacity})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    this.animId = requestAnimationFrame(() => this.renderCanvas());
  },

  // ─── 3. Card 3D Perspective Tilt & Dynamic Spotlight Shader ───
  initCard3DTilt() {},

  // ─── 4. Magnetic Button Micro-Physics ───
  initMagneticButtons() {},

  // ─── 5. Parallax Floating Orbs ───
  initParallaxOrbs() {
    const orbs = document.querySelectorAll('.orb');
    if (!orbs.length || window.innerWidth <= 768) return;

    window.addEventListener('mousemove', (e) => {
      if (window.innerWidth <= 768) return;
      const offsetX = (e.clientX / window.innerWidth - 0.5) * 40;
      const offsetY = (e.clientY / window.innerHeight - 0.5) * 40;

      orbs.forEach((orb, idx) => {
        const depth = (idx + 1) * 0.45;
        orb.style.transform = `translate3d(${offsetX * depth}px, ${offsetY * depth}px, 0)`;
      });
    });
  },

  // ─── 6. Click Ripple Waves ───
  initClickRipples() {
    window.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) return;
      this.ripples.push({
        x: e.clientX,
        y: e.clientY,
        radius: 5,
        growth: 4.5,
        opacity: 0.6,
      });
    });
  },

  // ─── 7. Smooth Number Counter Animation ───
  animateCounter(element, targetValue, duration = 1000, prefix = '', suffix = '') {
    if (!element) return;
    const numTarget = Number(targetValue) || 0;
    const isFloat = String(targetValue).includes('.');
    
    const currentText = element.textContent ? element.textContent.replace(/[^0-9.-]/g, '') : '';
    const prevVal = element.dataset.value !== undefined ? Number(element.dataset.value) : (currentText ? parseFloat(currentText) || 0 : 0);
    
    element.dataset.value = numTarget;

    if (prevVal === numTarget && element.dataset.initialized === 'true') {
      element.textContent = prefix + (isFloat ? numTarget.toFixed(2) : numTarget) + suffix;
      return;
    }

    element.dataset.initialized = 'true';
    const startValue = prevVal;
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (numTarget - startValue) * easeProgress;

      element.textContent = prefix + (isFloat ? currentValue.toFixed(2) : Math.floor(currentValue)) + suffix;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = prefix + (isFloat ? numTarget.toFixed(2) : numTarget) + suffix;
      }
    }

    requestAnimationFrame(step);
  },

  // ─── 8. the-edge.studio Pinwheel Interactive Velocity Physics ───
  initPinwheelPhysics() {
    const pinwheels = document.querySelectorAll('.edge-pinwheel-svg');
    if (!pinwheels.length) return;

    if (window.innerWidth <= 768 || 'ontouchstart' in window) {
      // On mobile, rely on pure CSS hardware-accelerated keyframe animation to avoid JS DOM frame thrashes
      return;
    }

    let baseDuration = 5.0;
    let currentDuration = 5.0;
    let targetDuration = 5.0;

    window.addEventListener('mousemove', () => {
      if (window.innerWidth <= 768) return;
      const speed = Math.hypot(this.mouseVelocity.x, this.mouseVelocity.y);
      targetDuration = Math.max(0.7, baseDuration - Math.min(speed * 0.15, 4.3));
    });

    const updatePinwheels = () => {
      if (window.innerWidth <= 768) return;
      currentDuration += (targetDuration - currentDuration) * 0.08;
      targetDuration += (baseDuration - targetDuration) * 0.03;

      pinwheels.forEach(svg => {
        svg.style.setProperty('--spin-duration', `${currentDuration.toFixed(2)}s`);
      });

      requestAnimationFrame(updatePinwheels);
    };
    updatePinwheels();

    pinwheels.forEach(svg => {
      svg.addEventListener('click', (e) => {
        e.stopPropagation();
        targetDuration = 0.4;
      });
    });
  }
};
