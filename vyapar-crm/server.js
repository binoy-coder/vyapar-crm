// ==========================================================
// Vyapar CRM & ERP Backend Server
// Bharat's Smart Business Management Engine
// Dual Database Engine: Zero-Config SQLite (Default) / MySQL
// ==========================================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { bootstrapAdmin, createAccessTables, registerAccessControl } = require('./access-control');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    // Reflect every request origin so credentialed browser requests remain valid.
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept']
}));

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
});
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Serve only explicit frontend assets. Database and source files stay private.
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/staff-login.html', (req, res) => res.sendFile(path.join(__dirname, 'staff-login.html')));
app.get('/styles.css', (req, res) => res.sendFile(path.join(__dirname, 'styles.css')));
app.get('/app.js', (req, res) => res.sendFile(path.join(__dirname, 'app.js')));
app.get('/auth.js', (req, res) => res.sendFile(path.join(__dirname, 'auth.js')));
app.get('/config.js', (req, res) => res.sendFile(path.join(__dirname, 'config.js')));

// ==========================================================
// DATABASE ADAPTER LAYER
// Auto-detects MySQL if configured, otherwise falls back to SQLite
// ==========================================================

let dbType = 'sqlite';
let dbInstance = null;

// Promisified Database Interface
const db = {
    async query(sql, params = []) {
        if (dbType === 'mysql') {
            const [rows] = await dbInstance.query(sql, params);
            return rows;
        } else {
            // SQLite wrapper
            return new Promise((resolve, reject) => {
                const trimmed = sql.trim();
                if (trimmed.startsWith('SELECT') || trimmed.startsWith('select') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('pragma')) {
                    dbInstance.all(sql, params, (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows || []);
                    });
                } else {
                    dbInstance.run(sql, params, function(err) {
                        if (err) return reject(err);
                        resolve({ insertId: this.lastID, affectedRows: this.changes });
                    });
                }
            });
        }
    },
    async get(sql, params = []) {
        if (dbType === 'mysql') {
            const [rows] = await dbInstance.query(sql, params);
            return rows[0] || null;
        } else {
            return new Promise((resolve, reject) => {
                dbInstance.get(sql, params, (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                });
            });
        }
    },
    async transaction(work) {
        if (dbType === 'mysql') {
            const connection = await dbInstance.getConnection();
            const transactionDb = {
                async query(sql, params = []) {
                    const [rows] = await connection.query(sql, params);
                    return rows;
                },
                async get(sql, params = []) {
                    const [rows] = await connection.query(sql, params);
                    return rows[0] || null;
                }
            };
            try {
                await connection.beginTransaction();
                const result = await work(transactionDb);
                await connection.commit();
                return result;
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        }

        await db.query('BEGIN IMMEDIATE');
        try {
            const result = await work(db);
            await db.query('COMMIT');
            return result;
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
    }
};

// Initialize Database Connection and Auto-Migrate
async function initDatabase() {
    // Check if MySQL connection details are provided in environment
    if (process.env.DB_HOST && process.env.DB_NAME) {
        try {
            const mysql = require('mysql2/promise');
            const pool = mysql.createPool({
                host: process.env.DB_HOST,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASS || '',
                database: process.env.DB_NAME,
                port: process.env.DB_PORT || 3306,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
            await pool.query('SELECT 1');
            dbType = 'mysql';
            dbInstance = pool;
            console.log('✅ Connected to MySQL Database:', process.env.DB_NAME);
            await createTablesMySQL();
            await createAccessTables(db, dbType);
            await seedInitialData();
            await bootstrapAdmin(db);
            return;
        } catch (err) {
            console.warn('⚠️ MySQL connection failed. Falling back to built-in SQLite engine:', err.message);
        }
    }

    // Default to SQLite (Zero-configuration, perfect for Render and Local)
    try {
        const sqlite3 = require('sqlite3').verbose();
        const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'vyapar.db');
        dbInstance = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Failed to open SQLite database:', err.message);
            } else {
                console.log('✅ Embedded SQLite Database loaded at:', dbPath);
            }
        });
        dbType = 'sqlite';
        await createTablesSQLite();
        await createAccessTables(db, dbType);
        await seedInitialData();
        await bootstrapAdmin(db);
    } catch (err) {
        console.error('❌ Fatal error initializing SQLite:', err.message);
    }
}

// SQLite Schema Definition
async function createTablesSQLite() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            hsn TEXT NOT NULL,
            sku TEXT NOT NULL UNIQUE,
            purchase_price REAL NOT NULL,
            selling_price REAL NOT NULL,
            stock INTEGER DEFAULT 0,
            category TEXT DEFAULT 'General',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mobile TEXT NOT NULL,
            city TEXT DEFAULT '',
            state TEXT DEFAULT '',
            gstin TEXT,
            email TEXT DEFAULT '',
            outstanding_balance REAL DEFAULT 0,
            total_purchased REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            customer_id INTEGER NOT NULL,
            customer_name TEXT NOT NULL,
            subtotal REAL NOT NULL,
            cgst REAL DEFAULT 0,
            sgst REAL DEFAULT 0,
            igst REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            total REAL NOT NULL,
            status TEXT DEFAULT 'Pending',
            tax_state TEXT DEFAULT 'intrastate',
            payment_mode TEXT DEFAULT 'Cash',
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS invoice_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id TEXT NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            hsn TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS business_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            company_name TEXT DEFAULT 'Vyapar Solutions Pvt Ltd',
            tagline TEXT DEFAULT 'Bharat Smart Business Engine',
            gstin TEXT DEFAULT '27AABCV1234F1Z5',
            phone TEXT DEFAULT '+91 98765 43210',
            email TEXT DEFAULT 'contact@vyaparsolutions.com',
            address TEXT DEFAULT '102, Tech Park, Andheri East, Mumbai, Maharashtra - 400069',
            currency TEXT DEFAULT '₹',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

// MySQL Schema Definition
async function createTablesMySQL() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS products (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            hsn VARCHAR(20) NOT NULL,
            sku VARCHAR(100) NOT NULL UNIQUE,
            purchase_price DECIMAL(10, 2) NOT NULL,
            selling_price DECIMAL(10, 2) NOT NULL,
            stock INT DEFAULT 0,
            category VARCHAR(100) DEFAULT 'General',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS customers (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            mobile VARCHAR(25) NOT NULL,
            city VARCHAR(100) DEFAULT '',
            state VARCHAR(100) DEFAULT '',
            gstin VARCHAR(20),
            email VARCHAR(150) DEFAULT '',
            outstanding_balance DECIMAL(10, 2) DEFAULT 0,
            total_purchased DECIMAL(10, 2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS invoices (
            id VARCHAR(50) PRIMARY KEY,
            customer_id INT NOT NULL,
            customer_name VARCHAR(255) NOT NULL,
            subtotal DECIMAL(10, 2) NOT NULL,
            cgst DECIMAL(10, 2) DEFAULT 0,
            sgst DECIMAL(10, 2) DEFAULT 0,
            igst DECIMAL(10, 2) DEFAULT 0,
            discount DECIMAL(10, 2) DEFAULT 0,
            total DECIMAL(10, 2) NOT NULL,
            status VARCHAR(50) DEFAULT 'Pending',
            tax_state VARCHAR(20) DEFAULT 'intrastate',
            payment_mode VARCHAR(50) DEFAULT 'Cash',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS invoice_items (
            id INT PRIMARY KEY AUTO_INCREMENT,
            invoice_id VARCHAR(50) NOT NULL,
            product_id INT NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            hsn VARCHAR(20) NOT NULL,
            quantity INT NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS business_settings (
            id INT PRIMARY KEY DEFAULT 1,
            company_name VARCHAR(255) DEFAULT 'Vyapar Solutions Pvt Ltd',
            tagline VARCHAR(255) DEFAULT 'Bharat Smart Business Engine',
            gstin VARCHAR(50) DEFAULT '27AABCV1234F1Z5',
            phone VARCHAR(50) DEFAULT '+91 98765 43210',
            email VARCHAR(100) DEFAULT 'contact@vyaparsolutions.com',
            address TEXT,
            currency VARCHAR(10) DEFAULT '₹',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
}

// Auto-seed Initial Sample Data if database is empty
async function seedInitialData() {
    try {
        const productCountRow = await db.get('SELECT COUNT(*) as count FROM products');
        const count = productCountRow ? (productCountRow.count || productCountRow['COUNT(*)'] || 0) : 0;

        if (count === 0) {
            console.log('🌱 Seeding initial products, customers, and invoices...');

            // Products
            const sampleProducts = [
                ['Thermal Barcode Scanner 2D', '8471', 'TBS-001', 3200, 4999, 15, 'Hardware'],
                ['Billing POS Receipt Printer 80mm', '8443', 'BPP-001', 6500, 9999, 8, 'Hardware'],
                ['Thermal Paper Rolls (80mm x 50m, Pack of 10)', '4821', 'TPR-010', 350, 599, 60, 'Consumables'],
                ['Heavy Duty Electronic Cash Drawer', '8303', 'CD-001', 2800, 4299, 4, 'Hardware'],
                ['Wireless Bluetooth Barcode Gun', '8471', 'WBG-102', 1800, 2999, 22, 'Hardware'],
                ['Handheld Android POS Billing Machine', '8470', 'APOS-500', 9500, 14500, 3, 'Hardware'],
                ['Barcode Label Roll (50x25mm, 1000 Labels)', '4821', 'BLR-001', 120, 240, 100, 'Consumables'],
                ['Desktop Touch Billing Terminal 15.6 inch', '8471', 'POS-TOUCH', 22000, 31999, 2, 'Hardware']
            ];

            for (const p of sampleProducts) {
                await db.query(
                    'INSERT INTO products (name, hsn, sku, purchase_price, selling_price, stock, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    p
                );
            }

            // Customers
            const sampleCustomers = [
                ['Rahul Gupta (Gupta Supermart)', '+91 98765 43210', 'Mumbai', 'Maharashtra', '27AABCG1234A1Z1', 'rahul@guptamart.com', 4999, 32999],
                ['Anjali Sharma (Sharma Electronics)', '+91 98220 11223', 'Pune', 'Maharashtra', '27AABCS5678B2Z2', 'anjali@sharmaelec.com', 0, 18500],
                ['Vikram Sarin (Sarin Retail Hub)', '+91 99100 88776', 'Bengaluru', 'Karnataka', '29AABCS9988C1Z4', 'vikram@sarinretail.in', 9999, 45000],
                ['Priya Verma (Verma Provision Store)', '+91 97111 22334', 'Delhi', 'Delhi', '07AABCV3344D1Z8', 'priya@vermastore.com', 1200, 15400],
                ['Amit Patel (Patel Trading Co)', '+91 98980 55443', 'Ahmedabad', 'Gujarat', '24AABCP7766E1Z0', 'amit@pateltrading.com', 0, 28900]
            ];

            for (const c of sampleCustomers) {
                await db.query(
                    'INSERT INTO customers (name, mobile, city, state, gstin, email, outstanding_balance, total_purchased) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    c
                );
            }

            // Sample Invoices
            const sampleInvoices = [
                {
                    id: 'INV-2024-001',
                    customerId: 1,
                    customerName: 'Rahul Gupta (Gupta Supermart)',
                    subtotal: 14998,
                    cgst: 1349.82,
                    sgst: 1349.82,
                    igst: 0,
                    discount: 0,
                    total: 17697.64,
                    status: 'Paid',
                    taxState: 'intrastate',
                    paymentMode: 'UPI',
                    items: [
                        { productId: 1, name: 'Thermal Barcode Scanner 2D', hsn: '8471', qty: 2, price: 4999 },
                        { productId: 3, name: 'Thermal Paper Rolls (80mm x 50m, Pack of 10)', hsn: '4821', qty: 5, price: 599 }
                    ]
                },
                {
                    id: 'INV-2024-002',
                    customerId: 3,
                    customerName: 'Vikram Sarin (Sarin Retail Hub)',
                    subtotal: 9999,
                    cgst: 0,
                    sgst: 0,
                    igst: 1799.82,
                    discount: 0,
                    total: 11798.82,
                    status: 'Pending',
                    taxState: 'interstate',
                    paymentMode: 'Credit',
                    items: [
                        { productId: 2, name: 'Billing POS Receipt Printer 80mm', hsn: '8443', qty: 1, price: 9999 }
                    ]
                },
                {
                    id: 'INV-2024-003',
                    customerId: 2,
                    customerName: 'Anjali Sharma (Sharma Electronics)',
                    subtotal: 7298,
                    cgst: 656.82,
                    sgst: 656.82,
                    igst: 0,
                    discount: 0,
                    total: 8611.64,
                    status: 'Paid',
                    taxState: 'intrastate',
                    paymentMode: 'Card',
                    items: [
                        { productId: 4, name: 'Heavy Duty Electronic Cash Drawer', hsn: '8303', qty: 1, price: 4299 },
                        { productId: 5, name: 'Wireless Bluetooth Barcode Gun', hsn: '8471', qty: 1, price: 2999 }
                    ]
                }
            ];

            for (const inv of sampleInvoices) {
                await db.query(
                    'INSERT INTO invoices (id, customer_id, customer_name, subtotal, cgst, sgst, igst, discount, total, status, tax_state, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [inv.id, inv.customerId, inv.customerName, inv.subtotal, inv.cgst, inv.sgst, inv.igst, inv.discount, inv.total, inv.status, inv.taxState, inv.paymentMode]
                );

                for (const item of inv.items) {
                    await db.query(
                        'INSERT INTO invoice_items (invoice_id, product_id, product_name, hsn, quantity, price) VALUES (?, ?, ?, ?, ?, ?)',
                        [inv.id, item.productId, item.name, item.hsn, item.qty, item.price]
                    );
                }
            }

            // Default business profile settings
            const settingsCheck = await db.get('SELECT id FROM business_settings WHERE id = 1');
            if (!settingsCheck) {
                await db.query(`
                    INSERT INTO business_settings (id, company_name, tagline, gstin, phone, email, address, currency)
                    VALUES (1, 'Vyapar Solutions Pvt Ltd', 'Bharat Smart Business Engine', '27AABCV1234F1Z5', '+91 98765 43210', 'contact@vyaparsolutions.com', '102, Tech Park, Andheri East, Mumbai, Maharashtra - 400069', '₹')
                `);
            }

            console.log('✅ Seed data created successfully.');
        }
    } catch (err) {
        console.error('⚠️ Error seeding sample data:', err.message);
    }
}

// ==========================================================
// REST API ROUTES
// ==========================================================

// 1. HEALTH & METRICS ENDPOINT
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Vyapar CRM & ERP API',
        databaseEngine: dbType,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime()
    });
});

registerAccessControl(app, db);

// ----------------------------------------------------------
// 2. PRODUCTS API (Inventory)
// ----------------------------------------------------------

// GET all products
app.get('/api/products', async (req, res) => {
    try {
        const rows = await db.query('SELECT * FROM products ORDER BY name ASC');
        // Map database fields to standard json keys
        const products = rows.map(p => ({
            id: p.id,
            name: p.name,
            hsn: p.hsn,
            sku: p.sku,
            purchasePrice: parseFloat(p.purchase_price || 0),
            sellingPrice: parseFloat(p.selling_price || 0),
            stock: parseInt(p.stock || 0),
            category: p.category || 'General',
            createdAt: p.created_at,
            updatedAt: p.updated_at
        }));
        res.json(products);
    } catch (err) {
        console.error('GET /api/products error:', err);
        res.status(500).json({ error: 'Failed to fetch products: ' + err.message });
    }
});

// GET single product
app.get('/api/products/:id', async (req, res) => {
    try {
        const p = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!p) return res.status(404).json({ error: 'Product not found' });
        res.json({
            id: p.id,
            name: p.name,
            hsn: p.hsn,
            sku: p.sku,
            purchasePrice: parseFloat(p.purchase_price || 0),
            sellingPrice: parseFloat(p.selling_price || 0),
            stock: parseInt(p.stock || 0),
            category: p.category || 'General',
            createdAt: p.created_at,
            updatedAt: p.updated_at
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch product: ' + err.message });
    }
});

// POST create product
app.post('/api/products', async (req, res) => {
    try {
        const { name, hsn, sku, category } = req.body;
        const purchasePrice = parseFloat(req.body.purchasePrice ?? req.body.purchase_price ?? 0);
        const sellingPrice = parseFloat(req.body.sellingPrice ?? req.body.selling_price ?? 0);
        const stock = parseInt(req.body.stock ?? 0);

        if (!name || !hsn || !sku) {
            return res.status(400).json({ error: 'Product Name, HSN code, and SKU are required' });
        }
        if (sellingPrice < 0 || purchasePrice < 0) {
            return res.status(400).json({ error: 'Prices cannot be negative' });
        }

        // Check if SKU already exists
        const existing = await db.get('SELECT id FROM products WHERE sku = ?', [sku.trim()]);
        if (existing) {
            return res.status(400).json({ error: `Product SKU "${sku}" already exists. Please choose a unique SKU.` });
        }

        const result = await db.query(
            'INSERT INTO products (name, hsn, sku, purchase_price, selling_price, stock, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name.trim(), hsn.trim(), sku.trim(), purchasePrice, sellingPrice, stock, category ? category.trim() : 'General']
        );

        res.status(201).json({
            id: result.insertId,
            name: name.trim(),
            hsn: hsn.trim(),
            sku: sku.trim(),
            purchasePrice,
            sellingPrice,
            stock,
            category: category ? category.trim() : 'General'
        });
    } catch (err) {
        console.error('POST /api/products error:', err);
        res.status(500).json({ error: 'Failed to create product: ' + err.message });
    }
});

// PUT update product
app.put('/api/products/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, hsn, sku, category } = req.body;
        const purchasePrice = parseFloat(req.body.purchasePrice ?? req.body.purchase_price ?? 0);
        const sellingPrice = parseFloat(req.body.sellingPrice ?? req.body.selling_price ?? 0);
        const stock = parseInt(req.body.stock ?? 0);

        const existing = await db.get('SELECT * FROM products WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ error: 'Product not found' });

        // Check SKU collision with other product
        if (sku && sku !== existing.sku) {
            const skuCollision = await db.get('SELECT id FROM products WHERE sku = ? AND id != ?', [sku.trim(), id]);
            if (skuCollision) {
                return res.status(400).json({ error: `SKU "${sku}" is already in use by another product.` });
            }
        }

        await db.query(
            'UPDATE products SET name = ?, hsn = ?, sku = ?, purchase_price = ?, selling_price = ?, stock = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [
                name ? name.trim() : existing.name,
                hsn ? hsn.trim() : existing.hsn,
                sku ? sku.trim() : existing.sku,
                !isNaN(purchasePrice) ? purchasePrice : existing.purchase_price,
                !isNaN(sellingPrice) ? sellingPrice : existing.selling_price,
                !isNaN(stock) ? stock : existing.stock,
                category ? category.trim() : existing.category,
                id
            ]
        );

        res.json({
            id,
            name: name ? name.trim() : existing.name,
            hsn: hsn ? hsn.trim() : existing.hsn,
            sku: sku ? sku.trim() : existing.sku,
            purchasePrice: !isNaN(purchasePrice) ? purchasePrice : existing.purchase_price,
            sellingPrice: !isNaN(sellingPrice) ? sellingPrice : existing.selling_price,
            stock: !isNaN(stock) ? stock : existing.stock,
            category: category ? category.trim() : existing.category
        });
    } catch (err) {
        console.error('PUT /api/products/:id error:', err);
        res.status(500).json({ error: 'Failed to update product: ' + err.message });
    }
});

// DELETE product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await db.query('DELETE FROM products WHERE id = ?', [id]);
        res.json({ success: true, message: 'Product deleted successfully', id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product: ' + err.message });
    }
});

// ----------------------------------------------------------
// 3. CUSTOMERS API (CRM)
// ----------------------------------------------------------

// GET all customers
app.get('/api/customers', async (req, res) => {
    try {
        const rows = await db.query('SELECT * FROM customers ORDER BY name ASC');
        const customers = rows.map(c => ({
            id: c.id,
            name: c.name,
            mobile: c.mobile,
            city: c.city || '',
            state: c.state || '',
            gstin: c.gstin || '',
            email: c.email || '',
            outstandingBalance: parseFloat(c.outstanding_balance || 0),
            totalPurchased: parseFloat(c.total_purchased || 0),
            createdAt: c.created_at,
            updatedAt: c.updated_at
        }));
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch customers: ' + err.message });
    }
});

// GET single customer + invoices
app.get('/api/customers/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const c = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
        if (!c) return res.status(404).json({ error: 'Customer not found' });

        const invoices = await db.query('SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC', [id]);

        res.json({
            id: c.id,
            name: c.name,
            mobile: c.mobile,
            city: c.city || '',
            state: c.state || '',
            gstin: c.gstin || '',
            email: c.email || '',
            outstandingBalance: parseFloat(c.outstanding_balance || 0),
            totalPurchased: parseFloat(c.total_purchased || 0),
            invoices: invoices || []
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch customer: ' + err.message });
    }
});

// POST create customer
app.post('/api/customers', async (req, res) => {
    try {
        const { name, mobile, city, state, gstin, email } = req.body;
        if (!name || !mobile) {
            return res.status(400).json({ error: 'Customer Name and Mobile number are required' });
        }

        const result = await db.query(
            'INSERT INTO customers (name, mobile, city, state, gstin, email, outstanding_balance, total_purchased) VALUES (?, ?, ?, ?, ?, ?, 0, 0)',
            [name.trim(), mobile.trim(), city ? city.trim() : '', state ? state.trim() : '', gstin ? gstin.trim().toUpperCase() : null, email ? email.trim() : '']
        );

        res.status(201).json({
            id: result.insertId,
            name: name.trim(),
            mobile: mobile.trim(),
            city: city ? city.trim() : '',
            state: state ? state.trim() : '',
            gstin: gstin ? gstin.trim().toUpperCase() : '',
            email: email ? email.trim() : '',
            outstandingBalance: 0,
            totalPurchased: 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create customer: ' + err.message });
    }
});

// PUT update customer
app.put('/api/customers/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, mobile, city, state, gstin, email } = req.body;
        const outstandingBalance = parseFloat(req.body.outstandingBalance ?? req.body.outstanding_balance);
        const totalPurchased = parseFloat(req.body.totalPurchased ?? req.body.total_purchased);

        const existing = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ error: 'Customer not found' });

        await db.query(
            'UPDATE customers SET name = ?, mobile = ?, city = ?, state = ?, gstin = ?, email = ?, outstanding_balance = ?, total_purchased = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [
                name ? name.trim() : existing.name,
                mobile ? mobile.trim() : existing.mobile,
                city !== undefined ? city.trim() : existing.city,
                state !== undefined ? state.trim() : existing.state,
                gstin !== undefined ? (gstin ? gstin.trim().toUpperCase() : null) : existing.gstin,
                email !== undefined ? email.trim() : existing.email,
                !isNaN(outstandingBalance) ? outstandingBalance : existing.outstanding_balance,
                !isNaN(totalPurchased) ? totalPurchased : existing.total_purchased,
                id
            ]
        );

        res.json({
            id,
            name: name ? name.trim() : existing.name,
            mobile: mobile ? mobile.trim() : existing.mobile,
            city: city !== undefined ? city.trim() : existing.city,
            state: state !== undefined ? state.trim() : existing.state,
            gstin: gstin !== undefined ? (gstin ? gstin.trim().toUpperCase() : '') : existing.gstin,
            email: email !== undefined ? email.trim() : existing.email,
            outstandingBalance: !isNaN(outstandingBalance) ? outstandingBalance : existing.outstanding_balance,
            totalPurchased: !isNaN(totalPurchased) ? totalPurchased : existing.total_purchased
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update customer: ' + err.message });
    }
});

// POST settle / record customer payment
app.post('/api/customers/:id/payment', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const amount = parseFloat(req.body.amount || 0);

        if (amount <= 0) return res.status(400).json({ error: 'Payment amount must be greater than 0' });

        const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        const newBalance = Math.max(0, (customer.outstanding_balance || 0) - amount);
        await db.query('UPDATE customers SET outstanding_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBalance, id]);

        res.json({
            success: true,
            customerId: id,
            amountPaid: amount,
            previousBalance: customer.outstanding_balance,
            newOutstandingBalance: newBalance
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to record payment: ' + err.message });
    }
});

// DELETE customer
app.delete('/api/customers/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await db.query('DELETE FROM customers WHERE id = ?', [id]);
        res.json({ success: true, message: 'Customer deleted successfully', id });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete customer: ' + err.message });
    }
});

// ----------------------------------------------------------
// 4. INVOICES & BILLING API
// ----------------------------------------------------------

// GET all invoices
app.get('/api/invoices', async (req, res) => {
    try {
        const invoices = await db.query('SELECT * FROM invoices ORDER BY created_at DESC');
        const items = await db.query('SELECT * FROM invoice_items');

        // Group items by invoice_id
        const itemsByInvoice = {};
        for (const item of items) {
            if (!itemsByInvoice[item.invoice_id]) itemsByInvoice[item.invoice_id] = [];
            itemsByInvoice[item.invoice_id].push({
                productId: item.product_id,
                name: item.product_name,
                hsn: item.hsn,
                qty: item.quantity,
                price: parseFloat(item.price || 0)
            });
        }

        const result = invoices.map(inv => ({
            id: inv.id,
            customerId: inv.customer_id,
            customerName: inv.customer_name,
            subtotal: parseFloat(inv.subtotal || 0),
            cgst: parseFloat(inv.cgst || 0),
            sgst: parseFloat(inv.sgst || 0),
            igst: parseFloat(inv.igst || 0),
            discount: parseFloat(inv.discount || 0),
            total: parseFloat(inv.total || 0),
            status: inv.status || 'Pending',
            taxState: inv.tax_state || 'intrastate',
            paymentMode: inv.payment_mode || 'Cash',
            notes: inv.notes || '',
            createdAt: inv.created_at,
            items: itemsByInvoice[inv.id] || []
        }));

        res.json(result);
    } catch (err) {
        console.error('GET /api/invoices error:', err);
        res.status(500).json({ error: 'Failed to fetch invoices: ' + err.message });
    }
});

// GET single invoice
app.get('/api/invoices/:id', async (req, res) => {
    try {
        const inv = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
        if (!inv) return res.status(404).json({ error: 'Invoice not found' });

        const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
        const customer = await db.get('SELECT * FROM customers WHERE id = ?', [inv.customer_id]);

        res.json({
            id: inv.id,
            customerId: inv.customer_id,
            customerName: inv.customer_name,
            customerDetails: customer || null,
            subtotal: parseFloat(inv.subtotal || 0),
            cgst: parseFloat(inv.cgst || 0),
            sgst: parseFloat(inv.sgst || 0),
            igst: parseFloat(inv.igst || 0),
            discount: parseFloat(inv.discount || 0),
            total: parseFloat(inv.total || 0),
            status: inv.status || 'Pending',
            taxState: inv.tax_state || 'intrastate',
            paymentMode: inv.payment_mode || 'Cash',
            notes: inv.notes || '',
            createdAt: inv.created_at,
            items: items.map(item => ({
                productId: item.product_id,
                name: item.product_name,
                hsn: item.hsn,
                qty: item.quantity,
                price: parseFloat(item.price || 0)
            }))
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch invoice: ' + err.message });
    }
});

// POST create new invoice (Fast POS Billing)
app.post('/api/invoices', async (req, res) => {
    const { customerId, customerName, items, subtotal, cgst, sgst, igst, discount, total, status, taxState, paymentMode, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Invoice must include at least one product item.' });
    }

    try {
        // Resolve Customer
        let finalCustomerId = parseInt(customerId || 0);
        let finalCustomerName = customerName ? customerName.trim() : 'Walk-in Customer';

        if (!finalCustomerId && customerName) {
            // Find or create customer
            const found = await db.get('SELECT id, name FROM customers WHERE name = ?', [customerName.trim()]);
            if (found) {
                finalCustomerId = found.id;
                finalCustomerName = found.name;
            } else {
                const newCust = await db.query(
                    'INSERT INTO customers (name, mobile, city, state, outstanding_balance, total_purchased) VALUES (?, ?, ?, ?, ?, ?)',
                    [customerName.trim(), req.body.customerMobile || '+91 00000 00000', '', '', 0, 0]
                );
                finalCustomerId = newCust.insertId;
            }
        }

        // Generate unique Sequential Invoice ID
        const allInvoices = await db.query('SELECT id FROM invoices');
        let nextNum = allInvoices.length + 1;
        let invoiceId = `INV-2024-${String(nextNum).padStart(3, '0')}`;

        // Ensure uniqueness
        const idExists = await db.get('SELECT id FROM invoices WHERE id = ?', [invoiceId]);
        if (idExists) {
            invoiceId = `INV-2024-${Date.now().toString().slice(-4)}`;
        }

        const invStatus = status || 'Pending';
        const invTaxState = taxState || 'intrastate';
        const invPaymentMode = paymentMode || (invStatus === 'Paid' ? 'Cash' : 'Credit');
        const invDiscount = parseFloat(discount || 0);
        const invTotal = parseFloat(total || 0);

        // Insert Invoice
        await db.query(
            'INSERT INTO invoices (id, customer_id, customer_name, subtotal, cgst, sgst, igst, discount, total, status, tax_state, payment_mode, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                invoiceId,
                finalCustomerId,
                finalCustomerName,
                parseFloat(subtotal || 0),
                parseFloat(cgst || 0),
                parseFloat(sgst || 0),
                parseFloat(igst || 0),
                invDiscount,
                invTotal,
                invStatus,
                invTaxState,
                invPaymentMode,
                notes || ''
            ]
        );

        // Insert line items & deduct product stock
        for (const item of items) {
            const pid = parseInt(item.productId || item.id);
            const qty = parseInt(item.qty || item.quantity || 1);
            const price = parseFloat(item.price || 0);

            await db.query(
                'INSERT INTO invoice_items (invoice_id, product_id, product_name, hsn, quantity, price) VALUES (?, ?, ?, ?, ?, ?)',
                [invoiceId, pid, item.name || 'Item', item.hsn || '9999', qty, price]
            );

            // Deduct stock if product ID exists
            if (pid) {
                await db.query('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?', [qty, pid]);
            }
        }

        // Update customer lifetime purchase & outstanding balance
        if (finalCustomerId) {
            const balanceDelta = (invStatus === 'Pending') ? invTotal : 0;
            await db.query(
                'UPDATE customers SET total_purchased = total_purchased + ?, outstanding_balance = outstanding_balance + ? WHERE id = ?',
                [invTotal, balanceDelta, finalCustomerId]
            );
        }

        res.status(201).json({
            id: invoiceId,
            customerId: finalCustomerId,
            customerName: finalCustomerName,
            subtotal: parseFloat(subtotal || 0),
            cgst: parseFloat(cgst || 0),
            sgst: parseFloat(sgst || 0),
            igst: parseFloat(igst || 0),
            discount: invDiscount,
            total: invTotal,
            status: invStatus,
            taxState: invTaxState,
            paymentMode: invPaymentMode,
            notes: notes || '',
            items,
            createdAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('POST /api/invoices error:', err);
        res.status(500).json({ error: 'Failed to create invoice: ' + err.message });
    }
});

// PUT update invoice status (e.g. Mark Paid / Pending)
app.put('/api/invoices/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    try {
        const inv = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
        if (!inv) return res.status(404).json({ error: 'Invoice not found' });

        const previousStatus = inv.status;
        const newStatus = status;

        if (previousStatus !== newStatus) {
            // If changing from Pending to Paid -> Deduct outstanding balance
            if (previousStatus === 'Pending' && newStatus === 'Paid') {
                await db.query(
                    'UPDATE customers SET outstanding_balance = MAX(0, outstanding_balance - ?) WHERE id = ?',
                    [inv.total, inv.customer_id]
                );
            }
            // If changing from Paid to Pending -> Add to outstanding balance
            else if (previousStatus === 'Paid' && newStatus === 'Pending') {
                await db.query(
                    'UPDATE customers SET outstanding_balance = outstanding_balance + ? WHERE id = ?',
                    [inv.total, inv.customer_id]
                );
            }

            await db.query('UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, req.params.id]);
        }

        res.json({ id: req.params.id, status: newStatus, previousStatus });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update invoice status: ' + err.message });
    }
});

// DELETE invoice (reverses stock and balances)
app.delete('/api/invoices/:id', async (req, res) => {
    try {
        const inv = await db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
        if (!inv) return res.status(404).json({ error: 'Invoice not found' });

        // Retrieve items to restore product stock
        const items = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
        for (const item of items) {
            await db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }

        // Reverse customer ledger
        const balanceDelta = (inv.status === 'Pending') ? inv.total : 0;
        await db.query(
            'UPDATE customers SET total_purchased = MAX(0, total_purchased - ?), outstanding_balance = MAX(0, outstanding_balance - ?) WHERE id = ?',
            [inv.total, balanceDelta, inv.customer_id]
        );

        // Delete items and invoice
        await db.query('DELETE FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
        await db.query('DELETE FROM invoices WHERE id = ?', [req.params.id]);

        res.json({ success: true, message: `Invoice ${req.params.id} deleted and inventory restored.` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete invoice: ' + err.message });
    }
});

// ----------------------------------------------------------
// 5. REPORTS & BUSINESS ANALYTICS API
// ----------------------------------------------------------

// GET summary metrics
app.get('/api/reports/summary', async (req, res) => {
    try {
        const invoices = await db.query('SELECT * FROM invoices');
        const customers = await db.query('SELECT * FROM customers');
        const products = await db.query('SELECT * FROM products');
        const items = await db.query('SELECT * FROM invoice_items');

        const totalRevenue = invoices.reduce((sum, i) => sum + parseFloat(i.total || 0), 0);
        const totalCGST = invoices.reduce((sum, i) => sum + parseFloat(i.cgst || 0), 0);
        const totalSGST = invoices.reduce((sum, i) => sum + parseFloat(i.sgst || 0), 0);
        const totalIGST = invoices.reduce((sum, i) => sum + parseFloat(i.igst || 0), 0);
        const totalGST = totalCGST + totalSGST + totalIGST;

        const pendingReceivables = invoices
            .filter(i => i.status === 'Pending')
            .reduce((sum, i) => sum + parseFloat(i.total || 0), 0);

        const paidRevenue = invoices
            .filter(i => i.status === 'Paid')
            .reduce((sum, i) => sum + parseFloat(i.total || 0), 0);

        const lowStockProducts = products.filter(p => parseInt(p.stock || 0) < 5);

        // Calculate top products by revenue
        const productStats = {};
        for (const item of items) {
            const name = item.product_name;
            if (!productStats[name]) {
                productStats[name] = { name, unitsSold: 0, revenue: 0, hsn: item.hsn };
            }
            productStats[name].unitsSold += parseInt(item.quantity || 0);
            productStats[name].revenue += parseFloat(item.price || 0) * parseInt(item.quantity || 0);
        }

        const topProducts = Object.values(productStats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // 7-day daily sales history
        const daysMap = {};
        const now = new Date();
        for (let d = 6; d >= 0; d--) {
            const date = new Date(now);
            date.setDate(date.getDate() - d);
            const dateStr = date.toISOString().split('T')[0];
            daysMap[dateStr] = { date: dateStr, revenue: 0, count: 0 };
        }

        for (const inv of invoices) {
            const dateStr = (inv.created_at || '').split('T')[0] || (inv.created_at || '').split(' ')[0];
            if (daysMap[dateStr]) {
                daysMap[dateStr].revenue += parseFloat(inv.total || 0);
                daysMap[dateStr].count += 1;
            }
        }

        res.json({
            totalRevenue,
            paidRevenue,
            pendingReceivables,
            totalGST,
            taxBreakdown: {
                cgst: totalCGST,
                sgst: totalSGST,
                igst: totalIGST
            },
            invoiceCount: invoices.length,
            customerCount: customers.length,
            productCount: products.length,
            lowStockCount: lowStockProducts.length,
            avgInvoice: invoices.length > 0 ? (totalRevenue / invoices.length) : 0,
            topProducts,
            salesChart: Object.values(daysMap)
        });
    } catch (err) {
        console.error('GET /api/reports/summary error:', err);
        res.status(500).json({ error: 'Failed to generate summary report: ' + err.message });
    }
});

// ----------------------------------------------------------
// 6. BUSINESS SETTINGS API
// ----------------------------------------------------------

// GET settings
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await db.get('SELECT * FROM business_settings WHERE id = 1');
        res.json(settings || {
            companyName: 'Vyapar Solutions Pvt Ltd',
            tagline: 'Bharat Smart Business Engine',
            gstin: '27AABCV1234F1Z5',
            phone: '+91 98765 43210',
            email: 'contact@vyaparsolutions.com',
            address: '102, Tech Park, Andheri East, Mumbai, Maharashtra - 400069',
            currency: '₹'
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch settings: ' + err.message });
    }
});

// POST update settings
app.post('/api/settings', async (req, res) => {
    try {
        const { companyName, tagline, gstin, phone, email, address, currency } = req.body;
        await db.query(`
            UPDATE business_settings SET
                company_name = ?,
                tagline = ?,
                gstin = ?,
                phone = ?,
                email = ?,
                address = ?,
                currency = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `, [
            companyName || 'Vyapar Solutions Pvt Ltd',
            tagline || '',
            gstin || '',
            phone || '',
            email || '',
            address || '',
            currency || '₹'
        ]);

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update settings: ' + err.message });
    }
});

// ----------------------------------------------------------
// START SERVER & DATABASE
// ----------------------------------------------------------

initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`\n==================================================`);
        console.log(`🚀 Vyapar ERP Backend running on: http://localhost:${PORT}`);
        console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
        console.log(`📦 Database Engine: ${dbType.toUpperCase()}`);
        console.log(`==================================================\n`);
    });
}).catch(err => {
    console.error('Fatal initialization error:', err);
});

module.exports = app;
