const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SESSION_COOKIE = 'vyapar_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PASSWORD_ROUNDS = 12;
const rateBuckets = new Map();
const STAFF_MODULES = ['inventory', 'customers', 'billing', 'invoices', 'settings'];

function nowIso() {
    return new Date().toISOString();
}

function addMilliseconds(milliseconds) {
    return new Date(Date.now() + milliseconds).toISOString();
}

function hashToken(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}

function temporaryPassword() {
    return `Vy@${randomToken(9)}`;
}

function parseCookies(header = '') {
    return header.split(';').reduce((cookies, pair) => {
        const index = pair.indexOf('=');
        if (index < 0) return cookies;
        cookies[decodeURIComponent(pair.slice(0, index).trim())] = decodeURIComponent(pair.slice(index + 1).trim());
        return cookies;
    }, {});
}

function sessionCookie(token, clear = false) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const maxAge = clear ? 0 : Math.floor(SESSION_TTL_MS / 1000);
    return `${SESSION_COOKIE}=${clear ? '' : encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function publicUser(user, permissions = []) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: Boolean(user.is_active),
        mustChangePassword: Boolean(user.must_change_password),
        mustSetPin: Boolean(user.must_set_pin),
        permissions
    };
}

function validPassword(password) {
    return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

function validPin(pin) {
    return typeof pin === 'string' && /^\d{6,8}$/.test(pin);
}

function rateLimited(key, limit, windowMs) {
    const now = Date.now();
    const previous = rateBuckets.get(key);
    if (!previous || previous.resetAt <= now) {
        rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
        return false;
    }
    previous.count += 1;
    return previous.count > limit;
}

async function createAccessTables(db, dbType) {
    if (dbType === 'mysql') {
        await db.query(`
            CREATE TABLE IF NOT EXISTS auth_users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(150) NOT NULL,
                email VARCHAR(190) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                recovery_pin_hash VARCHAR(255),
                role VARCHAR(20) NOT NULL DEFAULT 'staff',
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                must_change_password TINYINT(1) NOT NULL DEFAULT 0,
                must_set_pin TINYINT(1) NOT NULL DEFAULT 0,
                recovery_failed_attempts INT NOT NULL DEFAULT 0,
                recovery_locked_until VARCHAR(40),
                created_by INT,
                last_login_at VARCHAR(40),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                token_hash VARCHAR(64) NOT NULL UNIQUE,
                expires_at VARCHAR(40) NOT NULL,
                ip_address VARCHAR(100),
                user_agent VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used_at VARCHAR(40),
                INDEX idx_sessions_user (user_id),
                FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS change_requests (
                id INT PRIMARY KEY AUTO_INCREMENT,
                requested_by INT NOT NULL,
                entity_type VARCHAR(40) NOT NULL,
                entity_id VARCHAR(80),
                operation VARCHAR(30) NOT NULL,
                proposed_payload LONGTEXT NOT NULL,
                original_snapshot LONGTEXT,
                reason TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                reviewed_by INT,
                review_note TEXT,
                reviewed_at VARCHAR(40),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_requests_status (status),
                INDEX idx_requests_user (requested_by)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS staff_permissions (
                user_id INT NOT NULL,
                module VARCHAR(30) NOT NULL,
                granted_by INT NOT NULL,
                granted_at VARCHAR(40) NOT NULL,
                PRIMARY KEY (user_id, module),
                FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS access_requests (
                id INT PRIMARY KEY AUTO_INCREMENT,
                requested_by INT NOT NULL,
                module VARCHAR(30) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                reviewed_by INT,
                reviewed_at VARCHAR(40),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_access_status (status),
                INDEX idx_access_user (requested_by)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                actor_user_id INT,
                action VARCHAR(80) NOT NULL,
                entity_type VARCHAR(40),
                entity_id VARCHAR(80),
                before_data LONGTEXT,
                after_data LONGTEXT,
                change_request_id INT,
                ip_address VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_actor (actor_user_id),
                INDEX idx_audit_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        return;
    }

    await db.query(`
        CREATE TABLE IF NOT EXISTS auth_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            recovery_pin_hash TEXT,
            role TEXT NOT NULL DEFAULT 'staff',
            is_active INTEGER NOT NULL DEFAULT 1,
            must_change_password INTEGER NOT NULL DEFAULT 0,
            must_set_pin INTEGER NOT NULL DEFAULT 0,
            recovery_failed_attempts INTEGER NOT NULL DEFAULT 0,
            recovery_locked_until TEXT,
            created_by INTEGER,
            last_login_at TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used_at TEXT,
            FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS change_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requested_by INTEGER NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            operation TEXT NOT NULL,
            proposed_payload TEXT NOT NULL,
            original_snapshot TEXT,
            reason TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            reviewed_by INTEGER,
            review_note TEXT,
            reviewed_at TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_user_id INTEGER,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            before_data TEXT,
            after_data TEXT,
            change_request_id INTEGER,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS staff_permissions (
            user_id INTEGER NOT NULL,
            module TEXT NOT NULL,
            granted_by INTEGER NOT NULL,
            granted_at TEXT NOT NULL,
            PRIMARY KEY (user_id, module),
            FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        )
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS access_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requested_by INTEGER NOT NULL,
            module TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            reviewed_by INTEGER,
            reviewed_at TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await db.query('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_requests_status ON change_requests(status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_requests_user ON change_requests(requested_by)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_access_status ON access_requests(status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_access_user ON access_requests(requested_by)');
}

async function loadPermissions(db, userId) {
    const rows = await db.query('SELECT module FROM staff_permissions WHERE user_id = ? ORDER BY module', [userId]);
    return rows.map(row => row.module);
}

async function bootstrapAdmin(db) {
    const existing = await db.get("SELECT id FROM auth_users WHERE role = 'admin' LIMIT 1");
    if (existing) return;

    const email = (process.env.INITIAL_ADMIN_EMAIL || 'admin@vyapar.local').trim().toLowerCase();
    const password = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@123';
    const pin = process.env.INITIAL_ADMIN_PIN || '12345678';
    if (!validPassword(password) || !validPin(pin)) {
        throw new Error('INITIAL_ADMIN_PASSWORD must be at least 8 characters and INITIAL_ADMIN_PIN must be 6-8 digits');
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
    const pinHash = await bcrypt.hash(pin, PASSWORD_ROUNDS);
    const mustCompleteSetup = (!process.env.INITIAL_ADMIN_PASSWORD || !process.env.INITIAL_ADMIN_PIN) ? 1 : 0;
    await db.query(
        `INSERT INTO auth_users (name, email, password_hash, recovery_pin_hash, role, is_active, must_change_password, must_set_pin)
         VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)`,
        [process.env.INITIAL_ADMIN_NAME || 'Vyapar Administrator', email, passwordHash, pinHash, mustCompleteSetup, mustCompleteSetup]
    );
    console.log(`Initial admin created: ${email}`);
    if (!process.env.INITIAL_ADMIN_PASSWORD) {
        console.warn('Local demo credentials are active. Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, and INITIAL_ADMIN_PIN before deployment.');
    }
}

function requestShape(row) {
    return {
        id: row.id,
        requestedBy: row.requested_by,
        requesterName: row.requester_name || 'Deleted Staff',
        requesterEmail: row.requester_email || null,
        entityType: row.entity_type,
        entityId: row.entity_id,
        operation: row.operation,
        payload: JSON.parse(row.proposed_payload || '{}'),
        originalSnapshot: row.original_snapshot ? JSON.parse(row.original_snapshot) : null,
        reason: row.reason,
        status: row.status,
        reviewedBy: row.reviewed_by,
        reviewerName: row.reviewer_name,
        reviewNote: row.review_note || '',
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function accessRequestShape(row) {
    return {
        id: row.id,
        requestedBy: row.requested_by,
        requesterName: row.requester_name || 'Deleted Staff',
        requesterEmail: row.requester_email || null,
        module: row.module,
        status: row.status,
        reviewedBy: row.reviewed_by,
        reviewerName: row.reviewer_name || null,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

const allowedChanges = {
    product: new Set(['create', 'update', 'delete']),
    customer: new Set(['create', 'update', 'delete']),
    customer_payment: new Set(['create']),
    invoice: new Set(['create', 'update_status', 'delete']),
    settings: new Set(['update'])
};

async function snapshotFor(db, entityType, entityId) {
    const tables = {
        product: ['products', 'id'],
        customer: ['customers', 'id'],
        customer_payment: ['customers', 'id'],
        invoice: ['invoices', 'id'],
        settings: ['business_settings', 'id']
    };
    if (!entityId && entityType !== 'settings') return null;
    const [table, key] = tables[entityType] || [];
    if (!table) return null;
    return db.get(`SELECT * FROM ${table} WHERE ${key} = ?`, [entityType === 'settings' ? 1 : entityId]);
}

function ensureFinite(value, label, options = {}) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${label} must be a valid number`);
    if (options.min !== undefined && number < options.min) throw new Error(`${label} must be at least ${options.min}`);
    if (options.integer && !Number.isInteger(number)) throw new Error(`${label} must be a whole number`);
    return number;
}

async function applyProduct(tx, operation, entityId, payload) {
    if (operation === 'create') {
        const name = String(payload.name || '').trim();
        const hsn = String(payload.hsn || '').trim();
        const sku = String(payload.sku || '').trim();
        if (!name || !hsn || !sku) throw new Error('Product name, HSN, and SKU are required');
        if (await tx.get('SELECT id FROM products WHERE sku = ?', [sku])) throw new Error('SKU already exists');
        const purchasePrice = ensureFinite(payload.purchasePrice, 'Purchase price', { min: 0 });
        const sellingPrice = ensureFinite(payload.sellingPrice, 'Selling price', { min: 0 });
        const stock = ensureFinite(payload.stock, 'Stock', { min: 0, integer: true });
        const result = await tx.query(
            'INSERT INTO products (name, hsn, sku, purchase_price, selling_price, stock, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, hsn, sku, purchasePrice, sellingPrice, stock, String(payload.category || 'General').trim()]
        );
        return tx.get('SELECT * FROM products WHERE id = ?', [result.insertId]);
    }
    const existing = await tx.get('SELECT * FROM products WHERE id = ?', [entityId]);
    if (!existing) throw new Error('Product no longer exists');
    if (operation === 'delete') {
        await tx.query('DELETE FROM products WHERE id = ?', [entityId]);
        return null;
    }
    const name = String(payload.name ?? existing.name).trim();
    const hsn = String(payload.hsn ?? existing.hsn).trim();
    const sku = String(payload.sku ?? existing.sku).trim();
    if (!name || !hsn || !sku) throw new Error('Product name, HSN, and SKU are required');
    const collision = await tx.get('SELECT id FROM products WHERE sku = ? AND id != ?', [sku, entityId]);
    if (collision) throw new Error('SKU already exists');
    const purchasePrice = ensureFinite(payload.purchasePrice ?? existing.purchase_price, 'Purchase price', { min: 0 });
    const sellingPrice = ensureFinite(payload.sellingPrice ?? existing.selling_price, 'Selling price', { min: 0 });
    const stock = ensureFinite(payload.stock ?? existing.stock, 'Stock', { min: 0, integer: true });
    await tx.query(
        'UPDATE products SET name = ?, hsn = ?, sku = ?, purchase_price = ?, selling_price = ?, stock = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, hsn, sku, purchasePrice, sellingPrice, stock, String(payload.category ?? existing.category).trim(), entityId]
    );
    return tx.get('SELECT * FROM products WHERE id = ?', [entityId]);
}

async function applyCustomer(tx, operation, entityId, payload) {
    if (operation === 'create') {
        const name = String(payload.name || '').trim();
        const mobile = String(payload.mobile || '').trim();
        if (!name || !mobile) throw new Error('Customer name and mobile are required');
        const result = await tx.query(
            'INSERT INTO customers (name, mobile, city, state, gstin, email, outstanding_balance, total_purchased) VALUES (?, ?, ?, ?, ?, ?, 0, 0)',
            [name, mobile, String(payload.city || '').trim(), String(payload.state || '').trim(), String(payload.gstin || '').trim().toUpperCase() || null, String(payload.email || '').trim()]
        );
        return tx.get('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    }
    const existing = await tx.get('SELECT * FROM customers WHERE id = ?', [entityId]);
    if (!existing) throw new Error('Customer no longer exists');
    if (operation === 'delete') {
        const invoice = await tx.get('SELECT id FROM invoices WHERE customer_id = ? LIMIT 1', [entityId]);
        if (invoice) throw new Error('Customer with invoice history cannot be deleted');
        await tx.query('DELETE FROM customers WHERE id = ?', [entityId]);
        return null;
    }
    const name = String(payload.name ?? existing.name).trim();
    const mobile = String(payload.mobile ?? existing.mobile).trim();
    if (!name || !mobile) throw new Error('Customer name and mobile are required');
    await tx.query(
        'UPDATE customers SET name = ?, mobile = ?, city = ?, state = ?, gstin = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, mobile, String(payload.city ?? existing.city).trim(), String(payload.state ?? existing.state).trim(), String(payload.gstin ?? existing.gstin ?? '').trim().toUpperCase() || null, String(payload.email ?? existing.email).trim(), entityId]
    );
    return tx.get('SELECT * FROM customers WHERE id = ?', [entityId]);
}

async function applyPayment(tx, entityId, payload) {
    const customer = await tx.get('SELECT * FROM customers WHERE id = ?', [entityId]);
    if (!customer) throw new Error('Customer no longer exists');
    const amount = ensureFinite(payload.amount, 'Payment amount', { min: 0.01 });
    const balance = Number(customer.outstanding_balance || 0);
    if (amount > balance) throw new Error('Payment cannot exceed the outstanding balance');
    await tx.query('UPDATE customers SET outstanding_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [balance - amount, entityId]);
    return tx.get('SELECT * FROM customers WHERE id = ?', [entityId]);
}

async function nextInvoiceId(tx) {
    const year = new Date().getFullYear();
    const rows = await tx.query('SELECT id FROM invoices');
    const prefix = `INV-${year}-`;
    const sequence = rows.reduce((max, row) => {
        const value = String(row.id || '');
        if (!value.startsWith(prefix)) return max;
        const parsed = Number(value.slice(prefix.length));
        return Number.isInteger(parsed) ? Math.max(max, parsed) : max;
    }, 0) + 1;
    return `${prefix}${String(sequence).padStart(4, '0')}`;
}

async function createInvoice(tx, payload) {
    const customerId = Number(payload.customerId);
    const customer = await tx.get('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (!customer) throw new Error('A valid customer is required');
    if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error('Invoice must include at least one item');

    const normalizedItems = [];
    for (const item of payload.items) {
        const productId = Number(item.productId || item.id);
        const product = await tx.get('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product) throw new Error('An invoice product no longer exists');
        const qty = ensureFinite(item.qty ?? item.quantity, 'Quantity', { min: 1, integer: true });
        if (qty > Number(product.stock || 0)) throw new Error(`Insufficient stock for ${product.name}`);
        const price = ensureFinite(item.price ?? product.selling_price, 'Item price', { min: 0 });
        normalizedItems.push({ product, productId, qty, price });
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discount = ensureFinite(payload.discount || 0, 'Discount', { min: 0 });
    if (discount > subtotal) throw new Error('Discount cannot exceed subtotal');
    const taxable = subtotal - discount;
    const taxState = payload.taxState === 'interstate' ? 'interstate' : 'intrastate';
    const cgst = taxState === 'intrastate' ? taxable * 0.09 : 0;
    const sgst = taxState === 'intrastate' ? taxable * 0.09 : 0;
    const igst = taxState === 'interstate' ? taxable * 0.18 : 0;
    const total = taxable + cgst + sgst + igst;
    const paymentMode = String(payload.paymentMode || 'Cash');
    const status = paymentMode === 'Credit' ? 'Pending' : 'Paid';
    const invoiceId = await nextInvoiceId(tx);

    await tx.query(
        'INSERT INTO invoices (id, customer_id, customer_name, subtotal, cgst, sgst, igst, discount, total, status, tax_state, payment_mode, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [invoiceId, customer.id, customer.name, subtotal, cgst, sgst, igst, discount, total, status, taxState, paymentMode, String(payload.notes || '')]
    );
    for (const item of normalizedItems) {
        await tx.query(
            'INSERT INTO invoice_items (invoice_id, product_id, product_name, hsn, quantity, price) VALUES (?, ?, ?, ?, ?, ?)',
            [invoiceId, item.productId, item.product.name, item.product.hsn, item.qty, item.price]
        );
        await tx.query('UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.qty, item.productId]);
    }
    await tx.query(
        'UPDATE customers SET total_purchased = total_purchased + ?, outstanding_balance = outstanding_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [total, status === 'Pending' ? total : 0, customer.id]
    );
    return tx.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
}

async function applyInvoice(tx, operation, entityId, payload) {
    if (operation === 'create') return createInvoice(tx, payload);
    const invoice = await tx.get('SELECT * FROM invoices WHERE id = ?', [entityId]);
    if (!invoice) throw new Error('Invoice no longer exists');
    if (operation === 'update_status') {
        const status = payload.status;
        if (!['Paid', 'Pending'].includes(status)) throw new Error('Invoice status must be Paid or Pending');
        if (status !== invoice.status) {
            const customer = await tx.get('SELECT * FROM customers WHERE id = ?', [invoice.customer_id]);
            const currentBalance = Number(customer?.outstanding_balance || 0);
            const nextBalance = invoice.status === 'Pending' ? Math.max(0, currentBalance - Number(invoice.total)) : currentBalance + Number(invoice.total);
            await tx.query('UPDATE customers SET outstanding_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextBalance, invoice.customer_id]);
            await tx.query('UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, entityId]);
        }
        return tx.get('SELECT * FROM invoices WHERE id = ?', [entityId]);
    }
    const items = await tx.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [entityId]);
    for (const item of items) {
        await tx.query('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item.quantity, item.product_id]);
    }
    const customer = await tx.get('SELECT * FROM customers WHERE id = ?', [invoice.customer_id]);
    if (customer) {
        await tx.query(
            'UPDATE customers SET total_purchased = ?, outstanding_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [Math.max(0, Number(customer.total_purchased) - Number(invoice.total)), Math.max(0, Number(customer.outstanding_balance) - (invoice.status === 'Pending' ? Number(invoice.total) : 0)), invoice.customer_id]
        );
    }
    await tx.query('DELETE FROM invoice_items WHERE invoice_id = ?', [entityId]);
    await tx.query('DELETE FROM invoices WHERE id = ?', [entityId]);
    return null;
}

async function applySettings(tx, payload) {
    const existing = await tx.get('SELECT * FROM business_settings WHERE id = 1') || {};
    await tx.query(
        `UPDATE business_settings SET company_name = ?, tagline = ?, gstin = ?, phone = ?, email = ?, address = ?, currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
        [payload.companyName ?? existing.company_name, payload.tagline ?? existing.tagline, payload.gstin ?? existing.gstin, payload.phone ?? existing.phone, payload.email ?? existing.email, payload.address ?? existing.address, payload.currency ?? existing.currency]
    );
    return tx.get('SELECT * FROM business_settings WHERE id = 1');
}

async function applyBusinessChange(tx, change) {
    const payload = JSON.parse(change.proposed_payload || '{}');
    if (change.entity_type === 'product') return applyProduct(tx, change.operation, change.entity_id, payload);
    if (change.entity_type === 'customer') return applyCustomer(tx, change.operation, change.entity_id, payload);
    if (change.entity_type === 'customer_payment') return applyPayment(tx, change.entity_id, payload);
    if (change.entity_type === 'invoice') return applyInvoice(tx, change.operation, change.entity_id, payload);
    if (change.entity_type === 'settings') return applySettings(tx, payload);
    throw new Error('Unsupported change request');
}

async function audit(db, event) {
    await db.query(
        'INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, before_data, after_data, change_request_id, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [event.actorId || null, event.action, event.entityType || null, event.entityId || null, event.before ? JSON.stringify(event.before) : null, event.after ? JSON.stringify(event.after) : null, event.requestId || null, event.ip || null]
    );
}

function registerAccessControl(app, db) {
    app.post('/api/auth/login', async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        const role = String(req.body.role || '');
        if (!['admin', 'staff'].includes(role)) return res.status(400).json({ error: 'A valid login role is required' });
        const key = `login:${req.ip}:${role}:${email}`;
        if (rateLimited(key, 8, 15 * 60 * 1000)) return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
        try {
            const user = await db.get('SELECT * FROM auth_users WHERE email = ? AND role = ?', [email, role]);
            const matches = user ? await bcrypt.compare(password, user.password_hash) : false;
            if (!user || !matches || !user.is_active) return res.status(401).json({ error: 'Invalid email or password' });
            const token = randomToken();
            const permissions = user.role === 'staff' ? await loadPermissions(db, user.id) : STAFF_MODULES;
            await db.query(
                'INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent, last_used_at) VALUES (?, ?, ?, ?, ?, ?)',
                [user.id, hashToken(token), addMilliseconds(SESSION_TTL_MS), req.ip, String(req.get('user-agent') || '').slice(0, 500), nowIso()]
            );
            await db.query('UPDATE auth_users SET last_login_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nowIso(), user.id]);
            res.setHeader('Set-Cookie', sessionCookie(token));
            await audit(db, { actorId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, ip: req.ip });
            res.json({ user: publicUser(user, permissions) });
        } catch (error) {
            console.error('Login failed:', error);
            res.status(500).json({ error: 'Unable to sign in' });
        }
    });

    app.post('/api/auth/recover', async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();
        const pin = String(req.body.recoveryPin || '');
        const newPassword = String(req.body.newPassword || '');
        const genericError = 'The account details or recovery PIN are incorrect';
        if (!validPassword(newPassword)) return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
        if (rateLimited(`recover:${req.ip}:${email}`, 6, 30 * 60 * 1000)) return res.status(429).json({ error: 'Too many recovery attempts. Try again later.' });
        try {
            const user = await db.get("SELECT * FROM auth_users WHERE email = ? AND role = 'admin' AND is_active = 1", [email]);
            if (!user || !user.recovery_pin_hash) return res.status(400).json({ error: genericError });
            if (user.recovery_locked_until && new Date(user.recovery_locked_until).getTime() > Date.now()) {
                return res.status(429).json({ error: 'Recovery is temporarily locked. Try again later.' });
            }
            const matches = await bcrypt.compare(pin, user.recovery_pin_hash);
            if (!matches) {
                const failures = Number(user.recovery_failed_attempts || 0) + 1;
                const lockedUntil = failures >= 5 ? addMilliseconds(15 * 60 * 1000) : null;
                await db.query('UPDATE auth_users SET recovery_failed_attempts = ?, recovery_locked_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [failures >= 5 ? 0 : failures, lockedUntil, user.id]);
                return res.status(400).json({ error: genericError });
            }
            if (pin === newPassword) {
                return res.status(400).json({ error: 'Password and recovery PIN must be different' });
            }
            const passwordHash = await bcrypt.hash(newPassword, PASSWORD_ROUNDS);
            await db.transaction(async tx => {
                await tx.query('UPDATE auth_users SET password_hash = ?, must_change_password = 0, recovery_failed_attempts = 0, recovery_locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [passwordHash, user.id]);
                await tx.query('DELETE FROM sessions WHERE user_id = ?', [user.id]);
                await audit(tx, { actorId: user.id, action: 'auth.recovery', entityType: 'user', entityId: user.id, ip: req.ip });
            });
            res.setHeader('Set-Cookie', sessionCookie('', true));
            res.json({ success: true, message: 'Password changed. Sign in with your new password.' });
        } catch (error) {
            console.error('Password recovery failed:', error);
            res.status(500).json({ error: 'Unable to reset password' });
        }
    });

    async function authenticate(req, res, next) {
        try {
            const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
            if (!token) return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
            const session = await db.get(
                `SELECT s.*, u.name, u.email, u.role, u.is_active, u.must_change_password, u.must_set_pin
                 FROM sessions s JOIN auth_users u ON u.id = s.user_id WHERE s.token_hash = ?`,
                [hashToken(token)]
            );
            if (!session || !session.is_active || new Date(session.expires_at).getTime() <= Date.now()) {
                if (session) await db.query('DELETE FROM sessions WHERE id = ?', [session.id]);
                res.setHeader('Set-Cookie', sessionCookie('', true));
                return res.status(401).json({ error: 'Session expired', code: 'AUTH_REQUIRED' });
            }
            req.user = {
                id: session.user_id,
                name: session.name,
                email: session.email,
                role: session.role,
                is_active: session.is_active,
                must_change_password: session.must_change_password,
                must_set_pin: session.must_set_pin,
                permissions: session.role === 'staff' ? await loadPermissions(db, session.user_id) : STAFF_MODULES
            };
            req.sessionId = session.id;
            await db.query('UPDATE sessions SET last_used_at = ? WHERE id = ?', [nowIso(), session.id]);
            const setupAllowed = ['/auth/me', '/auth/logout', '/auth/change-password'];
            if ((session.must_change_password || session.must_set_pin) && !setupAllowed.includes(req.path)) {
                return res.status(403).json({ error: 'Account setup is required', code: 'PASSWORD_CHANGE_REQUIRED' });
            }
            next();
        } catch (error) {
            console.error('Authentication error:', error);
            res.status(500).json({ error: 'Unable to authenticate request' });
        }
    }

    app.use('/api', authenticate);

    app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user, req.user.permissions) }));

    app.post('/api/auth/logout', async (req, res) => {
        await db.query('DELETE FROM sessions WHERE id = ?', [req.sessionId]);
        res.setHeader('Set-Cookie', sessionCookie('', true));
        res.json({ success: true });
    });

    app.post('/api/auth/change-password', async (req, res) => {
        const currentPassword = String(req.body.currentPassword || '');
        const newPassword = String(req.body.newPassword || '');
        const recoveryPin = req.body.recoveryPin === undefined ? null : String(req.body.recoveryPin);
        if (!validPassword(newPassword)) return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
        if (req.user.role === 'admin' && req.user.must_set_pin && !validPin(recoveryPin)) return res.status(400).json({ error: 'A 6-8 digit recovery PIN is required' });
        try {
            const user = await db.get('SELECT * FROM auth_users WHERE id = ?', [req.user.id]);
            if (!await bcrypt.compare(currentPassword, user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });
            if (currentPassword === newPassword) return res.status(400).json({ error: 'New password must be different' });
            if (recoveryPin && newPassword === recoveryPin) return res.status(400).json({ error: 'Password and recovery PIN must be different' });
            const passwordHash = await bcrypt.hash(newPassword, PASSWORD_ROUNDS);
            const pinHash = recoveryPin ? await bcrypt.hash(recoveryPin, PASSWORD_ROUNDS) : user.recovery_pin_hash;
            await db.transaction(async tx => {
                await tx.query(
                    'UPDATE auth_users SET password_hash = ?, recovery_pin_hash = ?, must_change_password = 0, must_set_pin = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [passwordHash, pinHash, user.id]
                );
                await tx.query('DELETE FROM sessions WHERE user_id = ? AND id != ?', [user.id, req.sessionId]);
                await audit(tx, { actorId: user.id, action: 'auth.password_changed', entityType: 'user', entityId: user.id, ip: req.ip });
            });
            res.json({ success: true, user: publicUser({ ...user, must_change_password: 0, must_set_pin: 0 }, req.user.permissions) });
        } catch (error) {
            console.error('Change password failed:', error);
            res.status(500).json({ error: 'Unable to change password' });
        }
    });

    function requireAdmin(req, res, next) {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required', code: 'FORBIDDEN' });
        next();
    }

    app.get('/api/staff', requireAdmin, async (req, res) => {
        const rows = await db.query("SELECT id, name, email, is_active, must_change_password, last_login_at, created_at FROM auth_users WHERE role = 'staff' ORDER BY name");
        const staff = [];
        for (const row of rows) {
            staff.push({
                id: row.id,
                name: row.name,
                email: row.email,
                isActive: Boolean(row.is_active),
                mustChangePassword: Boolean(row.must_change_password),
                lastLoginAt: row.last_login_at,
                createdAt: row.created_at,
                permissions: await loadPermissions(db, row.id)
            });
        }
        res.json(staff);
    });

    app.post('/api/staff', requireAdmin, async (req, res) => {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Valid staff name and email are required' });
        const selectedPassword = req.body.temporaryPassword === undefined ? '' : String(req.body.temporaryPassword);
        if (selectedPassword && !validPassword(selectedPassword)) {
            return res.status(400).json({ error: 'Temporary password must be between 8 and 128 characters' });
        }
        try {
            if (await db.get('SELECT id FROM auth_users WHERE email = ?', [email])) return res.status(400).json({ error: 'Email is already in use' });
            const password = selectedPassword || temporaryPassword();
            const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
            const result = await db.query(
                "INSERT INTO auth_users (name, email, password_hash, role, is_active, must_change_password, must_set_pin, created_by) VALUES (?, ?, ?, 'staff', 1, 1, 0, ?)",
                [name, email, passwordHash, req.user.id]
            );
            await audit(db, { actorId: req.user.id, action: 'staff.created', entityType: 'user', entityId: result.insertId, after: { name, email }, ip: req.ip });
            res.status(201).json({ id: result.insertId, name, email, temporaryPassword: password, passwordWasGenerated: !selectedPassword, mustChangePassword: true, isActive: true });
        } catch (error) {
            console.error('Create staff failed:', error);
            res.status(500).json({ error: 'Unable to create staff account' });
        }
    });

    app.put('/api/staff/:id', requireAdmin, async (req, res) => {
        const id = Number(req.params.id);
        const existing = await db.get("SELECT * FROM auth_users WHERE id = ? AND role = 'staff'", [id]);
        if (!existing) return res.status(404).json({ error: 'Staff account not found' });
        const name = String(req.body.name ?? existing.name).trim();
        const email = String(req.body.email ?? existing.email).trim().toLowerCase();
        const isActive = req.body.isActive === undefined ? Number(existing.is_active) : (req.body.isActive ? 1 : 0);
        if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Valid staff name and email are required' });
        const collision = await db.get('SELECT id FROM auth_users WHERE email = ? AND id != ?', [email, id]);
        if (collision) return res.status(400).json({ error: 'Email is already in use' });
        await db.transaction(async tx => {
            await tx.query('UPDATE auth_users SET name = ?, email = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, email, isActive, id]);
            if (!isActive) await tx.query('DELETE FROM sessions WHERE user_id = ?', [id]);
            await audit(tx, { actorId: req.user.id, action: isActive ? 'staff.updated' : 'staff.disabled', entityType: 'user', entityId: id, before: { name: existing.name, email: existing.email, isActive: Boolean(existing.is_active) }, after: { name, email, isActive: Boolean(isActive) }, ip: req.ip });
        });
        res.json({ id, name, email, isActive: Boolean(isActive) });
    });

    app.post('/api/staff/:id/reset-password', requireAdmin, async (req, res) => {
        const id = Number(req.params.id);
        const existing = await db.get("SELECT id, name, email FROM auth_users WHERE id = ? AND role = 'staff'", [id]);
        if (!existing) return res.status(404).json({ error: 'Staff account not found' });
        const selectedPassword = req.body.temporaryPassword === undefined ? '' : String(req.body.temporaryPassword);
        if (selectedPassword && !validPassword(selectedPassword)) {
            return res.status(400).json({ error: 'Temporary password must be between 8 and 128 characters' });
        }
        const password = selectedPassword || temporaryPassword();
        const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
        await db.transaction(async tx => {
            await tx.query('UPDATE auth_users SET password_hash = ?, must_change_password = 1, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [passwordHash, id]);
            await tx.query('DELETE FROM sessions WHERE user_id = ?', [id]);
            await audit(tx, { actorId: req.user.id, action: 'staff.password_reset', entityType: 'user', entityId: id, ip: req.ip });
        });
        res.json({ id, temporaryPassword: password, passwordWasGenerated: !selectedPassword, mustChangePassword: true });
    });

    app.delete('/api/staff/:id', requireAdmin, async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid staff account ID' });
        try {
            const existing = await db.get("SELECT id, name, email FROM auth_users WHERE id = ? AND role = 'staff'", [id]);
            if (!existing) return res.status(404).json({ error: 'Staff account not found' });
            const outcome = await db.transaction(async tx => {
                await tx.query('DELETE FROM sessions WHERE user_id = ?', [id]);
                await tx.query('DELETE FROM staff_permissions WHERE user_id = ?', [id]);
                const cancelled = await tx.query(
                    "UPDATE change_requests SET status = 'cancelled', reviewed_by = ?, review_note = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE requested_by = ? AND status = 'pending'",
                    [req.user.id, 'Cancelled because the staff account was permanently deleted.', nowIso(), id]
                );
                await tx.query(
                    "UPDATE access_requests SET status = 'cancelled', reviewed_by = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE requested_by = ? AND status = 'pending'",
                    [req.user.id, nowIso(), id]
                );
                await tx.query(
                    "UPDATE access_requests SET status = 'revoked', reviewed_by = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE requested_by = ? AND status = 'granted'",
                    [req.user.id, nowIso(), id]
                );
                await tx.query("UPDATE audit_logs SET before_data = NULL, after_data = NULL WHERE entity_type = 'user' AND entity_id = ?", [String(id)]);
                await tx.query('UPDATE audit_logs SET ip_address = NULL WHERE actor_user_id = ?', [id]);
                await tx.query('DELETE FROM auth_users WHERE id = ?', [id]);
                await audit(tx, { actorId: req.user.id, action: 'staff.deleted', entityType: 'user', entityId: id, ip: req.ip });
                return { cancelledRequests: cancelled.affectedRows || 0 };
            });
            res.json({ success: true, id, message: 'Staff account permanently deleted', cancelledRequests: outcome.cancelledRequests });
        } catch (error) {
            console.error('Delete staff failed:', error);
            res.status(500).json({ error: 'Unable to permanently delete staff account' });
        }
    });

    app.get('/api/access-requests', async (req, res) => {
        const params = [];
        let where = '';
        if (req.user.role === 'staff') {
            where = 'WHERE ar.requested_by = ?';
            params.push(req.user.id);
        } else if (req.query.status) {
            where = 'WHERE ar.status = ?';
            params.push(req.query.status);
        }
        const rows = await db.query(
            `SELECT ar.*, requester.name AS requester_name, requester.email AS requester_email, reviewer.name AS reviewer_name
             FROM access_requests ar
             LEFT JOIN auth_users requester ON requester.id = ar.requested_by
             LEFT JOIN auth_users reviewer ON reviewer.id = ar.reviewed_by
             ${where} ORDER BY ar.created_at DESC`,
            params
        );
        res.json(rows.map(accessRequestShape));
    });

    app.post('/api/access-requests', async (req, res) => {
        if (req.user.role !== 'staff') return res.status(403).json({ error: 'Only staff can request module access' });
        const module = String(req.body.module || '');
        if (!STAFF_MODULES.includes(module)) return res.status(400).json({ error: 'Invalid access module' });
        if (req.user.permissions.includes(module)) return res.status(409).json({ error: 'You already have access to this module' });
        const pending = await db.get("SELECT id FROM access_requests WHERE requested_by = ? AND module = ? AND status = 'pending'", [req.user.id, module]);
        if (pending) return res.status(409).json({ error: 'An access request for this module is already pending' });
        const result = await db.query(
            "INSERT INTO access_requests (requested_by, module, status) VALUES (?, ?, 'pending')",
            [req.user.id, module]
        );
        await audit(db, { actorId: req.user.id, action: 'access.requested', entityType: 'permission', entityId: module, requestId: result.insertId, ip: req.ip });
        res.status(201).json({ id: result.insertId, module, status: 'pending' });
    });

    app.post('/api/access-requests/:id/approve', requireAdmin, async (req, res) => {
        try {
            const result = await db.transaction(async tx => {
                const request = await tx.get('SELECT * FROM access_requests WHERE id = ?', [req.params.id]);
                if (!request) throw Object.assign(new Error('Access request not found'), { statusCode: 404 });
                if (request.status !== 'pending') throw Object.assign(new Error('Access request has already been reviewed'), { statusCode: 409 });
                const staff = await tx.get("SELECT id FROM auth_users WHERE id = ? AND role = 'staff' AND is_active = 1", [request.requested_by]);
                if (!staff) throw Object.assign(new Error('Staff account is unavailable'), { statusCode: 409 });
                const existing = await tx.get('SELECT user_id FROM staff_permissions WHERE user_id = ? AND module = ?', [request.requested_by, request.module]);
                if (!existing) {
                    await tx.query('INSERT INTO staff_permissions (user_id, module, granted_by, granted_at) VALUES (?, ?, ?, ?)', [request.requested_by, request.module, req.user.id, nowIso()]);
                }
                await tx.query("UPDATE access_requests SET status = 'granted', reviewed_by = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.user.id, nowIso(), request.id]);
                await audit(tx, { actorId: req.user.id, action: 'access.granted', entityType: 'permission', entityId: request.module, requestId: request.id, after: { staffId: request.requested_by, module: request.module }, ip: req.ip });
                return request;
            });
            res.json({ success: true, status: 'granted', module: result.module, staffId: result.requested_by });
        } catch (error) {
            res.status(error.statusCode || 400).json({ error: error.message || 'Unable to grant access' });
        }
    });

    app.post('/api/access-requests/:id/reject', requireAdmin, async (req, res) => {
        const request = await db.get('SELECT * FROM access_requests WHERE id = ?', [req.params.id]);
        if (!request) return res.status(404).json({ error: 'Access request not found' });
        if (request.status !== 'pending') return res.status(409).json({ error: 'Access request has already been reviewed' });
        await db.query("UPDATE access_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.user.id, nowIso(), request.id]);
        await audit(db, { actorId: req.user.id, action: 'access.rejected', entityType: 'permission', entityId: request.module, requestId: request.id, ip: req.ip });
        res.json({ success: true, status: 'rejected' });
    });

    app.post('/api/access-requests/:id/cancel', async (req, res) => {
        const request = await db.get('SELECT * FROM access_requests WHERE id = ?', [req.params.id]);
        if (!request) return res.status(404).json({ error: 'Access request not found' });
        if (req.user.role !== 'staff' || request.requested_by !== req.user.id) return res.status(403).json({ error: 'You cannot cancel this access request' });
        if (request.status !== 'pending') return res.status(409).json({ error: 'Only pending access requests can be cancelled' });
        await db.query("UPDATE access_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [request.id]);
        res.json({ success: true, status: 'cancelled' });
    });

    app.delete('/api/staff/:id/permissions/:module', requireAdmin, async (req, res) => {
        const id = Number(req.params.id);
        const module = String(req.params.module || '');
        if (!STAFF_MODULES.includes(module)) return res.status(400).json({ error: 'Invalid access module' });
        const staff = await db.get("SELECT id FROM auth_users WHERE id = ? AND role = 'staff'", [id]);
        if (!staff) return res.status(404).json({ error: 'Staff account not found' });
        await db.transaction(async tx => {
            await tx.query('DELETE FROM staff_permissions WHERE user_id = ? AND module = ?', [id, module]);
            await tx.query("UPDATE access_requests SET status = 'revoked', reviewed_by = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE requested_by = ? AND module = ? AND status = 'granted'", [req.user.id, nowIso(), id, module]);
            await audit(tx, { actorId: req.user.id, action: 'access.revoked', entityType: 'permission', entityId: module, before: { staffId: id, module }, ip: req.ip });
        });
        res.json({ success: true, staffId: id, module });
    });

    app.get('/api/change-requests', async (req, res) => {
        const params = [];
        let where = '';
        if (req.user.role === 'staff') {
            where = 'WHERE cr.requested_by = ?';
            params.push(req.user.id);
        } else if (req.query.status) {
            where = 'WHERE cr.status = ?';
            params.push(req.query.status);
        }
        const rows = await db.query(
            `SELECT cr.*, requester.name AS requester_name, requester.email AS requester_email, reviewer.name AS reviewer_name
             FROM change_requests cr
             LEFT JOIN auth_users requester ON requester.id = cr.requested_by
             LEFT JOIN auth_users reviewer ON reviewer.id = cr.reviewed_by
             ${where} ORDER BY cr.created_at DESC`,
            params
        );
        res.json(rows.map(requestShape));
    });

    app.post('/api/change-requests', async (req, res) => {
        if (req.user.role !== 'staff') return res.status(403).json({ error: 'Only staff submit approval requests' });
        const entityType = String(req.body.entityType || '');
        const operation = String(req.body.operation || '');
        const entityId = req.body.entityId === undefined || req.body.entityId === null ? null : String(req.body.entityId);
        const payload = req.body.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
        const reason = '';
        if (!allowedChanges[entityType]?.has(operation)) return res.status(400).json({ error: 'Unsupported change request' });
        if (operation !== 'create' && entityType !== 'settings' && !entityId) return res.status(400).json({ error: 'A target record is required' });
        const serialized = JSON.stringify(payload);
        if (serialized.length > 50000) return res.status(400).json({ error: 'Requested change is too large' });
        const snapshot = await snapshotFor(db, entityType, entityId);
        if (operation !== 'create' && !snapshot) return res.status(404).json({ error: 'Target record not found' });
        const result = await db.query(
            'INSERT INTO change_requests (requested_by, entity_type, entity_id, operation, proposed_payload, original_snapshot, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, entityType, entityId, operation, serialized, snapshot ? JSON.stringify(snapshot) : null, reason, 'pending']
        );
        await audit(db, { actorId: req.user.id, action: 'change.requested', entityType, entityId, after: payload, requestId: result.insertId, ip: req.ip });
        res.status(201).json({ requested: true, id: result.insertId, status: 'pending', message: 'Change request sent to an administrator' });
    });

    app.post('/api/change-requests/:id/cancel', async (req, res) => {
        const request = await db.get('SELECT * FROM change_requests WHERE id = ?', [req.params.id]);
        if (!request) return res.status(404).json({ error: 'Change request not found' });
        if (request.requested_by !== req.user.id || req.user.role !== 'staff') return res.status(403).json({ error: 'You cannot cancel this request' });
        if (request.status !== 'pending') return res.status(409).json({ error: 'Only pending requests can be cancelled' });
        await db.query("UPDATE change_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [request.id]);
        await audit(db, { actorId: req.user.id, action: 'change.cancelled', entityType: request.entity_type, entityId: request.entity_id, requestId: request.id, ip: req.ip });
        res.json({ success: true, status: 'cancelled' });
    });

    app.post('/api/change-requests/:id/reject', requireAdmin, async (req, res) => {
        const request = await db.get('SELECT * FROM change_requests WHERE id = ?', [req.params.id]);
        if (!request) return res.status(404).json({ error: 'Change request not found' });
        if (request.status !== 'pending') return res.status(409).json({ error: 'Request has already been reviewed' });
        const note = String(req.body.note || '').trim().slice(0, 500);
        await db.query("UPDATE change_requests SET status = 'rejected', reviewed_by = ?, review_note = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.user.id, note, nowIso(), request.id]);
        await audit(db, { actorId: req.user.id, action: 'change.rejected', entityType: request.entity_type, entityId: request.entity_id, requestId: request.id, ip: req.ip });
        res.json({ success: true, status: 'rejected' });
    });

    app.post('/api/change-requests/:id/approve', requireAdmin, async (req, res) => {
        try {
            const outcome = await db.transaction(async tx => {
                const request = await tx.get('SELECT * FROM change_requests WHERE id = ?', [req.params.id]);
                if (!request) throw Object.assign(new Error('Change request not found'), { statusCode: 404 });
                if (request.status !== 'pending') throw Object.assign(new Error('Request has already been reviewed'), { statusCode: 409 });
                if (request.original_snapshot) {
                    const current = await snapshotFor(tx, request.entity_type, request.entity_id);
                    if (JSON.stringify(current) !== JSON.stringify(JSON.parse(request.original_snapshot))) {
                        await tx.query("UPDATE change_requests SET status = 'conflict', reviewed_by = ?, review_note = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.user.id, 'The target changed after this request was submitted.', nowIso(), request.id]);
                        return { conflict: true };
                    }
                }
                const before = request.original_snapshot ? JSON.parse(request.original_snapshot) : null;
                const after = await applyBusinessChange(tx, request);
                const note = String(req.body.note || '').trim().slice(0, 500);
                await tx.query("UPDATE change_requests SET status = 'applied', reviewed_by = ?, review_note = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.user.id, note, nowIso(), request.id]);
                await audit(tx, { actorId: req.user.id, action: 'change.applied', entityType: request.entity_type, entityId: request.entity_id || after?.id, before, after, requestId: request.id, ip: req.ip });
                return { conflict: false, after };
            });
            if (outcome.conflict) return res.status(409).json({ error: 'The target changed after submission. Ask staff to submit a new request.', status: 'conflict' });
            res.json({ success: true, status: 'applied', result: outcome.after });
        } catch (error) {
            console.error('Approve request failed:', error);
            res.status(error.statusCode || 400).json({ error: error.message || 'Unable to apply request' });
        }
    });

    app.get('/api/audit-logs', requireAdmin, async (req, res) => {
        const rows = await db.query(
            `SELECT al.*, u.name AS actor_name FROM audit_logs al LEFT JOIN auth_users u ON u.id = al.actor_user_id ORDER BY al.created_at DESC LIMIT 250`
        );
        res.json(rows.map(row => ({
            id: row.id,
            actorUserId: row.actor_user_id,
            actorName: row.actor_name || (row.actor_user_id ? 'Deleted Staff' : null),
            action: row.action,
            entityType: row.entity_type,
            entityId: row.entity_id,
            changeRequestId: row.change_request_id,
            createdAt: row.created_at
        })));
    });

    app.use('/api', (req, res, next) => {
        if (req.method === 'GET' || req.user.role === 'admin') return next();
        let module = null;
        if (req.path.startsWith('/products')) module = 'inventory';
        else if (req.path.startsWith('/customers')) module = 'customers';
        else if (req.path === '/invoices' && req.method === 'POST') module = 'billing';
        else if (req.path.startsWith('/invoices')) module = 'invoices';
        else if (req.path.startsWith('/settings')) module = 'settings';
        if (module && req.user.permissions.includes(module)) return next();
        return res.status(403).json({ error: 'This module requires administrator approval or granted staff access.', code: 'APPROVAL_REQUIRED', module });
    });
}

module.exports = {
    bootstrapAdmin,
    createAccessTables,
    registerAccessControl
};
