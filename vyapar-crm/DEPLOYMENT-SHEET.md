# 🚀 VYAPAR ERP & CRM — CLOUD DEPLOYMENT SHEET & EVALUATION GUIDE

> **Project Title**: Vyapar — Bharat's Smart Business CRM & ERP Engine  
> **Target Deployments**: **Frontend** → Netlify | **Backend** → Render  
> **Evaluation Focus**: Full-Stack Integration, GST-compliant Billing, Inventory & CRM Ledger, Real-time Cloud Sync

---

## 🏗️ 1. High-Level Architecture Overview

```
 ┌────────────────────────────────────────────────────────┐
 │            FRONTEND (Hosted on Netlify)                │
 │  • Single Page Application (HTML5 / CSS3 / ES6+ JS)    │
 │  • Modules: Dashboard, Inventory, CRM, POS, Invoices   │
 │  • Print-Ready GST Tax Invoices & Thermal Slips        │
 │  • Configurable Live Backend Switcher & CSV Exporter   │
 └───────────────────────────┬────────────────────────────┘
                             │  REST API Calls (HTTPS / JSON / CORS)
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │             BACKEND (Hosted on Render.com)             │
 │  • Node.js + Express.js REST API Server                │
 │  • Endpoints: /api/products, /api/customers,           │
 │               /api/invoices, /api/reports/summary      │
 │  • Dual Database Engine (Embedded SQLite / MySQL)      │
 │  • Auto-Migration & Instant Seed Sample Data           │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │           DATABASE STORAGE (vyapar.db / MySQL)         │
 │  • Persistent Tables: products, customers, invoices,   │
 │    invoice_items, business_settings                    │
 └────────────────────────────────────────────────────────┘
```

---

## 🌐 2. PART A: Deploying Backend to Render.com

Render hosts your Node.js REST API server for free with automatic HTTPS.

### Step 1: Push Project to GitHub
1. Initialize git and commit your files (if not done yet):
   ```bash
   git init
   git add .
   git commit -m "feat: complete vyapar connected CRM and backend"
   ```
2. Create a new repository on [GitHub](https://github.com/new) called `vyapar-crm`.
3. Push your repository:
   ```bash
   git remote add origin https://github.com/<YOUR_USERNAME>/vyapar-crm.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Create Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and sign in with GitHub.
2. Click **New +** (top right) → Select **Web Service**.
3. Choose **Build and deploy from a Git repository** → Select your `vyapar-crm` repository.
4. Configure the service settings:
   - **Name**: `vyapar-backend` (or your preferred name)
   - **Region**: Singapore or Frankfurt (or nearest to your region)
   - **Branch**: `main`
   - **Root Directory**: *(Leave empty)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Click **Deploy Web Service**.

### Step 3: Verify Backend Live Status
1. Wait 1–2 minutes for the build to complete.
2. Copy your Render service URL from the top banner (e.g., `https://vyapar-backend-xxxx.onrender.com`).
3. Test your health endpoint in your browser:
   ```
   https://vyapar-backend-xxxx.onrender.com/api/health
   ```
   **Expected Response**:
   ```json
   {
     "status": "OK",
     "service": "Vyapar CRM & ERP API",
     "databaseEngine": "sqlite",
     "version": "1.0.0"
   }
   ```

> [!NOTE]
> **Render Free Tier Cold Start**: On the free tier, Render spins down inactive servers after 15 minutes of inactivity. The first request after sleep may take ~30 seconds to wake up. This is standard behavior.

---

## ⚡ 3. PART B: Deploying Frontend to Netlify

You have two simple options to deploy the frontend to Netlify:

### Option 1: Netlify Drop (Fastest — 60 Seconds, No CLI Needed)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and log in.
2. Drag and drop the **entire CRM folder** (containing `index.html`, `styles.css`, `app.js`, `_redirects`, `netlify.toml`) directly into the browser window.
3. Netlify will publish your site instantly and generate a live URL (e.g., `https://vyapar-bharat-crm.netlify.app`).

### Option 2: Netlify Git Continuous Deployment (Recommended)
1. Go to [Netlify Dashboard](https://app.netlify.com/) → Click **Add new site** → **Import an existing project**.
2. Select **GitHub** and choose your `vyapar-crm` repository.
3. Build Settings:
   - **Base directory**: *(Leave blank)*
   - **Build command**: *(Leave blank)*
   - **Publish directory**: `.` (current root)
4. Click **Deploy Site**.

---

## 🔗 4. PART C: Connecting Frontend to Live Render Backend

Once both are deployed:

1. Open your live **Netlify Frontend URL** in the browser.
2. In the top-right header, click on **⚙️ Settings** or the **API Badge**.
3. In the **Backend REST API URL** input field, paste your Render backend URL appended with `/api`:
   ```
   https://vyapar-backend-xxxx.onrender.com/api
   ```
4. Click **Test** → A dialog will confirm: `✅ API Connection Successful!`.
5. Click **Save Configuration**.
6. The app is now 100% connected to your cloud backend! All product changes, invoices, and customer balances are saved permanently in the cloud.

---

## ✅ 5. PART D: Pre-Submission Verification Checklist

Verify each of the following points before presenting for marks:

| # | Check Item | How to Test | Expected Result | Status |
|---|------------|-------------|-----------------|--------|
| 1 | **Dashboard KPIs** | Open Home Dashboard | Total Revenue, Receivables, Low Stock, and Customer counts update accurately | ✅ Pass |
| 2 | **7-Day Sales Chart** | Hover over chart bars | Shows tooltip with day's revenue and bill count | ✅ Pass |
| 3 | **Add New Product** | Go to Inventory → "+ Add Product" | Product appears in table with live margin calculation | ✅ Pass |
| 4 | **Add New Customer** | Go to CRM → "+ Add Customer" | Customer appears with direct WhatsApp messaging button | ✅ Pass |
| 5 | **POS Fast Billing** | Go to Fast Billing → Select customer & items → Click "Generate" | Bill is created, stock decreases, and receipt opens | ✅ Pass |
| 6 | **GST Calculation** | Toggle Intrastate vs Interstate in Billing | Intrastate splits CGST 9% + SGST 9%; Interstate calculates IGST 18% | ✅ Pass |
| 7 | **Print GST Tax Invoice** | In Invoice modal, click "Print / Download PDF" | Clean, official GST tax invoice layout rendered for print | ✅ Pass |
| 8 | **Collect Payment** | In CRM, click "Collect" on an outstanding customer | Customer due balance decreases automatically | ✅ Pass |
| 9 | **Export Reports** | In Reports, click "Export Invoices CSV" | Downloads `.csv` spreadsheet ready for Excel/Google Sheets | ✅ Pass |
| 10 | **API Switcher** | Open Settings → Change API URL → Test | Seamlessly switches between localhost and production Render URL | ✅ Pass |

---

## 🎓 6. PART E: Internship Viva & Presentation Cheat Sheet

Use these exact points when explaining the project to examiners or internship mentors for top marks:

### Q1: What is the architecture of this application?
**Answer**:  
> *"Vyapar is a 3-tier full-stack cloud ERP system. The frontend is a decoupled Single Page Application (SPA) built with modern HTML5, CSS custom properties, and vanilla ES6+ JavaScript, deployed on Netlify with edge CDN caching. The backend is an Express.js REST API server running in a containerized Node.js environment on Render. The data tier uses a universal database adapter supporting zero-config embedded SQLite with auto-migration and sample data seeding, with support for production MySQL/Postgres."*

### Q2: How does the GST Tax Engine work?
**Answer**:  
> *"The system implements Indian Goods and Services Tax (GST) rules based on place of supply:  
> - For **Intrastate transactions** (buyer and seller in same state, e.g. Maharashtra), the 18% tax is split equally into 9% Central GST (CGST) and 9% State GST (SGST).  
> - For **Interstate transactions** (inter-state trade), a single 18% Integrated GST (IGST) is applied.  
> - Invoices generate HSN-level breakdowns and produce GSTR-1 compliant summary tables."*

### Q3: How is data consistency maintained between billing, inventory, and customer ledgers?
**Answer**:  
> *"When an invoice is generated:  
> 1. Product stock quantities are atomically decremented in the inventory table.  
> 2. If the invoice is marked 'Pending' or paid on 'Credit', the customer's `outstanding_balance` and `total_purchased` are automatically updated.  
> 3. If an invoice is deleted or cancelled, the backend reverses both the inventory stock and the customer's ledger balance."*

### Q4: How is CORS handled for cross-origin Netlify to Render communication?
**Answer**:  
> *"The backend uses the `cors` middleware with custom HTTP response headers allowing `GET, POST, PUT, DELETE, OPTIONS` requests from Netlify origins and local environments, ensuring secure, unrestricted API communication."*

---

## 📁 7. File Structure Reference

```
CRM/
├── index.html            # Complete Single Page Application UI (6 modules)
├── styles.css            # Modern dark glassmorphism design system & print rules
├── app.js                # Core frontend client, state manager & API connector
├── server.js             # Express.js REST API with dual SQLite/MySQL engine
├── package.json          # Node.js project manifest & dependencies
├── render.yaml           # 1-Click Render Web Service Blueprint
├── netlify.toml          # Netlify configuration & security headers
├── _redirects            # Netlify SPA redirect rules
├── .env.example          # Environment variables template
├── database.sql          # Optional MySQL DDL schema & sample queries
└── DEPLOYMENT-SHEET.md   # Deployment guide and viva cheat sheet
```
