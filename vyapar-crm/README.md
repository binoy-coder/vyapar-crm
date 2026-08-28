# Vyapar — Bharat's Smart Business CRM & ERP System

**Author**: Binoy  
**Project Type**: Full-Stack Web Application (Internship Submission)  
**Tech Stack**: JavaScript (ES6+), Node.js, Express.js, SQLite / MySQL, CSS3, HTML5  
**Live Deployments**: Netlify (Frontend) + Render (Backend)

---

## 📌 Project Summary

**Vyapar** is a full-stack business management and ERP web application tailored for Indian retailers, wholesalers, and small businesses. It provides an all-in-one suite for real-time inventory tracking, customer relationship management (CRM) with credit ledger tracking, fast POS billing with automated Indian GST tax computation (Intrastate CGST+SGST vs Interstate IGST), official GST tax invoice generation, and business intelligence analytics.

---

## 🌟 Key Features & Modules

### 1. 📊 Interactive Executive Dashboard
- Real-time KPI summary cards: Total Lifetime Revenue, Pending Credit Receivables, Low Stock Alerts (&lt; 5 units), and Active Customers.
- Interactive 7-Day Rolling Revenue Bar Chart with hover tooltips showing daily sales and bill volume.
- Quick navigation shortcuts and recent invoices ledger.

### 2. 📦 Inventory & Stock Management
- Complete product catalog tracking with SKU codes, HSN codes (4–8 digits for GST compliance), cost prices, and selling prices.
- Live profit margin % calculator during product creation.
- Real-time stock decrement upon billing and automatic stock restoration upon invoice deletion.
- Search and multi-criteria filters (by Category, Low Stock, In Stock).
- CSV Inventory Catalog Export.

### 3. 👥 Customer Relationship Management (CRM)
- Customer directory with contact details, GSTIN, city, and state.
- Automated outstanding credit ledger tracking lifetime purchases vs dues.
- Direct 1-click WhatsApp messaging button for payment reminders and receipts.
- Fast payment settlement modal with instant ledger reconciliation.

### 4. ⚡ Fast POS Billing Terminal
- Quick customer selection or instant inline customer registration.
- Live product picker with stock counters and item price overrides.
- Dual-mode Indian GST calculation engine:
  - **Intrastate**: 9% CGST + 9% SGST
  - **Interstate**: 18% IGST
- Dynamic discount input and flexible payment modes (Cash, UPI, Card, NetBanking, Credit).
- Synthesized audio chime confirmation upon bill generation.

### 5. 📄 Tax Invoices & Print Engine
- Searchable invoice ledger with filter by payment status (Paid / Pending).
- 1-click status toggle (Pending ↔ Paid) with automatic customer ledger update.
- Printable GST-compliant Tax Invoices including:
  - Indian Rupee notation and automated Number-to-Words amount converter (e.g. *Fourteen Thousand Rupees Only*).
  - Business GSTIN, Customer details, HSN breakdown, authorized signature line.
  - Formatted print styling (`@media print`) for A4 and thermal POS receipt printing.

### 6. 📈 Business Intelligence & GST Analytics
- Financial metrics breakdown: Gross Sales, Tax Realized, Average Order Value.
- Top 5 Best-Selling Products by units sold and revenue share with visual progress bars.
- GSTR-1 ready tax output summary (CGST, SGST, IGST totals).
- Full Sales & Invoices CSV spreadsheet export.

---

## 🛠️ Architecture & Tech Stack

```
Frontend (SPA on Netlify)
  │
  ├── HTML5 Semantic UI + CSS3 Custom Design System (Glassmorphism)
  ├── Vanilla JavaScript (ES6+ Classes & Async/Await Controller)
  │
  ▼ REST API (HTTP / JSON / CORS)
  │
Backend (REST API on Render)
  │
  ├── Node.js + Express.js Web Server
  ├── CORS Middleware & Security Headers
  │
  ▼ Data Layer
  │
Database
  ├── Primary: Zero-config SQLite (vyapar.db) with auto-migration & seed data
  └── Optional: MySQL / PostgreSQL via DB_HOST environment variable
```

---

## 🚀 Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- npm

### Installation & Run

1. **Clone or open the repository**:
   ```bash
   cd CRM
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the backend server**:
   ```bash
   npm start
   ```
   *The server will start on `http://localhost:5000` with the embedded SQLite database initialized and pre-seeded with sample Indian business data.*

4. **Access the application**:
   - Open `http://localhost:5000` in your web browser.
   - Or open `index.html` directly in your browser.

---

## 🌐 Cloud Deployment Guide

Detailed step-by-step instructions for deploying to cloud platforms are available in **[`DEPLOYMENT-SHEET.md`](./DEPLOYMENT-SHEET.md)**:

- **Frontend Deployment**: Deployed on **Netlify** (Publish Directory: `.`)
- **Backend Deployment**: Deployed on **Render** (Build Command: `npm install`, Start Command: `node server.js`)
- **Connecting Both**: Enter your live Render URL inside the Frontend Settings dialog.

---

## 🧪 REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server and database status check |
| `GET` | `/api/products` | Retrieve all inventory products |
| `POST` | `/api/products` | Create a new product |
| `PUT` | `/api/products/:id` | Update product details |
| `DELETE` | `/api/products/:id` | Delete product |
| `GET` | `/api/customers` | Retrieve customer directory |
| `POST` | `/api/customers` | Add a new customer |
| `POST` | `/api/customers/:id/payment` | Settle outstanding balance |
| `GET` | `/api/invoices` | List all tax invoices |
| `POST` | `/api/invoices` | Generate invoice & decrement stock |
| `PUT` | `/api/invoices/:id/status` | Toggle invoice status (Paid/Pending) |
| `DELETE` | `/api/invoices/:id` | Cancel invoice & restore inventory stock |
| `GET` | `/api/reports/summary` | Analytics & GSTR-1 tax breakdown |

---

## 📜 License & Acknowledgments

Developed by **Binoy** for internship assessment and practical coursework evaluation.
Distributed under the MIT License.
