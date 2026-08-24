/**
 * DineMind AI — components.js
 * Toast alerts, modal controller, digital clock, skeleton loaders & drawer controls
 */

'use strict';

const UI = {
  // ─── 1. Toast Notification System ───
  showToast(message, type = 'info', duration = 3500) {
    let stack = document.getElementById('toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'toast-stack';
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    const iconMap = {
      success: '✨',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span style="font-size:1.15rem;">${iconMap[type] || 'ℹ️'}</span>
      <div style="flex:1;font-size:0.86rem;font-weight:500;color:#f0f4ff;">${message}</div>
    `;

    stack.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ─── 2. Custom Modal Manager ───
  openModal(modalId) {
    const backdrop = document.getElementById(modalId);
    if (!backdrop) return;
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Auto-focus first input
    const firstInput = backdrop.querySelector('input:not([type="hidden"]), select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  },

  closeModal(modalId) {
    const backdrop = document.getElementById(modalId);
    if (!backdrop) return;
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
  },

  initModals() {
    // Click outside to close
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeModal(backdrop.id);
        }
      });
    });

    // Escape key listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.active').forEach(modal => {
          this.closeModal(modal.id);
        });
      }
    });
  },

  // ─── 3. Real-Time Digital Clock & Live Status ───
  initClock() {
    const clockEl = document.getElementById('live-clock-time');
    const updateTime = () => {
      if (!clockEl) return;
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    };
    updateTime();
    setInterval(updateTime, 1000);
  },

  // ─── 4. Mobile Drawer Toggler ───
  initSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('main-sidebar');
    if (!toggleBtn || !sidebar) return;

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('drawer-open');
    });

    // Close on navigation item click (on mobile)
    sidebar.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 860) {
          sidebar.classList.remove('drawer-open');
        }
      });
    });
  }
};
