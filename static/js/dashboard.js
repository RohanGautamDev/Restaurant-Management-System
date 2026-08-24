/**
 * DineMind AI — dashboard.js
 * Dashboard KPIs, Smart AI Operational Insights, Sales chart, Peak hours & Live Alerts
 */

'use strict';

const Dashboard = {
  async load() {
    try {
      const [stats, sales, peak, lowStock] = await Promise.all([
        API.get('/dashboard/stats/'),
        API.get('/reports/daily-sales/?days=7'),
        API.get('/reports/peak-hours/?days=14'),
        API.get('/reports/low-stock/'),
      ]);

      this.renderKPIs(stats);
      this.renderSmartInsights(stats, peak, lowStock);
      this.renderSalesChart(sales);
      this.renderPeakHours(peak);
      this.renderLowStockAlert(lowStock);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      UI.showToast('Could not refresh dashboard statistics.', 'error');
    }
  },

  renderKPIs(data) {
    const revEl = document.getElementById('kpi-today-revenue');
    const ordersEl = document.getElementById('kpi-today-orders');
    const availTableEl = document.getElementById('kpi-available-tables');
    const occTableEl = document.getElementById('kpi-occupied-tables');
    const lowStockEl = document.getElementById('kpi-low-stock-count');
    const popularDishEl = document.getElementById('kpi-popular-dish');

    if (revEl) Motion.animateCounter(revEl, data.today_revenue, 1400, '$');
    if (ordersEl) Motion.animateCounter(ordersEl, data.today_orders, 1200);
    if (availTableEl) Motion.animateCounter(availTableEl, data.available_tables, 1000);
    if (occTableEl) Motion.animateCounter(occTableEl, data.occupied_tables, 1000);
    if (lowStockEl) Motion.animateCounter(lowStockEl, data.low_stock_count, 1000);

    if (popularDishEl) {
      popularDishEl.textContent = data.popular_dish || 'Chef Special';
    }

    // Update sidebar low stock badge
    const badge = document.getElementById('sidebar-lowstock-badge');
    if (badge) {
      if (data.low_stock_count > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = data.low_stock_count;
      } else {
        badge.style.display = 'none';
      }
    }
  },

  renderSmartInsights(stats, peak, lowStock) {
    const container = document.getElementById('smart-ai-insights-list');
    if (!container) return;

    const insights = [];

    // 1. Peak Hour Insight
    if (peak && peak.peak_hour_formatted) {
      insights.push({
        icon: '⏰',
        title: 'Peak Rush Window',
        desc: `Historical orders indicate maximum restaurant demand between <strong>${peak.peak_hour_formatted}</strong> (${peak.peak_order_count} orders logged). Prep line recommended prior to this window.`
      });
    }

    // 2. Inventory Health Insight
    if (lowStock && lowStock.low_stock_count > 0) {
      const itemNames = (lowStock.low_stock_items || []).slice(0, 3).map(i => i.name).join(', ');
      insights.push({
        icon: '📦',
        title: 'Supply Chain Notice',
        desc: `<strong>${lowStock.low_stock_count} critical ingredient(s)</strong> (${itemNames}) are approaching or below minimum thresholds. Auto-stocking or restock order recommended.`
      });
    } else {
      insights.push({
        icon: '✅',
        title: 'Optimal Inventory Level',
        desc: 'All ingredient reserves are currently above safety thresholds. Zero menu availability disruptions detected.'
      });
    }

    // 3. Table Utilization Insight
    const totalTables = (stats.available_tables || 0) + (stats.occupied_tables || 0) + (stats.reserved_tables || 0);
    if (totalTables > 0) {
      const occRate = Math.round(((stats.occupied_tables || 0) / totalTables) * 100);
      insights.push({
        icon: '🪑',
        title: 'Live Floorplan Capacity',
        desc: `Current dining room capacity is at <strong>${occRate}%</strong> (${stats.occupied_tables} seated, ${stats.available_tables} open for walk-ins/reservations).`
      });
    }

    // 4. Popular item
    if (stats.popular_dish && stats.popular_dish !== 'N/A') {
      insights.push({
        icon: '⭐',
        title: 'Guest Favorite of the Day',
        desc: `<strong>${stats.popular_dish}</strong> is leading today's guest orders. Ensure prep station is stocked with required ingredients.`
      });
    }

    container.innerHTML = insights.map(item => `
      <div class="ai-insight-item">
        <div class="ai-insight-icon">${item.icon}</div>
        <div style="flex:1;">
          <div style="font-size:0.86rem;font-weight:700;color:var(--text-1);margin-bottom:2px;">${item.title}</div>
          <div style="font-size:0.80rem;color:var(--text-2);line-height:1.4;">${item.desc}</div>
        </div>
      </div>
    `).join('');
  },

  renderSalesChart(data) {
    const chartContainer = document.getElementById('dashboard-sales-chart');
    if (!chartContainer) return;

    const days = data.daily_breakdown || [];
    if (days.length === 0) {
      chartContainer.innerHTML = '<div class="empty-state"><div class="empty-text">No sales data recorded yet.</div></div>';
      return;
    }

    const maxRevenue = Math.max(...days.map(d => d.revenue), 10);

    chartContainer.innerHTML = `
      <div class="sales-bar-chart">
        ${days.map(d => {
          const heightPct = Math.max(8, Math.round((d.revenue / maxRevenue) * 100));
          const dateObj = new Date(d.date);
          const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
          return `
            <div class="bar-column">
              <div class="bar-pill" style="height: ${heightPct}%;" title="${dateLabel}: $${d.revenue.toFixed(2)} (${d.orders} orders)"></div>
              <div class="bar-date-label">${dateLabel.split(',')[0]}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:0.75rem;color:var(--text-3);">
        <span>7-Day Performance</span>
        <span style="color:var(--gold-light);font-weight:600;">Today: $${(data.today?.revenue || 0).toFixed(2)}</span>
      </div>
    `;
  },

  renderPeakHours(data) {
    const container = document.getElementById('dashboard-peak-hours');
    if (!container) return;

    const hours = data.hourly_breakdown || [];
    if (hours.length === 0) {
      container.innerHTML = '<div class="text-3 text-xs">Analyzing order time distribution...</div>';
      return;
    }

    const maxOrders = Math.max(...hours.map(h => h.order_count), 1);
    container.innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:4px;height:90px;padding:6px 0;">
        ${hours.map(h => {
          const pct = Math.max(10, Math.round((h.order_count / maxOrders) * 100));
          const isPeak = h.hour === data.peak_hour;
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;">
              <div style="width:100%;max-width:14px;height:${pct}%;border-radius:3px 3px 0 0;background:${isPeak ? 'linear-gradient(180deg,var(--gold),var(--amber))' : 'rgba(79,142,255,0.3)'};transition:height 0.8s ease;" title="${h.hour}:00 - ${h.order_count} orders"></div>
              <div style="font-size:0.58rem;color:var(--text-3);margin-top:4px;">${h.hour}h</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderLowStockAlert(data) {
    const alertBanner = document.getElementById('dashboard-low-stock-banner');
    if (!alertBanner) return;

    if (data.low_stock_count > 0) {
      alertBanner.style.display = 'flex';
      const countEl = alertBanner.querySelector('.low-stock-count-number');
      const listEl = alertBanner.querySelector('.low-stock-items-text');
      if (countEl) countEl.textContent = data.low_stock_count;
      if (listEl) {
        const names = (data.low_stock_items || []).map(i => `${i.name} (${i.quantity}${i.unit})`).join(' • ');
        listEl.textContent = names;
      }
    } else {
      alertBanner.style.display = 'none';
    }
  }
};
