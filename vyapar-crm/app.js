/**
 * ==========================================================
 * VYAPAR CRM & ERP - FRONTEND CORE CONTROLLER
 * Bharat's Smart Business Management Engine
 * Connected REST API Client
 * ==========================================================
 */

const nativeFetch = window.fetch.bind(window);
const loginPage = () => localStorage.getItem('vyapar_login_role') === 'staff' ? 'staff-login.html' : 'login.html';
window.fetch = async (resource, options = {}) => {
    const response = await nativeFetch(resource, { credentials: 'include', ...options });
    if (response.status === 401) window.location.replace(loginPage());
    return response;
};

// Global App Configuration
const VyaparApp = {
    // API Configuration
    getApiUrl() {
        if (window.VYAPAR_API_URL?.trim()) return window.VYAPAR_API_URL.trim().replace(/\/+$/, '');
        const savedUrl = localStorage.getItem('vyapar_api_url');
        if (savedUrl && savedUrl.trim()) {
            return savedUrl.trim().replace(/\/+$/, '');
        }
        // Same-origin backend or reverse proxy. Split-port development can use config.js.
        return `${window.location.origin}/api`;
    },

    setApiUrl(url) {
        localStorage.setItem('vyapar_api_url', url.trim());
        this.checkApiHealth();
    },

    // State
    state: {
        products: [],
        customers: [],
        invoices: [],
        summary: null,
        settings: {
            companyName: 'Vyapar Solutions Pvt Ltd',
            tagline: 'Bharat Smart Business Engine',
            gstin: '27AABCV1234F1Z5',
            phone: '+91 98765 43210',
            email: 'contact@vyaparsolutions.com',
            address: '102, Tech Park, Andheri East, Mumbai, Maharashtra - 400069',
            currency: '₹'
        },
        currentBill: {
            customerId: null,
            customerName: '',
            taxState: 'intrastate', // intrastate (CGST+SGST 9%+9%) or interstate (IGST 18%)
            paymentMode: 'Cash',
            discount: 0,
            notes: '',
            items: [] // { productId, name, hsn, price, qty }
        },
        isOnline: false,
        user: null,
        changeRequests: [],
        accessRequests: [],
        staff: [],
        reviewingRequest: null,
        activeTab: 'dashboard',
        editingProductId: null,
        editingCustomerId: null
    },

    // Initialize Application
    async init() {
        if (!await this.ensureAuthenticated()) return;
        this.bindEvents();
        this.applyRoleInterface();
        await this.checkApiHealth();
        await this.refreshAllData();
        this.renderAll();
        
        // Periodic Health Check every 30s
        setInterval(() => this.checkApiHealth(), 30000);
    },

    async ensureAuthenticated() {
        try {
            const response = await fetch(`${this.getApiUrl()}/auth/me`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Authentication required');
            const data = await response.json();
            localStorage.setItem('vyapar_login_role', data.user.role);
            if (data.user.mustChangePassword || data.user.mustSetPin) {
                window.location.replace(`${data.user.role === 'staff' ? 'staff-login.html' : 'login.html'}?setup=1`);
                return false;
            }
            this.state.user = data.user;
            return true;
        } catch (_) {
            window.location.replace(loginPage());
            return false;
        }
    },

    isAdmin() {
        return this.state.user?.role === 'admin';
    },

    accessModules: {
        inventory: 'Inventory',
        customers: 'Customers',
        billing: 'Billing',
        invoices: 'Invoices',
        settings: 'Settings'
    },

    moduleForChange(meta) {
        if (meta.entityType === 'product') return 'inventory';
        if (meta.entityType === 'customer' || meta.entityType === 'customer_payment') return 'customers';
        if (meta.entityType === 'invoice') return meta.operation === 'create' ? 'billing' : 'invoices';
        if (meta.entityType === 'settings') return 'settings';
        return null;
    },

    hasModuleAccess(module) {
        return this.isAdmin() || Boolean(module && this.state.user?.permissions?.includes(module));
    },

    mutationActionLabel(module, directLabel, requestLabel) {
        return this.hasModuleAccess(module) ? directLabel : requestLabel;
    },

    applyRoleInterface() {
        const user = this.state.user;
        if (!user) return;
        document.querySelectorAll('[data-admin-only]').forEach(element => {
            element.hidden = !this.isAdmin();
        });
        document.querySelectorAll('[data-staff-only]').forEach(element => {
            element.hidden = this.isAdmin();
        });
        const name = document.getElementById('currentUserName');
        const role = document.getElementById('currentUserRole');
        if (name) name.textContent = user.name;
        if (role) role.textContent = user.role;
        document.querySelectorAll('[data-mutation-label]').forEach(element => {
            const module = element.dataset.module;
            const directLabel = element.dataset.directLabel || element.textContent;
            const requestLabel = element.dataset.requestLabel || 'Request Change';
            element.textContent = this.hasModuleAccess(module) ? directLabel : requestLabel;
        });
    },

    async logout() {
        const target = this.state.user?.role === 'staff' ? 'staff-login.html' : 'login.html';
        await fetch(`${this.getApiUrl()}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        }).catch(() => {});
        window.location.replace(target);
    },

    openPasswordSetup() {
        const target = this.state.user?.role === 'staff' ? 'staff-login.html' : 'login.html';
        window.location.href = `${target}?setup=1`;
    },

    submitChangeRequest(payload, requestMeta) {
        return fetch(`${this.getApiUrl()}/change-requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entityType: requestMeta.entityType,
                entityId: requestMeta.entityId ?? null,
                operation: requestMeta.operation,
                payload: payload || {}
            })
        });
    },

    async sendMutation(method, path, payload, requestMeta) {
        const module = this.moduleForChange(requestMeta);
        if (!this.isAdmin()) {
            const userResponse = await fetch(`${this.getApiUrl()}/auth/me`, { cache: 'no-store' });
            if (userResponse.ok) {
                const userData = await userResponse.json();
                if (userData.user) {
                    this.state.user = userData.user;
                    this.applyRoleInterface();
                }
            }
        }
        if (!this.hasModuleAccess(module)) {
            return this.submitChangeRequest(payload, requestMeta);
        }

        const response = await fetch(`${this.getApiUrl()}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: method === 'DELETE' ? undefined : JSON.stringify(payload || {})
        });
        if (this.isAdmin() || response.status !== 403) return response;

        const error = await response.clone().json().catch(() => ({}));
        if (error.code !== 'APPROVAL_REQUIRED') return response;

        this.state.user.permissions = (this.state.user.permissions || []).filter(permission => permission !== module);
        this.applyRoleInterface();
        return this.submitChangeRequest(payload, requestMeta);
    },

    mutationMessage(data, directMessage) {
        return data.requested ? 'Change request sent to an administrator' : directMessage;
    },

    // Event Listeners Binding
    bindEvents() {
        // Tab Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = btn.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });

        // Search inputs
        const prodSearch = document.getElementById('searchProducts');
        if (prodSearch) prodSearch.addEventListener('input', () => this.renderProducts());

        const prodCategoryFilter = document.getElementById('filterCategory');
        if (prodCategoryFilter) prodCategoryFilter.addEventListener('change', () => this.renderProducts());

        const prodStockFilter = document.getElementById('filterStock');
        if (prodStockFilter) prodStockFilter.addEventListener('change', () => this.renderProducts());

        const custSearch = document.getElementById('searchCustomers');
        if (custSearch) custSearch.addEventListener('input', () => this.renderCustomers());

        const invSearch = document.getElementById('searchInvoices');
        if (invSearch) invSearch.addEventListener('input', () => this.renderInvoices());

        const invStatusFilter = document.getElementById('filterInvoiceStatus');
        if (invStatusFilter) invStatusFilter.addEventListener('change', () => this.renderInvoices());

        // POS Inputs
        const billCust = document.getElementById('billCustomer');
        if (billCust) billCust.addEventListener('change', (e) => this.onBillCustomerChange(e.target.value));

        const billProdSelect = document.getElementById('billProductSelect');
        if (billProdSelect) billProdSelect.addEventListener('change', (e) => this.onBillProductSelect(e.target.value));

        const billTaxState = document.getElementById('billTaxState');
        if (billTaxState) billTaxState.addEventListener('change', (e) => {
            this.state.currentBill.taxState = e.target.value;
            this.updateBillTotals();
        });

        const billDiscount = document.getElementById('billDiscount');
        if (billDiscount) billDiscount.addEventListener('input', (e) => {
            this.state.currentBill.discount = parseFloat(e.target.value || 0);
            this.updateBillTotals();
        });

        const billPayMode = document.getElementById('billPaymentMode');
        if (billPayMode) billPayMode.addEventListener('change', (e) => {
            this.state.currentBill.paymentMode = e.target.value;
        });

        // Margin Calculator on Product Price Change
        const pBuy = document.getElementById('prodBuyPrice');
        const pSell = document.getElementById('prodSellPrice');
        if (pBuy && pSell) {
            const updateMargin = () => {
                const buy = parseFloat(pBuy.value || 0);
                const sell = parseFloat(pSell.value || 0);
                const marginEl = document.getElementById('prodMarginPreview');
                if (marginEl && buy > 0 && sell > 0) {
                    const profit = sell - buy;
                    const marginPct = ((profit / sell) * 100).toFixed(1);
                    marginEl.textContent = `Profit: ₹${profit.toFixed(2)} (${marginPct}% margin)`;
                    marginEl.style.color = profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                } else if (marginEl) {
                    marginEl.textContent = '';
                }
            };
            pBuy.addEventListener('input', updateMargin);
            pSell.addEventListener('input', updateMargin);
        }
    },

    // Tab Switching
    switchTab(tabName) {
        this.state.activeTab = tabName;
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        const targetPane = document.getElementById(`${tabName}-tab`);
        const targetBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);

        if (targetPane) targetPane.classList.add('active');
        if (targetBtn) targetBtn.classList.add('active');

        // Refresh views on tab activation
        if (tabName === 'dashboard') this.renderDashboard();
        if (tabName === 'inventory') this.renderProducts();
        if (tabName === 'crm') this.renderCustomers();
        if (tabName === 'billing') this.renderBillingForm();
        if (tabName === 'invoices') this.renderInvoices();
        if (tabName === 'reports') this.renderReports();
        if (tabName === 'requests') Promise.all([this.loadChangeRequests(), this.loadAccessRequests()]);
        if (tabName === 'staff') this.loadStaff();
    },

    // API Health Check
    async checkApiHealth() {
        const statusDot = document.getElementById('apiStatusDot');
        const statusText = document.getElementById('apiStatusText');
        const url = this.getApiUrl();

        try {
            const res = await fetch(`${url}/health`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                this.state.isOnline = true;
                if (statusDot) {
                    statusDot.className = 'status-dot online';
                }
                if (statusText) {
                    statusText.textContent = `API Connected (${data.databaseEngine.toUpperCase()})`;
                }
                return true;
            }
            throw new Error('API responded with non-200');
        } catch (err) {
            this.state.isOnline = false;
            if (statusDot) {
                statusDot.className = 'status-dot offline';
            }
            if (statusText) {
                statusText.textContent = 'API Offline';
            }
            return false;
        }
    },

    // Refresh Data from Backend API
    async refreshAllData() {
        const url = this.getApiUrl();
        try {
            const [products, customers, invoices, summary, settings, changeRequests, accessRequests] = await Promise.all([
                fetch(`${url}/products`).then(r => r.json()).catch(() => []),
                fetch(`${url}/customers`).then(r => r.json()).catch(() => []),
                fetch(`${url}/invoices`).then(r => r.json()).catch(() => []),
                fetch(`${url}/reports/summary`).then(r => r.json()).catch(() => null),
                fetch(`${url}/settings`).then(r => r.json()).catch(() => null),
                fetch(`${url}/change-requests`).then(r => r.json()).catch(() => []),
                fetch(`${url}/access-requests`).then(r => r.json()).catch(() => [])
            ]);

            this.state.products = Array.isArray(products) ? products : [];
            this.state.customers = Array.isArray(customers) ? customers : [];
            this.state.invoices = Array.isArray(invoices) ? invoices : [];
            this.state.summary = summary;
            this.state.changeRequests = Array.isArray(changeRequests) ? changeRequests : [];
            this.state.accessRequests = Array.isArray(accessRequests) ? accessRequests : [];
            if (settings && settings.company_name) {
                this.state.settings = {
                    companyName: settings.company_name,
                    tagline: settings.tagline,
                    gstin: settings.gstin,
                    phone: settings.phone,
                    email: settings.email,
                    address: settings.address,
                    currency: settings.currency || '₹'
                };
            }
        } catch (err) {
            console.error('Error fetching data from API:', err);
            this.showToast('Unable to load latest data from API server', 'error');
        }
    },

    // Render Master Method
    renderAll() {
        this.applyRoleInterface();
        this.renderDashboard();
        this.renderProducts();
        this.renderCustomers();
        this.renderBillingForm();
        this.renderInvoices();
        this.renderReports();
        this.renderChangeRequests();
        this.renderAccessRequests();
    },

    // ==========================================================
    // 1. DASHBOARD MODULE
    // ==========================================================
    renderDashboard() {
        const summary = this.state.summary;
        const totalRevenue = summary ? summary.totalRevenue : this.state.invoices.reduce((s, i) => s + (i.total || 0), 0);
        const pendingReceivables = summary ? summary.pendingReceivables : this.state.invoices.filter(i => i.status === 'Pending').reduce((s, i) => s + (i.total || 0), 0);
        const lowStockCount = summary ? summary.lowStockCount : this.state.products.filter(p => (p.stock || 0) < 5).length;
        const totalCustomers = summary ? summary.customerCount : this.state.customers.length;

        const elRev = document.getElementById('dashTotalRevenue');
        if (elRev) elRev.textContent = this.formatCurrency(totalRevenue);

        const elPending = document.getElementById('dashPendingReceivables');
        if (elPending) elPending.textContent = this.formatCurrency(pendingReceivables);

        const elLowStock = document.getElementById('dashLowStock');
        if (elLowStock) elLowStock.textContent = lowStockCount;

        const elCust = document.getElementById('dashTotalCustomers');
        if (elCust) elCust.textContent = totalCustomers;

        // Render Sales Chart
        this.renderSalesChart();

        // Render Recent Invoices
        const tbody = document.getElementById('dashRecentInvoices');
        if (tbody) {
            const recent = [...this.state.invoices].slice(0, 5);
            if (recent.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="empty-placeholder"><div class="icon">📄</div>No invoices created yet.</td></tr>`;
            } else {
                tbody.innerHTML = recent.map(inv => `
                    <tr>
                        <td><strong>${inv.id}</strong></td>
                        <td>${this.escapeHtml(inv.customerName)}</td>
                        <td><strong>${this.formatCurrency(inv.total)}</strong></td>
                        <td><span class="badge ${inv.status === 'Paid' ? 'badge-paid' : 'badge-pending'}">${inv.status}</span></td>
                        <td>${this.formatDate(inv.createdAt)}</td>
                        <td>
                            <button class="btn btn-secondary btn-sm" onclick="VyaparApp.viewInvoiceModal('${inv.id}')">View</button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    },

    renderSalesChart() {
        const chartContainer = document.getElementById('dashSalesChart');
        if (!chartContainer) return;

        const chartData = this.state.summary && this.state.summary.salesChart
            ? this.state.summary.salesChart
            : this.calculateFallbackSalesChart();

        const maxRev = Math.max(...chartData.map(d => d.revenue), 1000);

        chartContainer.innerHTML = chartData.map(d => {
            const heightPct = Math.max(8, (d.revenue / maxRev) * 100);
            const dateObj = new Date(d.date);
            const dayName = isNaN(dateObj.getTime()) ? d.date : dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });

            return `
                <div class="chart-bar-group">
                    <div class="chart-tooltip">${this.formatCurrency(d.revenue)} (${d.count || 0} bills)</div>
                    <div class="chart-bar" style="height: ${heightPct}%;"></div>
                    <div class="chart-label">${dayName}</div>
                </div>
            `;
        }).join('');
    },

    calculateFallbackSalesChart() {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            days.push({ date: dateStr, revenue: 0, count: 0 });
        }
        for (const inv of this.state.invoices) {
            const dStr = (inv.createdAt || '').split('T')[0];
            const match = days.find(x => x.date === dStr);
            if (match) {
                match.revenue += (inv.total || 0);
                match.count += 1;
            }
        }
        return days;
    },

    // ==========================================================
    // 2. INVENTORY MODULE
    // ==========================================================
    renderProducts() {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;

        const search = (document.getElementById('searchProducts')?.value || '').toLowerCase().trim();
        const categoryFilter = document.getElementById('filterCategory')?.value || 'ALL';
        const stockFilter = document.getElementById('filterStock')?.value || 'ALL';

        let list = this.state.products.filter(p => {
            const matchQuery = p.name.toLowerCase().includes(search) ||
                               p.sku.toLowerCase().includes(search) ||
                               p.hsn.toLowerCase().includes(search) ||
                               (p.category || '').toLowerCase().includes(search);
            
            const matchCategory = categoryFilter === 'ALL' || (p.category || 'General') === categoryFilter;
            
            let matchStock = true;
            if (stockFilter === 'LOW') matchStock = (p.stock || 0) < 5;
            if (stockFilter === 'IN_STOCK') matchStock = (p.stock || 0) >= 5;
            if (stockFilter === 'OUT_OF_STOCK') matchStock = (p.stock || 0) === 0;

            return matchQuery && matchCategory && matchStock;
        });

        // Update Category Dropdown options dynamically
        this.updateCategoryOptions();

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="empty-placeholder"><div class="icon">📦</div>No products found matching your search.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(p => {
            const isLowStock = (p.stock || 0) < 5;
            const margin = p.sellingPrice > 0 ? (((p.sellingPrice - p.purchasePrice) / p.sellingPrice) * 100).toFixed(1) : 0;

            return `
                <tr>
                    <td>
                        <strong>${this.escapeHtml(p.name)}</strong>
                        <div style="font-size:11px;color:var(--text-muted);">${p.category || 'General'}</div>
                    </td>
                    <td><span style="font-family:monospace;font-weight:600;">${p.hsn}</span></td>
                    <td><span class="badge badge-category">${p.sku}</span></td>
                    <td>${this.formatCurrency(p.purchasePrice)}</td>
                    <td><strong>${this.formatCurrency(p.sellingPrice)}</strong></td>
                    <td>
                        <span style="font-size:12px;font-weight:700;color:${margin >= 20 ? 'var(--accent-green)' : 'var(--accent-gold)'};">
                            ${margin}%
                        </span>
                    </td>
                    <td>
                        <span style="font-weight:700;margin-right:6px;">${p.stock}</span>
                        <span class="badge ${isLowStock ? 'badge-low-stock' : 'badge-in-stock'}">
                            ${isLowStock ? '⚠️ Low Stock' : 'In Stock'}
                        </span>
                    </td>
                    <td>
                        <div style="display:flex;gap:6px;">
                            <button class="btn btn-secondary btn-sm" onclick="VyaparApp.editProductModal(${p.id})">✏️ Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="VyaparApp.deleteProduct(${p.id})">${this.mutationActionLabel('inventory', '🗑️', 'Request Delete')}</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    updateCategoryOptions() {
        const catSelect = document.getElementById('filterCategory');
        if (!catSelect) return;

        const currentVal = catSelect.value;
        const categories = Array.from(new Set(this.state.products.map(p => p.category || 'General'))).sort();

        catSelect.innerHTML = `<option value="ALL">All Categories</option>` +
            categories.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join('');
    },

    openAddProductModal() {
        this.state.editingProductId = null;
        document.getElementById('modalProductTitle').textContent = 'Add New Product';
        document.getElementById('prodName').value = '';
        document.getElementById('prodHSN').value = '';
        document.getElementById('prodSKU').value = 'PRD-' + Math.floor(100 + Math.random() * 900);
        document.getElementById('prodCategory').value = 'Hardware';
        document.getElementById('prodBuyPrice').value = '';
        document.getElementById('prodSellPrice').value = '';
        document.getElementById('prodStock').value = '10';
        document.getElementById('prodMarginPreview').textContent = '';
        this.openModal('modalProduct');
    },

    editProductModal(id) {
        const p = this.state.products.find(x => x.id === id);
        if (!p) return;
        this.state.editingProductId = id;
        document.getElementById('modalProductTitle').textContent = 'Edit Product';
        document.getElementById('prodName').value = p.name;
        document.getElementById('prodHSN').value = p.hsn;
        document.getElementById('prodSKU').value = p.sku;
        document.getElementById('prodCategory').value = p.category || 'General';
        document.getElementById('prodBuyPrice').value = p.purchasePrice;
        document.getElementById('prodSellPrice').value = p.sellingPrice;
        document.getElementById('prodStock').value = p.stock;
        
        const buy = parseFloat(p.purchasePrice || 0);
        const sell = parseFloat(p.sellingPrice || 0);
        const marginEl = document.getElementById('prodMarginPreview');
        if (marginEl && buy > 0 && sell > 0) {
            const profit = sell - buy;
            const marginPct = ((profit / sell) * 100).toFixed(1);
            marginEl.textContent = `Profit: ₹${profit.toFixed(2)} (${marginPct}% margin)`;
        }

        this.openModal('modalProduct');
    },

    async saveProductForm() {
        const name = document.getElementById('prodName').value.trim();
        const hsn = document.getElementById('prodHSN').value.trim();
        const sku = document.getElementById('prodSKU').value.trim();
        const category = document.getElementById('prodCategory').value.trim();
        const purchasePrice = parseFloat(document.getElementById('prodBuyPrice').value || 0);
        const sellingPrice = parseFloat(document.getElementById('prodSellPrice').value || 0);
        const stock = parseInt(document.getElementById('prodStock').value || 0);

        if (!name || !hsn || !sku) {
            this.showToast('Please fill Product Name, HSN code, and SKU', 'error');
            return;
        }

        const payload = { name, hsn, sku, category, purchasePrice, sellingPrice, stock };

        try {
            const isUpdate = Boolean(this.state.editingProductId);
            const res = await this.sendMutation(
                isUpdate ? 'PUT' : 'POST',
                isUpdate ? `/products/${this.state.editingProductId}` : '/products',
                payload,
                { entityType: 'product', entityId: this.state.editingProductId, operation: isUpdate ? 'update' : 'create' }
            );

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save product');

            this.showToast(this.mutationMessage(data, isUpdate ? 'Product updated successfully!' : 'Product added successfully!'), 'success');
            this.closeModal('modalProduct');
            await this.refreshAllData();
            this.renderProducts();
            this.renderBillingForm();
            this.renderDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async deleteProduct(id) {
        if (!confirm('Are you sure you want to delete this product?')) return;

        try {
            const res = await this.sendMutation('DELETE', `/products/${id}`, {}, { entityType: 'product', entityId: id, operation: 'delete' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete product');
            this.showToast(this.mutationMessage(data, 'Product deleted'), 'success');
            await this.refreshAllData();
            this.renderProducts();
            this.renderBillingForm();
            this.renderDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // ==========================================================
    // 3. CUSTOMER CRM MODULE
    // ==========================================================
    renderCustomers() {
        const tbody = document.getElementById('customersTableBody');
        if (!tbody) return;

        const search = (document.getElementById('searchCustomers')?.value || '').toLowerCase().trim();

        const list = this.state.customers.filter(c => {
            return c.name.toLowerCase().includes(search) ||
                   c.mobile.includes(search) ||
                   (c.city || '').toLowerCase().includes(search) ||
                   (c.state || '').toLowerCase().includes(search) ||
                   (c.gstin || '').toLowerCase().includes(search);
        });

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-placeholder"><div class="icon">👥</div>No customers found matching search.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(c => {
            const hasDue = (c.outstandingBalance || 0) > 0;
            const cleanPhone = (c.mobile || '').replace(/[^0-9]/g, '');

            return `
                <tr>
                    <td>
                        <strong>${this.escapeHtml(c.name)}</strong>
                        <div style="font-size:11px;color:var(--text-muted);">${c.email || 'No email'}</div>
                    </td>
                    <td>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span>${c.mobile}</span>
                            ${cleanPhone ? `
                                <a href="https://api.whatsapp.com/send?phone=${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}&text=Dear%20${encodeURIComponent(c.name)},%20Greetings%20from%20Vyapar!" 
                                   target="_blank" 
                                   title="Chat on WhatsApp"
                                   style="text-decoration:none;font-size:14px;">
                                   💬
                                </a>
                            ` : ''}
                        </div>
                    </td>
                    <td>${this.escapeHtml(c.city || '')}${c.state ? ', ' + this.escapeHtml(c.state) : ''}</td>
                    <td><span style="font-family:monospace;font-size:11.5px;">${c.gstin || 'Unregistered'}</span></td>
                    <td>${this.formatCurrency(c.totalPurchased)}</td>
                    <td>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-weight:700;color:${hasDue ? 'var(--accent-red)' : 'var(--accent-green)'};">
                                ${this.formatCurrency(c.outstandingBalance)}
                            </span>
                            ${hasDue ? `
                                <button class="btn btn-success btn-sm" style="padding:2px 8px;font-size:11px;" onclick="VyaparApp.openSettlePaymentModal(${c.id})">Collect</button>
                            ` : ''}
                        </div>
                    </td>
                    <td>
                        <div style="display:flex;gap:6px;">
                            <button class="btn btn-secondary btn-sm" onclick="VyaparApp.editCustomerModal(${c.id})">✏️ Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="VyaparApp.deleteCustomer(${c.id})">${this.mutationActionLabel('customers', '🗑️', 'Request Delete')}</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    openAddCustomerModal() {
        this.state.editingCustomerId = null;
        document.getElementById('modalCustomerTitle').textContent = 'Add New Customer';
        document.getElementById('custName').value = '';
        document.getElementById('custMobile').value = '+91 ';
        document.getElementById('custCity').value = '';
        document.getElementById('custState').value = 'Maharashtra';
        document.getElementById('custGSTIN').value = '';
        document.getElementById('custEmail').value = '';
        this.openModal('modalCustomer');
    },

    editCustomerModal(id) {
        const c = this.state.customers.find(x => x.id === id);
        if (!c) return;
        this.state.editingCustomerId = id;
        document.getElementById('modalCustomerTitle').textContent = 'Edit Customer';
        document.getElementById('custName').value = c.name;
        document.getElementById('custMobile').value = c.mobile;
        document.getElementById('custCity').value = c.city || '';
        document.getElementById('custState').value = c.state || '';
        document.getElementById('custGSTIN').value = c.gstin || '';
        document.getElementById('custEmail').value = c.email || '';
        this.openModal('modalCustomer');
    },

    async saveCustomerForm() {
        const name = document.getElementById('custName').value.trim();
        const mobile = document.getElementById('custMobile').value.trim();
        const city = document.getElementById('custCity').value.trim();
        const state = document.getElementById('custState').value.trim();
        const gstin = document.getElementById('custGSTIN').value.trim().toUpperCase();
        const email = document.getElementById('custEmail').value.trim();

        if (!name || !mobile) {
            this.showToast('Customer Name and Mobile number are required', 'error');
            return;
        }

        const payload = { name, mobile, city, state, gstin, email };

        try {
            const isUpdate = Boolean(this.state.editingCustomerId);
            const res = await this.sendMutation(
                isUpdate ? 'PUT' : 'POST',
                isUpdate ? `/customers/${this.state.editingCustomerId}` : '/customers',
                payload,
                { entityType: 'customer', entityId: this.state.editingCustomerId, operation: isUpdate ? 'update' : 'create' }
            );

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save customer');

            this.showToast(this.mutationMessage(data, isUpdate ? 'Customer updated!' : 'Customer added successfully!'), 'success');
            this.closeModal('modalCustomer');
            await this.refreshAllData();
            this.renderCustomers();
            this.renderBillingForm();
            this.renderDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    openSettlePaymentModal(customerId) {
        const c = this.state.customers.find(x => x.id === customerId);
        if (!c) return;

        document.getElementById('settleCustomerName').textContent = c.name;
        document.getElementById('settleDueAmount').textContent = this.formatCurrency(c.outstandingBalance);
        document.getElementById('settleAmountInput').value = c.outstandingBalance;
        document.getElementById('settleCustomerId').value = c.id;

        this.openModal('modalSettlePayment');
    },

    async submitSettlePayment() {
        const customerId = parseInt(document.getElementById('settleCustomerId').value);
        const amount = parseFloat(document.getElementById('settleAmountInput').value || 0);

        if (amount <= 0) {
            this.showToast('Please enter a valid payment amount', 'error');
            return;
        }

        try {
            const res = await this.sendMutation('POST', `/customers/${customerId}/payment`, { amount }, { entityType: 'customer_payment', entityId: customerId, operation: 'create' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to record payment');

            this.showToast(this.mutationMessage(data, `Recorded payment of ${this.formatCurrency(amount)} successfully!`), 'success');
            this.closeModal('modalSettlePayment');
            await this.refreshAllData();
            this.renderCustomers();
            this.renderDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async deleteCustomer(id) {
        if (!confirm('Are you sure you want to delete this customer?')) return;

        try {
            const res = await this.sendMutation('DELETE', `/customers/${id}`, {}, { entityType: 'customer', entityId: id, operation: 'delete' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete customer');
            this.showToast(this.mutationMessage(data, 'Customer deleted'), 'success');
            await this.refreshAllData();
            this.renderCustomers();
            this.renderBillingForm();
            this.renderDashboard();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // ==========================================================
    // 4. POS FAST BILLING TERMINAL
    // ==========================================================
    renderBillingForm() {
        // Populate Customers Dropdown
        const custSelect = document.getElementById('billCustomer');
        if (custSelect) {
            custSelect.innerHTML = `<option value="">-- Select Customer (or create new) --</option>` +
                this.state.customers.map(c => `
                    <option value="${c.id}" ${this.state.currentBill.customerId === c.id ? 'selected' : ''}>
                        ${this.escapeHtml(c.name)} (${c.mobile}) ${c.outstandingBalance > 0 ? '[Due: ₹' + c.outstandingBalance + ']' : ''}
                    </option>
                `).join('');
        }

        // Populate Products Dropdown
        const prodSelect = document.getElementById('billProductSelect');
        if (prodSelect) {
            prodSelect.innerHTML = `<option value="">+ Choose Product to Add to Bill...</option>` +
                this.state.products.map(p => `
                    <option value="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
                        ${this.escapeHtml(p.name)} - ${this.formatCurrency(p.sellingPrice)} (Stock: ${p.stock})
                    </option>
                `).join('');
        }

        this.renderBillItems();
    },

    onBillCustomerChange(val) {
        const custId = parseInt(val || 0);
        this.state.currentBill.customerId = custId;
        const cust = this.state.customers.find(c => c.id === custId);
        if (cust) {
            this.state.currentBill.customerName = cust.name;
            // Auto detect interstate
            if (cust.state && !cust.state.toLowerCase().includes('maharashtra')) {
                this.state.currentBill.taxState = 'interstate';
                const el = document.getElementById('billTaxState');
                if (el) el.value = 'interstate';
            } else {
                this.state.currentBill.taxState = 'intrastate';
                const el = document.getElementById('billTaxState');
                if (el) el.value = 'intrastate';
            }
        }
        this.updateBillTotals();
    },

    onBillProductSelect(val) {
        const prodId = parseInt(val || 0);
        if (!prodId) return;

        const prod = this.state.products.find(p => p.id === prodId);
        if (!prod) return;

        // Check if item already exists in bill
        const existing = this.state.currentBill.items.find(i => i.productId === prodId);
        if (existing) {
            if (existing.qty < prod.stock) {
                existing.qty++;
            } else {
                this.showToast(`Cannot add more than available stock (${prod.stock})`, 'error');
            }
        } else {
            this.state.currentBill.items.push({
                productId: prod.id,
                name: prod.name,
                hsn: prod.hsn,
                price: prod.sellingPrice,
                qty: 1,
                maxStock: prod.stock
            });
        }

        // Reset selector
        const selectEl = document.getElementById('billProductSelect');
        if (selectEl) selectEl.value = '';

        this.renderBillItems();
    },

    renderBillItems() {
        const tbody = document.getElementById('billItemsTableBody');
        if (!tbody) return;

        if (this.state.currentBill.items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-placeholder"><div class="icon">🛒</div>Bill cart is empty. Add products from above.</td></tr>`;
            this.updateBillTotals();
            return;
        }

        tbody.innerHTML = this.state.currentBill.items.map((item, idx) => {
            const lineTotal = item.price * item.qty;
            return `
                <tr>
                    <td>
                        <strong>${this.escapeHtml(item.name)}</strong>
                        <div style="font-size:11px;color:var(--text-muted);">HSN: ${item.hsn}</div>
                    </td>
                    <td>
                        <input type="number" 
                               value="${item.price}" 
                               step="0.01" 
                               style="width:90px;" 
                               class="form-control" 
                               onchange="VyaparApp.updateBillItemPrice(${idx}, this.value)">
                    </td>
                    <td>
                        <div class="qty-control">
                            <button type="button" class="qty-btn" onclick="VyaparApp.adjustBillQty(${idx}, -1)">−</button>
                            <input type="text" class="qty-input" value="${item.qty}" readonly>
                            <button type="button" class="qty-btn" onclick="VyaparApp.adjustBillQty(${idx}, 1)">+</button>
                        </div>
                    </td>
                    <td><strong>${this.formatCurrency(lineTotal)}</strong></td>
                    <td>
                        <button type="button" class="btn btn-danger btn-sm btn-icon" onclick="VyaparApp.removeBillItem(${idx})">×</button>
                    </td>
                </tr>
            `;
        }).join('');

        this.updateBillTotals();
    },

    adjustBillQty(idx, delta) {
        const item = this.state.currentBill.items[idx];
        if (!item) return;

        const newQty = item.qty + delta;
        if (newQty <= 0) {
            this.removeBillItem(idx);
            return;
        }
        if (item.maxStock && newQty > item.maxStock) {
            this.showToast(`Max available stock is ${item.maxStock}`, 'error');
            return;
        }
        item.qty = newQty;
        this.renderBillItems();
    },

    updateBillItemPrice(idx, newPrice) {
        const item = this.state.currentBill.items[idx];
        if (!item) return;
        item.price = Math.max(0, parseFloat(newPrice || 0));
        this.updateBillTotals();
    },

    removeBillItem(idx) {
        this.state.currentBill.items.splice(idx, 1);
        this.renderBillItems();
    },

    updateBillTotals() {
        const items = this.state.currentBill.items;
        const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0);
        const discount = Math.min(subtotal, Math.max(0, this.state.currentBill.discount || 0));
        const taxableAmount = Math.max(0, subtotal - discount);

        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (this.state.currentBill.taxState === 'intrastate') {
            cgst = taxableAmount * 0.09;
            sgst = taxableAmount * 0.09;
        } else {
            igst = taxableAmount * 0.18;
        }

        const totalGST = cgst + sgst + igst;
        const grandTotal = taxableAmount + totalGST;

        // Update DOM
        const elSubtotal = document.getElementById('summarySubtotal');
        if (elSubtotal) elSubtotal.textContent = this.formatCurrency(subtotal);

        const elTaxTypeLabel = document.getElementById('summaryTaxLabel');
        if (elTaxTypeLabel) {
            elTaxTypeLabel.textContent = this.state.currentBill.taxState === 'intrastate' ? 'CGST (9%) + SGST (9%):' : 'IGST (18%):';
        }

        const elGST = document.getElementById('summaryGST');
        if (elGST) elGST.textContent = this.formatCurrency(totalGST);

        const elGrandTotal = document.getElementById('summaryGrandTotal');
        if (elGrandTotal) elGrandTotal.textContent = this.formatCurrency(grandTotal);
    },

    resetBill() {
        this.state.currentBill = {
            customerId: null,
            customerName: '',
            taxState: 'intrastate',
            paymentMode: 'Cash',
            discount: 0,
            notes: '',
            items: []
        };
        const custSelect = document.getElementById('billCustomer');
        if (custSelect) custSelect.value = '';
        const discInput = document.getElementById('billDiscount');
        if (discInput) discInput.value = '0';
        const notesInput = document.getElementById('billNotes');
        if (notesInput) notesInput.value = '';

        this.renderBillItems();
        this.showToast('Bill terminal reset', 'info');
    },

    async generateBill() {
        const bill = this.state.currentBill;
        if (bill.items.length === 0) {
            this.showToast('Please add at least one product to the bill', 'error');
            return;
        }

        let customerId = bill.customerId;
        let customerName = bill.customerName;

        if (!customerId) {
            const manualName = document.getElementById('billCustomerNew')?.value.trim();
            if (!manualName) {
                this.showToast('Please select an existing customer or enter a new customer name', 'error');
                return;
            }
            customerName = manualName;
        }

        const subtotal = bill.items.reduce((s, i) => s + (i.price * i.qty), 0);
        const discount = Math.min(subtotal, Math.max(0, bill.discount || 0));
        const taxable = subtotal - discount;

        let cgst = 0, sgst = 0, igst = 0;
        if (bill.taxState === 'intrastate') {
            cgst = taxable * 0.09;
            sgst = taxable * 0.09;
        } else {
            igst = taxable * 0.18;
        }

        const total = taxable + cgst + sgst + igst;
        const paymentMode = document.getElementById('billPaymentMode')?.value || 'Cash';
        const status = paymentMode === 'Credit' ? 'Pending' : 'Paid';
        const notes = document.getElementById('billNotes')?.value || '';

        const payload = {
            customerId,
            customerName,
            items: bill.items,
            subtotal,
            cgst,
            sgst,
            igst,
            discount,
            total,
            status,
            taxState: bill.taxState,
            paymentMode,
            notes
        };

        try {
            const res = await this.sendMutation('POST', '/invoices', payload, { entityType: 'invoice', entityId: null, operation: 'create' });

            const invoice = await res.json();
            if (!res.ok) throw new Error(invoice.error || 'Failed to create invoice');

            if (invoice.requested) {
                this.showToast('Invoice request sent to an administrator', 'success');
                this.resetBill();
                await this.loadChangeRequests();
                return;
            }

            this.playBillChime();
            this.showToast(`Invoice ${invoice.id} generated successfully!`, 'success');
            
            // View & Print modal automatically
            this.resetBill();
            await this.refreshAllData();
            this.renderAll();
            this.viewInvoiceModal(invoice.id);
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // ==========================================================
    // 5. INVOICES MODULE
    // ==========================================================
    renderInvoices() {
        const tbody = document.getElementById('invoicesTableBody');
        if (!tbody) return;

        const search = (document.getElementById('searchInvoices')?.value || '').toLowerCase().trim();
        const statusFilter = document.getElementById('filterInvoiceStatus')?.value || 'ALL';

        const list = this.state.invoices.filter(inv => {
            const matchQuery = inv.id.toLowerCase().includes(search) ||
                               inv.customerName.toLowerCase().includes(search);
            const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
            return matchQuery && matchStatus;
        });

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-placeholder"><div class="icon">📄</div>No invoices found.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(inv => {
            const taxTotal = (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0);

            return `
                <tr>
                    <td><strong>${inv.id}</strong></td>
                    <td>${this.escapeHtml(inv.customerName)}</td>
                    <td>${this.formatDate(inv.createdAt)}</td>
                    <td><span class="badge badge-category">${inv.paymentMode || 'Cash'}</span></td>
                    <td>${this.formatCurrency(taxTotal)}</td>
                    <td><strong>${this.formatCurrency(inv.total)}</strong></td>
                    <td>
                        <span class="badge ${inv.status === 'Paid' ? 'badge-paid' : 'badge-pending'}" 
                              style="cursor:pointer;" 
                              title="Click to toggle status"
                              onclick="VyaparApp.toggleInvoiceStatus('${inv.id}', '${inv.status}')">
                            ${inv.status} 🔄
                        </span>
                    </td>
                    <td>
                        <div style="display:flex;gap:6px;">
                            <button class="btn btn-primary btn-sm" onclick="VyaparApp.viewInvoiceModal('${inv.id}')">🖨️ View / Print</button>
                            <button class="btn btn-danger btn-sm" onclick="VyaparApp.deleteInvoice('${inv.id}')">${this.mutationActionLabel('invoices', '🗑️', 'Request Delete')}</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async toggleInvoiceStatus(invoiceId, currentStatus) {
        const newStatus = currentStatus === 'Paid' ? 'Pending' : 'Paid';

        try {
            const res = await this.sendMutation('PUT', `/invoices/${invoiceId}/status`, { status: newStatus }, { entityType: 'invoice', entityId: invoiceId, operation: 'update_status' });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update status');

            this.showToast(this.mutationMessage(data, `Invoice status updated to ${newStatus}`), 'success');
            await this.refreshAllData();
            this.renderAll();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async viewInvoiceModal(invoiceId) {
        const url = this.getApiUrl();
        let inv = this.state.invoices.find(i => i.id === invoiceId);

        try {
            const res = await fetch(`${url}/invoices/${invoiceId}`);
            if (res.ok) {
                inv = await res.json();
            }
        } catch (e) {
            console.warn('Using local invoice cache');
        }

        if (!inv) return;

        const previewContainer = document.getElementById('gstInvoicePrintArea');
        if (!previewContainer) return;

        const subtotal = inv.subtotal || 0;
        const discount = inv.discount || 0;
        const taxable = subtotal - discount;
        const cgst = inv.cgst || 0;
        const sgst = inv.sgst || 0;
        const igst = inv.igst || 0;
        const total = inv.total || 0;
        const totalWords = this.numberToWords(Math.round(total));

        previewContainer.innerHTML = `
            <div class="gst-invoice-preview">
                <!-- Header -->
                <div class="inv-header">
                    <div>
                        <div class="inv-company-name">${this.escapeHtml(this.state.settings.companyName)}</div>
                        <div style="color:#4B5563;font-size:11px;">${this.escapeHtml(this.state.settings.tagline)}</div>
                        <div style="color:#4B5563;margin-top:4px;">${this.escapeHtml(this.state.settings.address)}</div>
                        <div style="color:#4B5563;"><strong>GSTIN:</strong> ${this.state.settings.gstin} | <strong>Phone:</strong> ${this.state.settings.phone}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="inv-badge-title">TAX INVOICE / बीजक</div>
                        <div style="font-size:14px;font-weight:800;color:#D97706;margin-top:4px;"># ${inv.id}</div>
                        <div style="color:#4B5563;font-size:11.5px;"><strong>Date:</strong> ${this.formatDate(inv.createdAt)}</div>
                        <div style="color:#4B5563;font-size:11.5px;"><strong>Status:</strong> ${inv.status.toUpperCase()} (${inv.paymentMode || 'Cash'})</div>
                    </div>
                </div>

                <!-- Billed To Details -->
                <div class="inv-grid-2">
                    <div>
                        <div style="font-size:10px;text-transform:uppercase;font-weight:700;color:#6B7280;margin-bottom:4px;">Billed To / ग्राहक विवरण</div>
                        <div style="font-size:13px;font-weight:700;color:#111827;">${this.escapeHtml(inv.customerName)}</div>
                        <div style="color:#4B5563;">${inv.customerDetails ? (inv.customerDetails.city + ', ' + inv.customerDetails.state) : ''}</div>
                        <div style="color:#4B5563;"><strong>Phone:</strong> ${inv.customerDetails?.mobile || 'N/A'}</div>
                        <div style="color:#4B5563;"><strong>GSTIN:</strong> ${inv.customerDetails?.gstin || 'Unregistered Consumer'}</div>
                    </div>
                    <div>
                        <div style="font-size:10px;text-transform:uppercase;font-weight:700;color:#6B7280;margin-bottom:4px;">Invoice Metadata</div>
                        <div style="color:#4B5563;"><strong>Supply State:</strong> ${inv.taxState === 'intrastate' ? 'Intrastate (Within State)' : 'Interstate (Out of State)'}</div>
                        <div style="color:#4B5563;"><strong>Payment Mode:</strong> ${inv.paymentMode || 'Cash'}</div>
                        <div style="color:#4B5563;"><strong>Remarks:</strong> ${inv.notes || 'Goods sold are non-returnable.'}</div>
                    </div>
                </div>

                <!-- Line Items Table -->
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th style="width:30px;">#</th>
                            <th>Item Description</th>
                            <th style="width:70px;">HSN</th>
                            <th style="width:60px;text-align:center;">Qty</th>
                            <th style="width:90px;text-align:right;">Unit Price</th>
                            <th style="width:100px;text-align:right;">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(inv.items || []).map((item, idx) => `
                            <tr>
                                <td style="text-align:center;">${idx + 1}</td>
                                <td><strong>${this.escapeHtml(item.name)}</strong></td>
                                <td style="font-family:monospace;">${item.hsn}</td>
                                <td style="text-align:center;">${item.qty}</td>
                                <td style="text-align:right;">₹${parseFloat(item.price).toFixed(2)}</td>
                                <td style="text-align:right;font-weight:700;">₹${(parseFloat(item.price) * parseInt(item.qty)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <!-- Summary & Totals -->
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:14px;">
                    <div style="max-width:320px;">
                        <div style="font-size:11px;color:#4B5563;margin-bottom:6px;"><strong>Amount in Words:</strong></div>
                        <div style="font-size:11.5px;font-style:italic;font-weight:600;color:#1F2937;">${totalWords}</div>
                    </div>

                    <div class="inv-totals-box">
                        <div class="inv-total-row"><span>Item Subtotal:</span> <span>₹${subtotal.toFixed(2)}</span></div>
                        ${discount > 0 ? `<div class="inv-total-row" style="color:#DC2626;"><span>Discount:</span> <span>-₹${discount.toFixed(2)}</span></div>` : ''}
                        <div class="inv-total-row"><span>Taxable Value:</span> <span>₹${taxable.toFixed(2)}</span></div>
                        ${cgst > 0 ? `<div class="inv-total-row"><span>CGST (9%):</span> <span>₹${cgst.toFixed(2)}</span></div>` : ''}
                        ${sgst > 0 ? `<div class="inv-total-row"><span>SGST (9%):</span> <span>₹${sgst.toFixed(2)}</span></div>` : ''}
                        ${igst > 0 ? `<div class="inv-total-row"><span>IGST (18%):</span> <span>₹${igst.toFixed(2)}</span></div>` : ''}
                        <div class="inv-total-row grand"><span>Total Payable:</span> <span>₹${total.toFixed(2)}</span></div>
                    </div>
                </div>

                <!-- Footer & Authorized Signature -->
                <div class="inv-footer">
                    <div style="font-size:10.5px;color:#6B7280;">
                        Thank you for your business! | This is a computer generated invoice.
                    </div>
                    <div class="inv-sign-box">
                        For ${this.escapeHtml(this.state.settings.companyName)}<br><br>
                        <strong>Authorized Signatory</strong>
                    </div>
                </div>
            </div>
        `;

        this.openModal('modalInvoiceView');
    },

    async deleteInvoice(invoiceId) {
        if (!confirm(`Are you sure you want to delete Invoice ${invoiceId}? Product inventory will be automatically restored.`)) return;

        try {
            const res = await this.sendMutation('DELETE', `/invoices/${invoiceId}`, {}, { entityType: 'invoice', entityId: invoiceId, operation: 'delete' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete invoice');

            this.showToast(this.mutationMessage(data, `Invoice ${invoiceId} deleted and inventory restored`), 'success');
            await this.refreshAllData();
            this.renderAll();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    // ==========================================================
    // 6. REPORTS & ANALYTICS MODULE
    // ==========================================================
    renderReports() {
        const summary = this.state.summary;
        if (!summary) return;

        const elRev = document.getElementById('repTotalRevenue');
        if (elRev) elRev.textContent = this.formatCurrency(summary.totalRevenue || 0);

        const elGST = document.getElementById('repTotalGST');
        if (elGST) elGST.textContent = this.formatCurrency(summary.totalGST || 0);

        const elPaid = document.getElementById('repPaidRevenue');
        if (elPaid) elPaid.textContent = this.formatCurrency(summary.paidRevenue || 0);

        const elAvg = document.getElementById('repAvgInvoice');
        if (elAvg) elAvg.textContent = this.formatCurrency(summary.avgInvoice || 0);

        // Top Products
        const tbodyTop = document.getElementById('repTopProductsBody');
        if (tbodyTop) {
            const topList = summary.topProducts || [];
            if (topList.length === 0) {
                tbodyTop.innerHTML = `<tr><td colspan="4" class="empty-placeholder">No sales data recorded yet.</td></tr>`;
            } else {
                const maxRev = Math.max(...topList.map(p => p.revenue), 1);
                tbodyTop.innerHTML = topList.map((p, idx) => `
                    <tr>
                        <td>
                            <strong>${idx + 1}. ${this.escapeHtml(p.name)}</strong>
                            <div style="font-size:11px;color:var(--text-muted);">HSN: ${p.hsn || 'N/A'}</div>
                        </td>
                        <td>${p.unitsSold} units</td>
                        <td><strong>${this.formatCurrency(p.revenue)}</strong></td>
                        <td style="width:140px;">
                            <div style="background:var(--bg-tertiary);border-radius:4px;height:8px;overflow:hidden;">
                                <div style="background:var(--accent-gold);height:100%;width:${((p.revenue / maxRev) * 100)}%;"></div>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }

        // GST Tax Summary Table
        const tbGST = document.getElementById('repGSTTableBody');
        if (tbGST && summary.taxBreakdown) {
            const tb = summary.taxBreakdown;
            tbGST.innerHTML = `
                <tr><td>Central GST (CGST - 9%)</td><td><strong>${this.formatCurrency(tb.cgst || 0)}</strong></td></tr>
                <tr><td>State GST (SGST - 9%)</td><td><strong>${this.formatCurrency(tb.sgst || 0)}</strong></td></tr>
                <tr><td>Integrated GST (IGST - 18%)</td><td><strong>${this.formatCurrency(tb.igst || 0)}</strong></td></tr>
                <tr style="font-weight:bold;border-top:2px solid var(--border-color);">
                    <td>Total Tax Output (GSTR-1 Ready)</td>
                    <td style="color:var(--accent-gold);">${this.formatCurrency(summary.totalGST || 0)}</td>
                </tr>
            `;
        }
    },

    exportInvoicesCSV() {
        if (this.state.invoices.length === 0) {
            this.showToast('No invoices to export', 'error');
            return;
        }

        const headers = ['Invoice ID', 'Customer Name', 'Date', 'Payment Mode', 'Subtotal', 'CGST', 'SGST', 'IGST', 'Discount', 'Total', 'Status'];
        const rows = this.state.invoices.map(i => [
            i.id,
            `"${(i.customerName || '').replace(/"/g, '""')}"`,
            (i.createdAt || '').split('T')[0],
            i.paymentMode,
            i.subtotal,
            i.cgst,
            i.sgst,
            i.igst,
            i.discount,
            i.total,
            i.status
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        this.downloadFile('vyapar-invoices-report.csv', csvContent, 'text/csv');
        this.showToast('Invoices exported to CSV', 'success');
    },

    exportProductsCSV() {
        if (this.state.products.length === 0) {
            this.showToast('No products to export', 'error');
            return;
        }

        const headers = ['Name', 'Category', 'HSN', 'SKU', 'Purchase Price', 'Selling Price', 'Stock'];
        const rows = this.state.products.map(p => [
            `"${(p.name || '').replace(/"/g, '""')}"`,
            p.category,
            p.hsn,
            p.sku,
            p.purchasePrice,
            p.sellingPrice,
            p.stock
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        this.downloadFile('vyapar-products-inventory.csv', csvContent, 'text/csv');
        this.showToast('Inventory exported to CSV', 'success');
    },

    // ==========================================================
    // ACCESS CONTROL & APPROVALS
    // ==========================================================
    loadRequestCenter() {
        return Promise.all([this.loadChangeRequests(), this.loadAccessRequests()]);
    },
    updateRequestBadge() {
        const pendingChanges = (this.state.changeRequests || []).filter(request => request.status === 'pending').length;
        const pendingAccess = (this.state.accessRequests || []).filter(request => request.status === 'pending').length;
        const badge = document.getElementById('requestCountBadge');
        if (badge) {
            badge.textContent = pendingChanges + pendingAccess;
            badge.hidden = pendingChanges + pendingAccess === 0;
        }
    },

    async loadAccessRequests() {
        try {
            const [requestResponse, userResponse] = await Promise.all([
                fetch(`${this.getApiUrl()}/access-requests`, { cache: 'no-store' }),
                fetch(`${this.getApiUrl()}/auth/me`, { cache: 'no-store' })
            ]);
            const requests = await requestResponse.json();
            const userData = await userResponse.json();
            if (!requestResponse.ok) throw new Error(requests.error || 'Unable to load access requests');
            if (userResponse.ok && userData.user) {
                this.state.user = userData.user;
                this.applyRoleInterface();
            }
            this.state.accessRequests = Array.isArray(requests) ? requests : [];
            this.renderAccessRequests();
            if (this.isAdmin()) this.renderStaff();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    renderAccessRequests() {
        const moduleGrid = document.getElementById('moduleAccessGrid');
        if (moduleGrid && !this.isAdmin()) {
            moduleGrid.innerHTML = Object.entries(this.accessModules).map(([module, label]) => {
                const granted = this.state.user?.permissions?.includes(module);
                const pending = this.state.accessRequests.find(request => request.module === module && request.status === 'pending');
                return `<div class="card" style="padding:14px;">
                    <div style="font-weight:800;">${label}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin:4px 0 10px;">${granted ? 'Direct changes allowed until revoked' : pending ? 'Waiting for administrator approval' : 'Changes require individual approval'}</div>
                    ${granted
                        ? '<span class="badge badge-paid">Access Granted</span>'
                        : pending
                            ? `<button class="btn btn-secondary btn-sm" onclick="VyaparApp.cancelAccessRequest(${pending.id})">Cancel Request</button>`
                            : `<button class="btn btn-primary btn-sm" onclick="VyaparApp.requestModuleAccess('${module}')">Request Access</button>`}
                </div>`;
            }).join('');
        }

        const body = document.getElementById('accessRequestsBody');
        if (!body) return;
        const requests = this.state.accessRequests || [];
        if (!requests.length) {
            body.innerHTML = `<tr><td colspan="6" class="empty-placeholder">No module access requests found.</td></tr>`;
            this.updateRequestBadge();
            return;
        }
        body.innerHTML = requests.map(request => {
            const actions = this.isAdmin() && request.status === 'pending'
                ? `<button class="btn btn-success btn-sm" onclick="VyaparApp.reviewAccessRequest(${request.id}, 'approve')">Grant</button>
                   <button class="btn btn-danger btn-sm" onclick="VyaparApp.reviewAccessRequest(${request.id}, 'reject')">Reject</button>`
                : (!this.isAdmin() && request.status === 'pending'
                    ? `<button class="btn btn-secondary btn-sm" onclick="VyaparApp.cancelAccessRequest(${request.id})">Cancel</button>`
                    : '');
            return `<tr>
                <td><strong>#${request.id}</strong></td>
                <td>${this.escapeHtml(request.requesterName || this.state.user?.name || '')}</td>
                <td>${this.escapeHtml(this.accessModules[request.module] || request.module)}</td>
                <td><strong class="status-${this.escapeHtml(request.status)}">${this.escapeHtml(request.status.toUpperCase())}</strong></td>
                <td>${this.formatDate(request.createdAt)}</td>
                <td><div style="display:flex;gap:6px;">${actions}</div></td>
            </tr>`;
        }).join('');
        this.updateRequestBadge();
    },

    async requestModuleAccess(module) {
        try {
            const response = await fetch(`${this.getApiUrl()}/access-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ module })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to request access');
            this.showToast(`${this.accessModules[module]} access requested`, 'success');
            await this.loadAccessRequests();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    async reviewAccessRequest(id, action) {
        try {
            const response = await fetch(`${this.getApiUrl()}/access-requests/${id}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Unable to ${action} access request`);
            this.showToast(action === 'approve' ? 'Module access granted' : 'Module access rejected', 'success');
            await Promise.all([this.loadAccessRequests(), this.loadStaff()]);
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    async cancelAccessRequest(id) {
        try {
            const response = await fetch(`${this.getApiUrl()}/access-requests/${id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to cancel access request');
            this.showToast('Access request cancelled', 'success');
            await this.loadAccessRequests();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    async loadChangeRequests() {
        try {
            const response = await fetch(`${this.getApiUrl()}/change-requests`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to load requests');
            this.state.changeRequests = data;
            this.renderChangeRequests();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    renderChangeRequests() {
        const body = document.getElementById('changeRequestsBody');
        if (!body) return;
        const requests = this.state.changeRequests || [];
        this.updateRequestBadge();
        if (!requests.length) {
            body.innerHTML = `<tr><td colspan="6" class="empty-placeholder">No change requests found.</td></tr>`;
            return;
        }
        body.innerHTML = requests.map(request => {
            const actions = this.isAdmin() && request.status === 'pending'
                ? `<button class="btn btn-success btn-sm" onclick="VyaparApp.approveRequest(${request.id})">Approve</button>
                   <button class="btn btn-danger btn-sm" onclick="VyaparApp.rejectRequest(${request.id})">Reject</button>`
                : (!this.isAdmin() && request.status === 'pending'
                    ? `<button class="btn btn-secondary btn-sm" onclick="VyaparApp.cancelRequest(${request.id})">Cancel</button>`
                    : '');
            return `<tr>
                <td><strong>#${request.id}</strong><div style="font-size:11px;color:var(--text-muted);">${this.formatDate(request.createdAt)}</div></td>
                <td>${this.escapeHtml(request.requesterName || this.state.user?.name || '')}</td>
                <td><span class="badge badge-category">${this.escapeHtml(request.operation)}</span> ${this.escapeHtml(request.entityType)}${request.entityId ? ` #${this.escapeHtml(String(request.entityId))}` : ''}</td>
                <td><div class="request-diff">${this.escapeHtml(JSON.stringify(request.payload, null, 2))}</div></td>
                <td><strong class="status-${this.escapeHtml(request.status)}">${this.escapeHtml(request.status.toUpperCase())}</strong>${request.reviewNote ? `<div style="font-size:11px;color:var(--text-muted);">${this.escapeHtml(request.reviewNote)}</div>` : ''}</td>
                <td><div style="display:flex;gap:6px;">${actions}</div></td>
            </tr>`;
        }).join('');
    },

    openRequestReview(id, action) {
        if (!this.isAdmin() || !['approve', 'reject'].includes(action)) return;
        const request = this.state.changeRequests.find(item => item.id === id && item.status === 'pending');
        if (!request) return this.showToast('This request is no longer pending', 'error');
        this.state.reviewingRequest = { id, action };
        document.getElementById('requestReviewTitle').textContent = action === 'approve' ? 'Approve Change Request' : 'Reject Change Request';
        document.getElementById('requestReviewSummary').textContent = `${request.operation} ${request.entityType}${request.entityId ? ` #${request.entityId}` : ''} requested by ${request.requesterName || 'staff'}`;
        document.getElementById('requestReviewNote').value = '';
        const submit = document.getElementById('requestReviewSubmit');
        submit.textContent = action === 'approve' ? 'Approve and Apply' : 'Reject Request';
        submit.className = `btn ${action === 'approve' ? 'btn-success' : 'btn-danger'}`;
        this.openModal('modalRequestReview');
    },

    async submitRequestReview() {
        const review = this.state.reviewingRequest;
        if (!review) return;
        const note = document.getElementById('requestReviewNote').value.trim();
        try {
            const response = await fetch(`${this.getApiUrl()}/change-requests/${review.id}/${review.action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Unable to ${review.action} request`);
            this.closeModal('modalRequestReview');
            this.state.reviewingRequest = null;
            this.showToast(review.action === 'approve' ? 'Request approved and applied' : 'Request rejected', 'success');
            await this.refreshAllData();
            this.renderAll();
        } catch (error) {
            this.showToast(error.message, 'error');
            await this.loadChangeRequests();
        }
    },

    approveRequest(id) {
        return this.openRequestReview(id, 'approve');
    },

    rejectRequest(id) {
        return this.openRequestReview(id, 'reject');
    },

    async cancelRequest(id) {
        if (!confirm('Cancel this pending request?')) return;
        try {
            const response = await fetch(`${this.getApiUrl()}/change-requests/${id}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to cancel request');
            this.showToast('Request cancelled', 'success');
            await this.loadChangeRequests();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    async loadStaff() {
        if (!this.isAdmin()) return;
        try {
            const response = await fetch(`${this.getApiUrl()}/staff`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to load staff');
            this.state.staff = data;
            this.renderStaff();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    renderStaff() {
        const body = document.getElementById('staffTableBody');
        if (!body || !this.isAdmin()) return;
        if (!this.state.staff.length) {
            body.innerHTML = `<tr><td colspan="7" class="empty-placeholder">No staff accounts yet.</td></tr>`;
            return;
        }
        body.innerHTML = this.state.staff.map(staff => `<tr>
            <td><strong>${this.escapeHtml(staff.name)}</strong></td>
            <td>${this.escapeHtml(staff.email)}</td>
            <td><span class="badge ${staff.isActive ? 'badge-paid' : 'badge-pending'}">${staff.isActive ? 'Active' : 'Disabled'}</span></td>
            <td>${staff.mustChangePassword ? 'Temporary password' : 'Configured'}</td>
            <td>${staff.lastLoginAt ? this.formatDate(staff.lastLoginAt) : 'Never'}</td>
            <td><div style="display:flex;gap:5px;flex-wrap:wrap;">${(staff.permissions || []).length
                ? staff.permissions.map(module => `<button class="badge badge-paid" style="cursor:pointer;border:0;" title="Click to revoke" onclick="VyaparApp.revokeStaffAccess(${staff.id}, '${module}')">${this.escapeHtml(this.accessModules[module] || module)} ×</button>`).join('')
                : '<span style="color:var(--text-muted);font-size:11px;">Approval required</span>'}</div></td>
            <td><div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn btn-secondary btn-sm" onclick="VyaparApp.editStaff(${staff.id})">Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="VyaparApp.resetStaffPassword(${staff.id})">Reset Password</button>
                <button class="btn ${staff.isActive ? 'btn-danger' : 'btn-success'} btn-sm" onclick="VyaparApp.setStaffActive(${staff.id}, ${!staff.isActive})">${staff.isActive ? 'Disable' : 'Enable'}</button>
                <button class="btn btn-danger btn-sm" onclick="VyaparApp.deleteStaff(${staff.id})">Delete Permanently</button>
            </div></td>
        </tr>`).join('');
    },

    async createStaff() {
        const name = document.getElementById('staffName').value.trim();
        const email = document.getElementById('staffEmail').value.trim();
        const temporaryPassword = document.getElementById('staffTemporaryPassword').value;
        if (!name || !email) return this.showToast('Staff name and email are required', 'error');
        if (temporaryPassword && temporaryPassword.length < 8) return this.showToast('Temporary password must be at least 8 characters', 'error');
        try {
            const response = await fetch(`${this.getApiUrl()}/staff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, temporaryPassword: temporaryPassword || undefined })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to create staff');
            document.getElementById('staffName').value = '';
            document.getElementById('staffEmail').value = '';
            document.getElementById('staffTemporaryPassword').value = '';
            alert(`Staff account created.\n\nEmail: ${data.email}\nTemporary password: ${data.temporaryPassword}\n\n${data.passwordWasGenerated ? 'A password was generated because none was entered. ' : ''}The staff member must change it at first login.`);
            await this.loadStaff();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    async setStaffActive(id, isActive) {
        if (!confirm(`${isActive ? 'Enable' : 'Disable'} this staff account?`)) return;
        try {
            const response = await fetch(`${this.getApiUrl()}/staff/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to update staff');
            this.showToast(isActive ? 'Staff account enabled' : 'Staff account disabled and sessions revoked', 'success');
            await this.loadStaff();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    async editStaff(id) {
        const staff = this.state.staff.find(member => member.id === id);
        if (!staff) return;
        const name = prompt('Staff name:', staff.name);
        if (name === null) return;
        const email = prompt('Staff email:', staff.email);
        if (email === null) return;
        try {
            const response = await fetch(`${this.getApiUrl()}/staff/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), email: email.trim() })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to update staff');
            this.showToast('Staff details updated', 'success');
            await this.loadStaff();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    async resetStaffPassword(id) {
        if (!confirm('Reset this staff password and revoke all active sessions?')) return;
        const selectedPassword = prompt('Enter a temporary password of at least 8 characters, or leave blank to generate one automatically:', '');
        if (selectedPassword === null) return;
        if (selectedPassword && selectedPassword.length < 8) return this.showToast('Temporary password must be at least 8 characters', 'error');
        try {
            const response = await fetch(`${this.getApiUrl()}/staff/${id}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ temporaryPassword: selectedPassword || undefined })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to reset password');
            alert(`Temporary password: ${data.temporaryPassword}\n\n${data.passwordWasGenerated ? 'A password was generated automatically. ' : ''}The staff member must change it at first login.`);
            await this.loadStaff();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    async deleteStaff(id) {
        const staff = this.state.staff.find(member => member.id === id);
        if (!staff) return;
        const confirmation = prompt(`Permanently delete ${staff.name}?\n\nLogin details and personal profile data will be removed. Pending requests will be cancelled and completed history will remain anonymized.\n\nType DELETE to continue:`);
        if (confirmation !== 'DELETE') {
            if (confirmation !== null) this.showToast('Permanent deletion cancelled', 'info');
            return;
        }
        try {
            const response = await fetch(`${this.getApiUrl()}/staff/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to delete staff');
            this.showToast(`Staff permanently deleted. ${data.cancelledRequests || 0} pending request(s) cancelled.`, 'success');
            await Promise.all([this.loadStaff(), this.loadChangeRequests()]);
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    async revokeStaffAccess(staffId, module) {
        if (!confirm(`Revoke ${this.accessModules[module] || module} edit access? Future changes in this module will require approval.`)) return;
        try {
            const response = await fetch(`${this.getApiUrl()}/staff/${staffId}/permissions/${module}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unable to revoke module access');
            this.showToast(`${this.accessModules[module] || module} access revoked`, 'success');
            await this.loadStaff();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    // ==========================================================
    // 7. SETTINGS & MODALS
    // ==========================================================
    openSettingsModal() {
        const urlInput = document.getElementById('settingsApiUrl');
        if (urlInput) urlInput.value = this.getApiUrl();

        document.getElementById('setCompanyName').value = this.state.settings.companyName;
        document.getElementById('setGSTIN').value = this.state.settings.gstin;
        document.getElementById('setPhone').value = this.state.settings.phone;
        document.getElementById('setAddress').value = this.state.settings.address;

        this.openModal('modalSettings');
    },

    async saveSettings() {
        const newUrl = document.getElementById('settingsApiUrl').value.trim();
        if (newUrl && this.isAdmin()) {
            this.setApiUrl(newUrl);
        }

        const companyName = document.getElementById('setCompanyName').value.trim();
        const gstin = document.getElementById('setGSTIN').value.trim();
        const phone = document.getElementById('setPhone').value.trim();
        const address = document.getElementById('setAddress').value.trim();

        try {
            const res = await this.sendMutation('POST', '/settings', { companyName, gstin, phone, address }, { entityType: 'settings', entityId: 1, operation: 'update' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save settings');

            if (!data.requested) {
                this.state.settings.companyName = companyName || this.state.settings.companyName;
                this.state.settings.gstin = gstin || this.state.settings.gstin;
                this.state.settings.phone = phone || this.state.settings.phone;
                this.state.settings.address = address || this.state.settings.address;
            }

            this.showToast(this.mutationMessage(data, 'Settings saved successfully!'), 'success');
            this.closeModal('modalSettings');
            await this.refreshAllData();
            this.renderAll();
        } catch (err) {
            this.showToast(err.message, 'error');
        }
    },

    async testApiConnection() {
        const input = document.getElementById('settingsApiUrl');
        const testBtn = document.getElementById('btnTestApi');
        const originalText = testBtn ? testBtn.textContent : '';
        if (testBtn) testBtn.innerHTML = `<span class="spinner"></span> Testing...`;

        const targetUrl = (input ? input.value : this.getApiUrl()).replace(/\/+$/, '');

        try {
            const res = await fetch(`${targetUrl}/health`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                alert(`✅ API Connection Successful!\n\nDatabase: ${data.databaseEngine.toUpperCase()}\nStatus: ${data.status}\nServer Time: ${data.timestamp}`);
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (err) {
                alert(`❌ Connection Failed to: ${targetUrl}\n\nError: ${err.message}\nMake sure your backend server is running and CORS is enabled.`);
        } finally {
            if (testBtn) testBtn.textContent = originalText;
        }
    },

    // Modal Helpers
    openModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.classList.add('open');
    },

    closeModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) m.classList.remove('open');
    },

    // Utility: Toast Messages
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';

        toast.innerHTML = `<span>${icon}</span> <span>${this.escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    // Utility: Synthesizer POS Billing Sound
    playBillChime() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } catch (e) {
            // Audio not allowed or unavailable
        }
    },

    // Utility: Number to Words (Indian Notation)
    numberToWords(num) {
        if (!num || isNaN(num) || num === 0) return 'Zero Rupees Only';
        const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        const inWords = (n) => {
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
            if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
            if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
            if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
            return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
        };

        const rupees = Math.floor(num);
        return inWords(rupees) + ' Rupees Only';
    },

    // Formatting Helpers
    formatCurrency(amount) {
        const val = parseFloat(amount || 0);
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val);
    },

    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    downloadFile(filename, text, mimeType) {
        const blob = new Blob([text], { type: mimeType });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

// Auto Start Application on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    VyaparApp.init();
});
