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
    this.initCard3DTilt();
    this.initMagneticButtons();
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
    this.ctx = this.canvas.getContext('2d');

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Generate fluid kinetic nodes
    const count = window.innerWidth < 768 ? 20 : 45;
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
    if (!this.ctx || !this.canvas) return;
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
  initCard3DTilt() {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    document.addEventListener('mousemove', (e) => {
      const cards = document.querySelectorAll('.card-glass, .kpi-card, .table-node, .hero-banner');

      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const cardX = e.clientX - rect.left;
        const cardY = e.clientY - rect.top;

        // Update spotlight position variables on card
        card.style.setProperty('--mouse-x', `${cardX}px`);
        card.style.setProperty('--mouse-y', `${cardY}px`);

        // If hovered inside bounds, calculate 3D tilt
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const tiltX = (cardY - centerY) / centerY * -6; // max 6 deg
          const tiltY = (cardX - centerX) / centerX * 6;

          card.style.transform = `perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) translateY(-3px)`;
        }
      });
    });

    // Reset tilt on mouseleave
    document.addEventListener('mouseout', (e) => {
      const card = e.target.closest('.card-glass, .kpi-card, .table-node, .hero-banner');
      if (card) {
        card.style.transform = '';
      }
    });
  },

  // ─── 4. Magnetic Button Micro-Physics ───
  initMagneticButtons() {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const magneticElements = document.querySelectorAll('.btn, .sidebar-logo-icon, .sidebar-toggle-btn');

    magneticElements.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        // Pull effect
        btn.style.transform = `translate3d(${x * 0.25}px, ${y * 0.25}px, 0)`;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate3d(0, 0, 0)';
      });
    });
  },

  // ─── 5. Parallax Floating Orbs ───
  initParallaxOrbs() {
    const orbs = document.querySelectorAll('.orb');
    if (!orbs.length) return;

    window.addEventListener('mousemove', (e) => {
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
  animateCounter(element, targetValue, duration = 1200, prefix = '', suffix = '') {
    if (!element) return;
    const startValue = 0;
    const startTime = performance.now();
    const isFloat = String(targetValue).includes('.');

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (targetValue - startValue) * easeProgress;

      element.textContent = prefix + (isFloat ? currentValue.toFixed(2) : Math.floor(currentValue)) + suffix;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = prefix + (isFloat ? Number(targetValue).toFixed(2) : targetValue) + suffix;
      }
    }

    requestAnimationFrame(step);
  },

  // ─── 8. the-edge.studio Pinwheel Interactive Velocity Physics ───
  initPinwheelPhysics() {
    const pinwheels = document.querySelectorAll('.edge-pinwheel-svg');
    if (!pinwheels.length) return;

    let baseDuration = 5.0; // normal 5s per rev
    let currentDuration = 5.0;
    let targetDuration = 5.0;

    window.addEventListener('mousemove', () => {
      const speed = Math.hypot(this.mouseVelocity.x, this.mouseVelocity.y);
      // High velocity spins the pinwheel faster (down to 0.7s)
      targetDuration = Math.max(0.7, baseDuration - Math.min(speed * 0.15, 4.3));
    });

    const updatePinwheels = () => {
      // Smooth lerp back to 5.0s
      currentDuration += (targetDuration - currentDuration) * 0.08;
      targetDuration += (baseDuration - targetDuration) * 0.03;

      pinwheels.forEach(svg => {
        svg.style.setProperty('--spin-duration', `${currentDuration.toFixed(2)}s`);
      });

      requestAnimationFrame(updatePinwheels);
    };
    updatePinwheels();

    // Click on pinwheel bursts chromatic wave
    pinwheels.forEach(svg => {
      svg.addEventListener('click', (e) => {
        e.stopPropagation();
        for (let i = 0; i < 4; i++) {
          this.ripples.push({
            x: e.clientX,
            y: e.clientY,
            radius: 8 * i,
            growth: 6 + i * 2,
            opacity: 0.8,
          });
        }
        targetDuration = 0.4; // super spin burst!
      });
    });
  }
};
