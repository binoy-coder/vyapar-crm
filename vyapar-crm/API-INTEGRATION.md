# Vyapar API Integration Guide

## Connecting to Backend Database

This guide explains how to integrate Vyapar with a backend API instead of using localStorage.

---

## 🔄 **Architecture Overview**

### **Current (Local-First)**
```
Browser (Vyapar HTML) → localStorage
```

### **Production (Cloud-Connected)**
```
Browser (Vyapar HTML) → API Server → Database (MySQL/PostgreSQL)
```

---

## 📡 **API Endpoints Required**

### **Products**
```
GET    /api/products              - List all products
POST   /api/products              - Create product
PUT    /api/products/:id          - Update product
DELETE /api/products/:id          - Delete product
```

### **Customers**
```
GET    /api/customers             - List all customers
POST   /api/customers             - Create customer
PUT    /api/customers/:id         - Update customer
DELETE /api/customers/:id         - Delete customer
```

### **Invoices**
```
GET    /api/invoices              - List all invoices
POST   /api/invoices              - Create invoice
GET    /api/invoices/:id          - Get invoice details
PUT    /api/invoices/:id/status   - Update invoice status
```

---

## 🔧 **Implementation Steps**

### **Step 1: Replace localStorage with API Calls**

**Before (localStorage):**
```javascript
loadData() {
    const saved = localStorage.getItem('vyaparData');
    if (saved) {
        const data = JSON.parse(saved);
        this.products = data.products || [];
        this.customers = data.customers || [];
        this.invoices = data.invoices || [];
    }
}
```

**After (API):**
```javascript
async loadData() {
    try {
        const [products, customers, invoices] = await Promise.all([
            fetch('/api/products').then(r => r.json()),
            fetch('/api/customers').then(r => r.json()),
            fetch('/api/invoices').then(r => r.json())
        ]);
        this.products = products;
        this.customers = customers;
        this.invoices = invoices;
    } catch (err) {
        console.error('Failed to load data:', err);
    }
}
```

### **Step 2: Update Save Function**

**Before:**
```javascript
saveData() {
    localStorage.setItem('vyaparData', JSON.stringify({
        products: this.products,
        customers: this.customers,
        invoices: this.invoices
    }));
}
```

**After:**
```javascript
async saveData() {
    // Products are saved individually on create/update/delete
    // No need for bulk save
}
```

### **Step 3: Add/Update Individual Operations**

**Add Product:**
```javascript
async saveProduct() {
    const product = { name, hsn, sku, purchasePrice, sellingPrice, stock };
    
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        
        const newProduct = await response.json();
        this.products.push(newProduct);
        this.renderProducts();
    } catch (err) {
        alert('Failed to save product: ' + err.message);
    }
}
```

**Update Customer:**
```javascript
async updateCustomer(customerId, updates) {
    try {
        const response = await fetch(`/api/customers/${customerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        
        const updated = await response.json();
        const idx = this.customers.findIndex(c => c.id === customerId);
        this.customers[idx] = updated;
        this.renderCustomers();
    } catch (err) {
        alert('Failed to update customer: ' + err.message);
    }
}
```

**Delete Product:**
```javascript
async deleteProduct(productId) {
    try {
        await fetch(`/api/products/${productId}`, { method: 'DELETE' });
        this.products = this.products.filter(p => p.id !== productId);
        this.renderProducts();
    } catch (err) {
        alert('Failed to delete product: ' + err.message);
    }
}
```

### **Step 4: Generate Invoice with DB Save**

```javascript
async generateBill() {
    // ... existing bill validation ...
    
    const invoice = {
        customerId, customerName, items, subtotal,
        cgst, sgst, igst, total, status: 'Pending',
        date: new Date().toISOString().split('T')[0],
        state: this.currentBill.state
    };
    
    try {
        // Save invoice to backend
        const response = await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invoice)
        });
        
        const savedInvoice = await response.json();
        this.invoices.push(savedInvoice);
        
        // Update inventory
        for (const item of invoice.items) {
            await fetch(`/api/products/${item.productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stock: this.products.find(p => p.id === item.productId).stock - item.qty })
            });
        }
        
        this.viewInvoice(savedInvoice);
        this.resetBill();
    } catch (err) {
        alert('Failed to generate invoice: ' + err.message);
    }
}
```

---

## 🗄️ **Database Schema**

### **Products Table**
```sql
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    hsn VARCHAR(10) NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    purchase_price DECIMAL(10, 2),
    selling_price DECIMAL(10, 2),
    stock INT DEFAULT 0,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### **Customers Table**
```sql
CREATE TABLE customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(100),
    outstanding_balance DECIMAL(10, 2) DEFAULT 0,
    total_purchased DECIMAL(10, 2) DEFAULT 0,
    gstin VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### **Invoices Table**
```sql
CREATE TABLE invoices (
    id VARCHAR(50) PRIMARY KEY,
    customer_id INT NOT NULL,
    customer_name VARCHAR(255),
    items JSON,
    subtotal DECIMAL(10, 2),
    cgst DECIMAL(10, 2),
    sgst DECIMAL(10, 2),
    igst DECIMAL(10, 2),
    total DECIMAL(10, 2),
    status VARCHAR(50),
    tax_state VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### **Invoice Items Table (Normalized)**
```sql
CREATE TABLE invoice_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id VARCHAR(50),
    product_id INT,
    product_name VARCHAR(255),
    hsn VARCHAR(10),
    quantity INT,
    price DECIMAL(10, 2),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

---

## 🔐 **Authentication**

Add JWT authentication for multi-user access:

```javascript
// Login
async login(username, password) {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    const { token } = await response.json();
    localStorage.setItem('authToken', token);
    this.authToken = token;
}

// API calls with auth
async loadData() {
    const headers = {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
    };
    
    const products = await fetch('/api/products', { headers }).then(r => r.json());
    // ...
}
```

---

## 📊 **Backend Example (Node.js + Express)**

### **Setup**
```bash
npm install express mysql2 cors dotenv
```

### **Server Code**
```javascript
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

// GET Products
app.get('/api/products', async (req, res) => {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT * FROM products');
    connection.release();
    res.json(rows);
});

// POST Product
app.post('/api/products', async (req, res) => {
    const { name, hsn, sku, purchasePrice, sellingPrice, stock } = req.body;
    const connection = await pool.getConnection();
    await connection.query(
        'INSERT INTO products (name, hsn, sku, purchase_price, selling_price, stock) VALUES (?, ?, ?, ?, ?, ?)',
        [name, hsn, sku, purchasePrice, sellingPrice, stock]
    );
    connection.release();
    res.json({ id: result.insertId, ...req.body });
});

// Similar routes for customers, invoices...

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## 🚀 **Deployment Options**

### **Backend Hosting**
- **Heroku** (Free tier available)
- **Railway** (New, easy setup)
- **Render** (Free tier)
- **AWS EC2** (Production)
- **DigitalOcean** (Affordable VPS)

### **Database Hosting**
- **AWS RDS** (Managed MySQL)
- **PlanetScale** (MySQL compatible, free)
- **Supabase** (PostgreSQL, free)
- **Firebase** (NoSQL, real-time)

### **Complete Stack Example**
```
Frontend: Vyapar (HTML/JS) → Netlify
Backend: Node.js API → Railway
Database: PostgreSQL → Supabase
```

---

## ✅ **Migration Checklist**

- [ ] Set up database tables
- [ ] Build API endpoints
- [ ] Add authentication
- [ ] Replace localStorage with API calls
- [ ] Test all CRUD operations
- [ ] Add error handling
- [ ] Set up logging
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Run end-to-end tests

---

## 🧪 **Testing API Integration**

### **Using Postman**
```
1. Import Vyapar API collection
2. Set auth token in header
3. Test each endpoint
4. Verify database updates
```

### **Using cURL**
```bash
# Get products
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/products

# Create product
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Barcode Scanner","hsn":"8471",...}'
```

---

## 📈 **Performance Optimization**

1. **Caching**: Implement browser caching for products
2. **Pagination**: Load invoices in batches
3. **Indexing**: Add DB indexes on frequently queried columns
4. **Compression**: Enable gzip on server
5. **CDN**: Use CloudFlare for static assets

---

## 🔄 **Sync Strategy for Offline Mode**

Support working offline with sync when online:

```javascript
// Queue offline requests
if (!navigator.onLine) {
    this.offlineQueue.push({ action: 'saveProduct', data });
} else {
    await this.saveProduct(data);
}

// Sync when online
window.addEventListener('online', () => {
    this.syncQueue();
});
```

---

**For questions**, refer to backend framework documentation or contact the development team.
