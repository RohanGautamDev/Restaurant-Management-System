/**
 * DineMind AI — app.js
 * Main Single Page Application Orchestrator & Live Operations Controller
 */

'use strict';

const App = {
  currentView: 'dashboard',
  menuItemsCache: [],
  tablesCache: [],
  activeOrderCart: [],

  init() {
    Motion.init();
    UI.initModals();
    UI.initClock();
    UI.initSidebar();

    this.bindNavigation();
    this.navigate('dashboard');
    this.startLiveSync();
  },

  activeOrdersFilter: 'all',

  // Real-Time Live Sync Engine for POS & Kitchen Display
  startLiveSync() {
    setInterval(() => {
      if (document.hidden) return; // Don't poll when tab is backgrounded
      this.refreshCurrentViewSilently();
    }, 6000);
  },

  async refreshCurrentViewSilently() {
    try {
      if (this.currentView === 'kitchen') {
        await this.loadKitchenView(true);
      } else if (this.currentView === 'orders') {
        await this.loadOrders(this.activeOrdersFilter, true);
      } else if (this.currentView === 'dashboard') {
        await Dashboard.load();
      } else if (this.currentView === 'tables') {
        await this.loadTables(true);
      }
    } catch (err) {
      // Ignore background sync errors
    }
  },

  // ─── SPA Navigation & Keyboard Menu Keys ───
  bindNavigation() {
    document.querySelectorAll('[data-route]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        if (route) this.navigate(route);
      });
    });

    // Keyboard Menu Shortcut Keys (1 - 8)
    const routeKeys = {
      '1': 'dashboard',
      '2': 'orders',
      '3': 'tables',
      '4': 'reservations',
      '5': 'menu',
      '6': 'inventory',
      '7': 'waste',
      '8': 'reports',
    };

    window.addEventListener('keydown', (e) => {
      // Don't trigger when user is typing in form inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const targetRoute = routeKeys[e.key];
      if (targetRoute) {
        this.navigate(targetRoute);
      }
    });
  },

  navigate(route) {
    this.currentView = route;

    // Update active state in sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-route') === route);
    });

    // Update breadcrumb
    const breadcrumb = document.getElementById('topbar-current-page');
    if (breadcrumb) {
      breadcrumb.textContent = route.charAt(0).toUpperCase() + route.slice(1);
    }

    // Toggle view visibility
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSection = document.getElementById(`view-${route}`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Route-specific loader
    switch (route) {
      case 'dashboard':
        Dashboard.load();
        break;
      case 'kitchen':
        this.loadKitchenView();
        break;
      case 'orders':
        this.loadOrders();
        break;
      case 'tables':
        this.loadTables();
        break;
      case 'reservations':
        this.loadReservations();
        break;
      case 'menu':
        this.loadMenu();
        break;
      case 'inventory':
        this.loadInventory();
        break;
      case 'waste':
        this.loadWaste();
        break;
      case 'reports':
        this.loadReports();
        break;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ═════════════════════════════════════════════════════
  // KITCHEN DISPLAY SYSTEM (KDS)
  // ═════════════════════════════════════════════════════
  async loadKitchenView(isSilent = false) {
    const colPending = document.getElementById('kds-column-pending');
    const colPreparing = document.getElementById('kds-column-preparing');
    const colReady = document.getElementById('kds-column-ready');

    if (!colPending || !colPreparing || !colReady) return;

    try {
      const data = await API.get('/orders/');
      const orders = data.results || data;

      const pendingList = orders.filter(o => o.status === 'pending');
      const preparingList = orders.filter(o => o.status === 'preparing');
      const readyList = orders.filter(o => o.status === 'ready');

      // Update counters
      const countP = document.getElementById('kds-pending-count');
      const countPr = document.getElementById('kds-preparing-count');
      const countR = document.getElementById('kds-ready-count');
      if (countP) countP.textContent = pendingList.length;
      if (countPr) countPr.textContent = preparingList.length;
      if (countR) countR.textContent = readyList.length;

      const renderTicketCard = (o, accentColor, buttonHtml) => `
        <div class="card-glass p-16 flex flex-col justify-between mb-12" style="border-left:4px solid ${accentColor};">
          <div>
            <div class="flex items-center justify-between mb-8">
              <span class="font-mono font-bold text-gold text-base">#ORD-${o.id}</span>
              <span class="badge badge-preparing" style="font-size:0.85rem;padding:4px 10px;">Table ${o.table_number || o.table || '—'}</span>
            </div>
            <div class="text-3 text-xs mb-8 flex items-center gap-6 font-mono">
              <span>⏰ ${new Date(o.created_at || Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
            <div class="divider" style="margin:8px 0;"></div>
            <div class="flex flex-col gap-6 mb-12">
              ${(o.items || []).map(i => `
                <div class="flex items-center justify-between text-sm">
                  <span class="text-1 font-bold">${i.quantity}x ${i.menu_item_name}</span>
                  <span class="text-3 text-xs uppercase">${i.menu_item_category || ''}</span>
                </div>
              `).join('')}
            </div>
            ${o.notes ? `<div class="p-8 text-xs text-amber card-glass mb-12">💡 Note: ${o.notes}</div>` : ''}
          </div>
          <div class="mt-8 pt-8 flex gap-8" style="border-top:1px solid rgba(255,255,255,0.06);">
            ${buttonHtml}
          </div>
        </div>
      `;

      // Render Pending Column
      const pendingHtml = pendingList.length === 0 ? '<div class="text-center text-3 text-xs p-24">No pending tickets.</div>' :
        pendingList.map(o => renderTicketCard(o, '#00d2ff', `
          <button class="btn btn-blue btn-sm flex-1" onclick="App.updateOrderStatus(${o.id}, 'preparing')">👨‍🍳 Start Preparing</button>
          <button class="btn btn-danger btn-sm" onclick="App.updateOrderStatus(${o.id}, 'cancelled')">Cancel</button>
        `)).join('');

      // Render Preparing Column
      const preparingHtml = preparingList.length === 0 ? '<div class="text-center text-3 text-xs p-24">No orders currently cooking.</div>' :
        preparingList.map(o => renderTicketCard(o, '#ff9233', `
          <button class="btn btn-teal btn-sm flex-1" onclick="App.updateOrderStatus(${o.id}, 'ready')">🔔 Mark Ready</button>
        `)).join('');

      // Render Ready Column
      const readyHtml = readyList.length === 0 ? '<div class="text-center text-3 text-xs p-24">No plated orders waiting.</div>' :
        readyList.map(o => renderTicketCard(o, '#38ef7d', `
          <button class="btn btn-gold btn-sm flex-1" onclick="App.updateOrderStatus(${o.id}, 'completed')">✨ Complete</button>
        `)).join('');

      if (!isSilent || colPending.innerHTML !== pendingHtml) colPending.innerHTML = pendingHtml;
      if (!isSilent || colPreparing.innerHTML !== preparingHtml) colPreparing.innerHTML = preparingHtml;
      if (!isSilent || colReady.innerHTML !== readyHtml) colReady.innerHTML = readyHtml;

    } catch (err) {
      if (!isSilent) {
        console.error(err);
        UI.showToast('Failed to refresh Kitchen Display board.', 'error');
      }
    }
  },

  // ═════════════════════════════════════════════════════
  // 1. ORDER MANAGEMENT
  // ═════════════════════════════════════════════════════
  async loadOrders(statusFilter = 'all', isSilent = false) {
    this.activeOrdersFilter = statusFilter;
    const listEl = document.getElementById('orders-table-body');
    if (!listEl) return;

    try {
      let endpoint = '/orders/';
      if (statusFilter !== 'all') {
        endpoint += `?status=${statusFilter}`;
      }
      const data = await API.get(endpoint);
      const orders = data.results || data;

      if (!orders || orders.length === 0) {
        listEl.innerHTML = '<tr><td colspan="6" class="text-center text-3" style="padding:40px;">No orders found for selected filter.</td></tr>';
        return;
      }

      const html = orders.map(o => `
        <tr>
          <td><span class="font-mono text-1 font-bold">#ORD-${o.id}</span></td>
          <td>
            <div class="text-1 font-bold">Table ${o.table_number || o.table || '—'}</div>
            <div class="text-3 text-xs">${(o.items || []).length} items ordered</div>
          </td>
          <td>
            <div class="text-2 text-xs" style="max-width:240px;">
              ${(o.items || []).map(i => `${i.quantity}x ${i.menu_item_name}`).join(', ')}
            </div>
          </td>
          <td><span class="text-gold font-bold text-md">$${parseFloat(o.total_amount).toFixed(2)}</span></td>
          <td><span class="badge badge-${o.status}">${o.status_display || o.status}</span></td>
          <td>
            <div class="flex gap-8">
              ${o.status === 'pending' ? `
                <button class="btn btn-blue btn-sm" onclick="App.updateOrderStatus(${o.id}, 'preparing')">👨‍🍳 Prepare</button>
                <button class="btn btn-danger btn-sm" onclick="App.updateOrderStatus(${o.id}, 'cancelled')">Cancel</button>
              ` : ''}
              ${o.status === 'preparing' ? `
                <button class="btn btn-teal btn-sm" onclick="App.updateOrderStatus(${o.id}, 'ready')">🔔 Ready</button>
              ` : ''}
              ${o.status === 'ready' ? `
                <button class="btn btn-gold btn-sm" onclick="App.updateOrderStatus(${o.id}, 'completed')">✨ Complete</button>
              ` : ''}
              ${o.status === 'completed' || o.status === 'cancelled' ? `
                <span class="text-3 text-xs">Archived</span>
              ` : ''}
            </div>
          </td>
        </tr>
      `).join('');

      if (!isSilent || listEl.innerHTML !== html) {
        listEl.innerHTML = html;
      }
    } catch (err) {
      if (!isSilent) {
        console.error(err);
        UI.showToast('Failed to load orders.', 'error');
      }
    }
  },

  async updateOrderStatus(orderId, newStatus) {
    try {
      await API.patch(`/orders/${orderId}/`, { status: newStatus });
      UI.showToast(`Order #${orderId} updated to ${newStatus}.`, 'success');
      if (this.currentView === 'kitchen') {
        this.loadKitchenView();
      } else {
        this.loadOrders();
      }
      Dashboard.load();
    } catch (err) {
      UI.showToast(err.message || 'Status update failed.', 'error');
    }
  },

  async openNewOrderModal() {
    this.activeOrderCart = [];
    this.renderOrderCart();

    try {
      const [tablesData, menuData] = await Promise.all([
        API.get('/tables/?status=available'),
        API.get('/menu/?available=true')
      ]);

      const tables = tablesData.results || tablesData;
      const menuItems = menuData.results || menuData;
      this.menuItemsCache = menuItems;

      const tableSelect = document.getElementById('order-modal-table-select');
      if (tableSelect) {
        if (tables.length === 0) {
          tableSelect.innerHTML = '<option value="">No tables currently available</option>';
        } else {
          tableSelect.innerHTML = '<option value="">-- Choose Available Table --</option>' +
            tables.map(t => `<option value="${t.id}">Table ${t.table_number} (${t.capacity} seats · ${t.location_display || t.location})</option>`).join('');
        }
      }

      const itemPicker = document.getElementById('order-modal-item-picker');
      if (itemPicker) {
        itemPicker.innerHTML = menuItems.map(m => `
          <button type="button" class="btn btn-glass text-left p-12 flex items-center justify-between" onclick="App.addToOrderCart(${m.id})">
            <div>
              <div class="text-1 font-bold text-sm">${m.name}</div>
              <div class="text-3 text-xs">${m.category_display || m.category}</div>
            </div>
            <div class="text-gold font-bold text-sm">$${parseFloat(m.price).toFixed(2)}</div>
          </button>
        `).join('');
      }

      UI.openModal('modal-new-order');
    } catch (err) {
      UI.showToast('Could not load menu/tables for ordering.', 'error');
    }
  },

  addToOrderCart(menuItemId) {
    const item = this.menuItemsCache.find(m => m.id === menuItemId);
    if (!item) return;

    const existing = this.activeOrderCart.find(i => i.menu_item_id === menuItemId);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.activeOrderCart.push({
        menu_item_id: menuItemId,
        name: item.name,
        price: parseFloat(item.price),
        quantity: 1
      });
    }
    this.renderOrderCart();
  },

  changeCartItemQty(menuItemId, delta) {
    const item = this.activeOrderCart.find(i => i.menu_item_id === menuItemId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
      this.activeOrderCart = this.activeOrderCart.filter(i => i.menu_item_id !== menuItemId);
    }
    this.renderOrderCart();
  },

  renderOrderCart() {
    const cartEl = document.getElementById('order-modal-cart-items');
    const totalEl = document.getElementById('order-modal-total-amount');
    if (!cartEl) return;

    if (this.activeOrderCart.length === 0) {
      cartEl.innerHTML = '<div class="text-center text-3 text-xs p-16">No items selected yet. Tap any dish above.</div>';
      if (totalEl) totalEl.textContent = '$0.00';
      return;
    }

    let grandTotal = 0;
    cartEl.innerHTML = this.activeOrderCart.map(i => {
      const subtotal = i.price * i.quantity;
      grandTotal += subtotal;
      return `
        <div class="flex items-center justify-between p-8" style="border-bottom:1px solid rgba(255,255,255,0.04);">
          <div class="text-1 font-semi text-sm">${i.name}</div>
          <div class="flex items-center gap-12">
            <div class="flex items-center gap-6">
              <button type="button" class="btn btn-ghost btn-sm p-4" onclick="App.changeCartItemQty(${i.menu_item_id}, -1)">−</button>
              <span class="text-1 font-bold text-sm">${i.quantity}</span>
              <button type="button" class="btn btn-ghost btn-sm p-4" onclick="App.changeCartItemQty(${i.menu_item_id}, 1)">+</button>
            </div>
            <span class="text-gold font-bold text-sm" style="min-width:60px;text-align:right;">$${subtotal.toFixed(2)}</span>
          </div>
        </div>
      `;
    }).join('');

    if (totalEl) totalEl.textContent = `$${grandTotal.toFixed(2)}`;
  },

  async submitNewOrder() {
    const tableId = document.getElementById('order-modal-table-select').value;
    const notes = document.getElementById('order-modal-notes').value;

    if (!tableId) {
      UI.showToast('Please select a dining table.', 'warning');
      return;
    }

    if (this.activeOrderCart.length === 0) {
      UI.showToast('Please add at least 1 menu item.', 'warning');
      return;
    }

    const payload = {
      table_id: parseInt(tableId),
      items: this.activeOrderCart.map(i => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })),
      notes: notes
    };

    try {
      const result = await API.post('/orders/', payload);
      UI.showToast(`Order #ORD-${result.id} placed & inventory updated!`, 'success');
      UI.closeModal('modal-new-order');
      if (this.currentView === 'kitchen') {
        this.loadKitchenView();
      } else {
        this.loadOrders();
      }
      Dashboard.load();
    } catch (err) {
      UI.showToast(err.message || 'Failed to place order.', 'error');
    }
  },

  // ═════════════════════════════════════════════════════
  // 2. TABLE MANAGEMENT
  // ═════════════════════════════════════════════════════
  async loadTables(isSilent = false) {
    const gridEl = document.getElementById('tables-floor-grid');
    if (!gridEl) return;

    try {
      const data = await API.get('/tables/');
      const tables = data.results || data;
      this.tablesCache = tables;

      const locIcons = { indoor: '🪑', outdoor: '🌿', private: '💎', bar: '🍸', window: '🌅' };

      const html = tables.map(t => `
        <div class="card-glass table-node ${t.status}" onclick="App.inspectTable(${t.id})">
          <div style="font-size:1.6rem;margin-bottom:6px;">${locIcons[t.location] || '🪑'}</div>
          <div class="table-number-label">Table ${t.table_number}</div>
          <div class="text-3 text-xs mt-4">${t.capacity} Guests · ${t.location_display || t.location}</div>
          <div class="mt-12">
            <span class="badge badge-${t.status}">${t.status_display || t.status}</span>
          </div>
        </div>
      `).join('');

      if (!isSilent || gridEl.innerHTML !== html) {
        gridEl.innerHTML = html;
      }
    } catch (err) {
      if (!isSilent) {
        UI.showToast('Could not load tables floorplan.', 'error');
      }
    }
  },

  async runSmartTableRecommendation() {
    const guestsInput = document.getElementById('smart-table-guests-input');
    const resultBox = document.getElementById('smart-table-result-box');
    if (!guestsInput || !resultBox) return;

    const count = parseInt(guestsInput.value) || 2;

    try {
      const data = await API.get(`/tables/recommend/?guests=${count}`);
      resultBox.classList.remove('hidden');

      if (data.recommended) {
        resultBox.innerHTML = `
          <div class="card-glass p-16 card-glass-glow-teal">
            <div class="text-teal font-bold text-sm">✨ Smart Recommendation Found:</div>
            <div class="text-1 font-bold text-lg mt-4">Table ${data.recommended.table_number} (${data.recommended.capacity} Seats)</div>
            <div class="text-2 text-xs mt-4">${data.message}</div>
          </div>
        `;
      } else {
        resultBox.innerHTML = `
          <div class="card-glass p-16" style="border-color:rgba(255,92,138,0.3);">
            <div class="text-rose font-bold text-sm">⚠️ No Matching Tables Available</div>
            <div class="text-3 text-xs mt-4">${data.message}</div>
          </div>
        `;
      }
    } catch (err) {
      UI.showToast('Recommendation search failed.', 'error');
    }
  },

  inspectTable(tableId) {
    const t = this.tablesCache.find(tab => tab.id === tableId);
    if (!t) return;
    UI.showToast(`Table ${t.table_number} (${t.status.toUpperCase()}) selected.`, 'info');
  },

  // ═════════════════════════════════════════════════════
  // 3. MENU MANAGEMENT
  // ═════════════════════════════════════════════════════
  async loadMenu(category = 'all') {
    const matrixEl = document.getElementById('menu-matrix-grid');
    if (!matrixEl) return;

    try {
      let endpoint = '/menu/';
      if (category !== 'all') endpoint += `?category=${category}`;
      const data = await API.get(endpoint);
      const items = data.results || data;

      const catEmoji = { starter: '🥗', main: '🥩', dessert: '🍰', beverage: '🍹', side: '🍟', special: '⭐' };

      matrixEl.innerHTML = items.map(dish => `
        <div class="card-glass menu-dish-card ${dish.is_available ? '' : 'dish-out-of-stock'}">
          ${dish.is_available ? '' : '<span class="dish-oos-tag">OUT OF STOCK</span>'}
          ${dish.image_url ? 
            `<img class="menu-dish-thumb" src="${dish.image_url}" alt="${dish.name}" onerror="this.outerHTML='<div class=\\'menu-dish-thumb-placeholder\\'>${catEmoji[dish.category] || '🍽️'}</div>'">` : 
            `<div class="menu-dish-thumb-placeholder">${catEmoji[dish.category] || '🍽️'}</div>`
          }
          <div class="menu-dish-body">
            <div class="flex items-center justify-between">
              <span class="text-blue-light font-semi text-xs uppercase tracking-wider">${dish.category_display || dish.category}</span>
              <span class="text-gold font-bold text-md">$${parseFloat(dish.price).toFixed(2)}</span>
            </div>
            <div class="text-1 font-bold text-base mt-4">${dish.name}</div>
            <div class="text-2 text-xs line-clamp-2 mt-4" style="min-height:34px;">${dish.description || 'Crafted with premium fresh ingredients.'}</div>
            
            <div class="divider" style="margin:12px 0;"></div>
            
            <div class="flex items-center justify-between">
              <span class="badge ${dish.is_available ? 'badge-completed' : 'badge-cancelled'}">
                ${dish.is_available ? 'In Stock' : 'Unavailable'}
              </span>
              <div class="flex gap-4">
                <button class="btn btn-ghost btn-sm p-4" onclick="App.deleteMenuItem(${dish.id})">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      UI.showToast('Could not load menu items.', 'error');
    }
  },

  async openAddDishModal() {
    document.getElementById('form-add-dish').reset();
    UI.openModal('modal-add-dish');
  },

  async submitNewDish() {
    const name = document.getElementById('dish-name').value;
    const category = document.getElementById('dish-category').value;
    const price = document.getElementById('dish-price').value;
    const description = document.getElementById('dish-desc').value;
    const imageUrl = document.getElementById('dish-image').value;
    const isVeg = document.getElementById('dish-veg').checked;

    if (!name || !price) {
      UI.showToast('Name and Price are required.', 'warning');
      return;
    }

    try {
      await API.post('/menu/', {
        name,
        category,
        price: parseFloat(price),
        description,
        image_url: imageUrl,
        is_vegetarian: isVeg,
        is_available: true
      });
      UI.showToast(`Dish "${name}" added to menu!`, 'success');
      UI.closeModal('modal-add-dish');
      this.loadMenu();
    } catch (err) {
      UI.showToast(err.message || 'Failed to save dish.', 'error');
    }
  },

  async deleteMenuItem(dishId) {
    if (!confirm('Are you sure you want to remove this dish from the menu?')) return;
    try {
      await API.delete(`/menu/${dishId}/`);
      UI.showToast('Dish deleted successfully.', 'info');
      this.loadMenu();
    } catch (err) {
      UI.showToast('Failed to delete dish.', 'error');
    }
  },

  // ═════════════════════════════════════════════════════
  // 4. INVENTORY MANAGEMENT
  // ═════════════════════════════════════════════════════
  async loadInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    try {
      const data = await API.get('/inventory/');
      const items = data.results || data;

      tbody.innerHTML = items.map(i => {
        const qty = parseFloat(i.quantity);
        const threshold = parseFloat(i.min_stock_threshold);
        let statusBadge = `<span class="badge badge-completed">Healthy</span>`;
        if (qty <= 0) {
          statusBadge = `<span class="badge badge-cancelled">Depleted</span>`;
        } else if (qty <= threshold) {
          statusBadge = `<span class="badge badge-low-stock">⚠️ Low Stock</span>`;
        }

        return `
          <tr>
            <td>
              <div class="text-1 font-bold">${i.name}</div>
              <div class="text-3 text-xs">Cost: $${parseFloat(i.cost_per_unit).toFixed(2)} / ${i.unit}</div>
            </td>
            <td>
              <div class="text-1 font-bold text-md font-mono">${qty.toFixed(2)} ${i.unit}</div>
            </td>
            <td>
              <div class="text-3 text-xs font-mono">${threshold.toFixed(2)} ${i.unit}</div>
            </td>
            <td>${statusBadge}</td>
            <td>
              <div class="flex gap-8">
                <button class="btn btn-teal btn-sm" onclick="App.openRestockModal(${i.id}, '${i.name.replace(/'/g, "\\'")}', '${i.unit}')">📦 Restock</button>
                <button class="btn btn-danger btn-sm" onclick="App.openWasteLogModal(${i.id}, '${i.name.replace(/'/g, "\\'")}', '${i.unit}')">🗑️ Waste</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      UI.showToast('Failed to load inventory stock.', 'error');
    }
  },

  openRestockModal(itemId, name, unit) {
    document.getElementById('restock-item-id').value = itemId;
    document.getElementById('restock-item-name-label').textContent = `${name} (${unit})`;
    document.getElementById('restock-add-qty').value = '';
    UI.openModal('modal-restock-inventory');
  },

  async submitRestock() {
    const itemId = document.getElementById('restock-item-id').value;
    const addQty = parseFloat(document.getElementById('restock-add-qty').value);

    if (!addQty || addQty <= 0) {
      UI.showToast('Please enter a positive restock quantity.', 'warning');
      return;
    }

    try {
      const item = await API.get(`/inventory/${itemId}/`);
      const newTotal = parseFloat(item.quantity) + addQty;
      await API.patch(`/inventory/${itemId}/`, { quantity: newTotal.toFixed(2) });
      await API.post('/menu/sync-all/', {});
      
      UI.showToast('Stock replenished & menu availability synced!', 'success');
      UI.closeModal('modal-restock-inventory');
      this.loadInventory();
      Dashboard.load();
    } catch (err) {
      UI.showToast(err.message || 'Restock update failed.', 'error');
    }
  },

  openWasteLogModal(itemId, name, unit) {
    document.getElementById('waste-item-id').value = itemId;
    document.getElementById('waste-item-name-label').textContent = `${name} (${unit})`;
    document.getElementById('waste-qty-input').value = '';
    document.getElementById('waste-notes-input').value = '';
    UI.openModal('modal-log-waste');
  },

  async submitWasteLog() {
    const itemId = parseInt(document.getElementById('waste-item-id').value);
    const qty = parseFloat(document.getElementById('waste-qty-input').value);
    const reason = document.getElementById('waste-reason-select').value;
    const notes = document.getElementById('waste-notes-input').value;

    if (!qty || qty <= 0) {
      UI.showToast('Please specify wasted quantity.', 'warning');
      return;
    }

    try {
      await API.post('/waste/', {
        inventory_item: itemId,
        quantity_wasted: qty,
        reason: reason,
        notes: notes
      });
      UI.showToast('Food waste logged & inventory adjusted.', 'success');
      UI.closeModal('modal-log-waste');
      this.loadInventory();
      Dashboard.load();
    } catch (err) {
      UI.showToast(err.message || 'Failed to log food waste.', 'error');
    }
  },

  // ═════════════════════════════════════════════════════
  // 5. RESERVATIONS
  // ═════════════════════════════════════════════════════
  async loadReservations() {
    const tbody = document.getElementById('reservations-table-body');
    if (!tbody) return;

    try {
      const data = await API.get('/reservations/');
      const list = data.results || data;

      tbody.innerHTML = list.map(r => `
        <tr>
          <td><div class="text-1 font-bold">${r.customer_name}</div></td>
          <td><span class="text-gold font-bold">${r.num_guests} Guests</span></td>
          <td><span class="badge badge-preparing">Table ${r.table_number || 'Auto-assigned'}</span></td>
          <td><span class="text-2 text-xs font-mono">${new Date(r.reservation_time).toLocaleString()}</span></td>
          <td><span class="badge badge-${r.status}">${r.status_display || r.status}</span></td>
          <td><span class="text-3 text-xs">${r.customer_phone || '—'}</span></td>
          <td>
            ${r.status === 'confirmed' ? `
              <button class="btn btn-danger btn-sm" onclick="App.cancelReservation(${r.id})">Cancel</button>
            ` : ''}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      UI.showToast('Could not load reservations.', 'error');
    }
  },

  async openNewReservationModal() {
    document.getElementById('form-new-reservation').reset();
    try {
      const tablesData = await API.get('/tables/');
      const tables = tablesData.results || tablesData;
      const selectEl = document.getElementById('res-table-select');
      if (selectEl) {
        selectEl.innerHTML = '<option value="">-- Auto Assign Best Table --</option>' +
          tables.map(t => `<option value="${t.id}">Table ${t.table_number} (${t.capacity} seats)</option>`).join('');
      }
      UI.openModal('modal-new-reservation');
    } catch (err) {
      UI.showToast('Could not load tables.', 'error');
    }
  },

  async submitReservation() {
    const name = document.getElementById('res-cust-name').value;
    const phone = document.getElementById('res-cust-phone').value;
    const guests = parseInt(document.getElementById('res-cust-guests').value);
    const dt = document.getElementById('res-cust-datetime').value;
    const tableId = document.getElementById('res-table-select').value;
    const notes = document.getElementById('res-cust-notes').value;

    if (!name || !dt || !guests) {
      UI.showToast('Name, Guest count, and Date/Time are required.', 'warning');
      return;
    }

    const payload = {
      customer_name: name,
      customer_phone: phone,
      num_guests: guests,
      reservation_time: dt,
      special_requests: notes,
      status: 'confirmed'
    };
    if (tableId) payload.table = parseInt(tableId);

    try {
      await API.post('/reservations/', payload);
      UI.showToast('Reservation confirmed and table reserved!', 'success');
      UI.closeModal('modal-new-reservation');
      this.loadReservations();
      Dashboard.load();
    } catch (err) {
      UI.showToast(err.message || 'Reservation conflict or validation error.', 'error');
    }
  },

  async cancelReservation(resId) {
    if (!confirm('Cancel this reservation?')) return;
    try {
      await API.patch(`/reservations/${resId}/`, { status: 'cancelled' });
      UI.showToast('Reservation cancelled and table released.', 'info');
      this.loadReservations();
      Dashboard.load();
    } catch (err) {
      UI.showToast('Failed to cancel reservation.', 'error');
    }
  },

  // ═════════════════════════════════════════════════════
  // 6. FOOD WASTE & SUSTAINABILITY CONSOLE
  // ═════════════════════════════════════════════════════
  async loadWaste() {
    const summaryContainer = document.getElementById('waste-summary-metrics');
    const tableBody = document.getElementById('waste-logs-table-body');

    try {
      const [summary, logsData] = await Promise.all([
        API.get('/waste/summary/'),
        API.get('/waste/')
      ]);

      if (summaryContainer) {
        summaryContainer.innerHTML = `
          <div class="kpi-grid">
            <div class="card-glass kpi-card">
              <div class="kpi-title">Total Loss Cost</div>
              <div class="kpi-value text-rose">$${parseFloat(summary.total_waste_cost || 0).toFixed(2)}</div>
              <div class="kpi-footer">Cumulative logged food waste</div>
            </div>
            <div class="card-glass kpi-card">
              <div class="kpi-title">7-Day Waste Loss</div>
              <div class="kpi-value text-amber">$${parseFloat(summary.weekly_waste_cost || 0).toFixed(2)}</div>
              <div class="kpi-footer">This week's recorded loss</div>
            </div>
            <div class="card-glass kpi-card">
              <div class="kpi-title">Recorded Incidents</div>
              <div class="kpi-value text-blue">${summary.total_entries || 0}</div>
              <div class="kpi-footer">Logged waste entries</div>
            </div>
          </div>
        `;
      }

      if (tableBody) {
        const logs = logsData.results || logsData;
        tableBody.innerHTML = logs.map(l => `
          <tr>
            <td><div class="text-1 font-bold">${l.inventory_item_name}</div></td>
            <td><span class="font-mono text-rose font-bold">${parseFloat(l.quantity_wasted).toFixed(2)} ${l.inventory_item_unit}</span></td>
            <td><span class="badge badge-cancelled">${l.reason_display || l.reason}</span></td>
            <td><span class="text-gold font-bold">$${parseFloat(l.estimated_cost).toFixed(2)}</span></td>
            <td><span class="text-3 text-xs font-mono">${new Date(l.logged_at).toLocaleDateString()}</span></td>
            <td><span class="text-2 text-xs">${l.notes || '—'}</span></td>
          </tr>
        `).join('');
      }
    } catch (err) {
      UI.showToast('Failed to load food waste metrics.', 'error');
    }
  },

  // ═════════════════════════════════════════════════════
  // 7. COMPREHENSIVE REPORTS & ANALYTICS
  // ═════════════════════════════════════════════════════
  async loadReports() {
    const popularContainer = document.getElementById('reports-popular-items-list');

    try {
      const popularData = await API.get('/reports/popular-items/?limit=10');
      const popular = popularData.top_items || [];

      if (popularContainer) {
        const maxQty = Math.max(...popular.map(p => p.total_ordered), 1);
        popularContainer.innerHTML = popular.map((p, idx) => `
          <div class="flex items-center justify-between p-12 card-glass mb-8">
            <div class="flex items-center gap-12">
              <span class="font-mono text-gold font-bold">#0${idx + 1}</span>
              <div>
                <div class="text-1 font-bold text-sm">${p.name}</div>
                <div class="text-3 text-xs uppercase">${p.category}</div>
              </div>
            </div>
            <div class="flex items-center gap-20">
              <span class="text-1 font-bold">${p.total_ordered} Orders</span>
              <span class="text-gold font-bold">$${parseFloat(p.total_revenue).toFixed(2)}</span>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      UI.showToast('Could not load reports.', 'error');
    }
  }
};

// Initialize App on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
