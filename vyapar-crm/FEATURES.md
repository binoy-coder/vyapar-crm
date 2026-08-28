# Vyapar Features Documentation

## Complete Feature Breakdown & User Guide

---

## 📊 **1. Dashboard**

### **Purpose**

Real-time overview of business health and daily metrics.

### **Key Metrics (KPI Cards)**

#### **Today's Revenue**

- Shows revenue generated in current day
- Counts only invoices created today
- Updates in real-time as bills are created
- Example: ₹8,259.00

#### **Pending Receivables**

- Total amount of unpaid invoices
- Filter: status = "Pending"
- Helps track outstanding customer payments
- Example: ₹14,938.00

#### **Low Stock Items**

- Count of products with stock < 5 units
- Auto-updates inventory changes
- Helps with stock management
- Example: 2 items

#### **Total Customers**

- Count of all registered customers
- Updates when customer added
- Example: 5 active customers

### **Visual Elements**

#### **7-Day Sales Chart**

- Bar chart showing daily revenue
- 7-day rolling window
- Color: Gradient gold
- Heights proportional to daily revenue
- Helps identify sales trends

#### **Recent Invoices Table**

- Shows last 5 invoices
- Columns: Invoice #, Customer, Amount, Status, Date
- Status badges: Paid (green) / Pending (gold)
- Clickable: Click invoice to view details

### **Use Cases**

- Morning business review
- Check today's sales
- Identify pending payments
- Track inventory alerts
- Monitor customer growth

---

## 📦 **2. Inventory Management**

### **Purpose**

Track products, stock levels, and HSN codes for GST compliance.

### **Product Catalog Features**

#### **Add Product**

**Dialog Form:**

- Item Name (required) - Product description
- HSN Code (required) - 4-digit tax code
- SKU (required) - Unique identifier
- Purchase Price - Buying cost from supplier
- Selling Price - Price to customers
- Stock Quantity - Current units

**Example:**

```
Name: Thermal Barcode Scanner
HSN: 8471
SKU: TBS-001
Buy: ₹4,500
Sell: ₹6,999
Stock: 12 units
```

#### **Product Table**

Columns:

- **Name** - Product name
- **HSN Code** - Tax code for GST
- **SKU** - Internal code
- **Purchase Price** - Cost
- **Selling Price** - Revenue price
- **Stock** - Current quantity
- **Status** - In Stock / Low Stock
- **Actions** - Edit, Delete buttons

#### **Low Stock Alert**

- Products with stock < 5 units show "Low Stock" badge
- Red color indicates urgency
- Helps prevent stockouts
- Visible in both Inventory tab and Dashboard

### **Search & Filter**

- Real-time search
- Search by: Name, SKU, or HSN Code
- Results update instantly
- Clear search to see all

### **Actions**

- **Add** - Click "+ Add Product" button
- **Edit** - Edit feature coming soon
- **Delete** - Removes product (confirmation required)
- **Auto-deduction** - Stock deducts on invoice generation

### **Use Cases**

- Stock management
- Product registration
- HSN code tracking
- Purchase planning
- Supplier comparison

---

## 👥 **3. CRM (Customer Relationship Management)**

### **Purpose**

Manage customer profiles, track relationships, and maintain history.

### **Customer Directory**

#### **Add Customer**

**Dialog Form:**

- Customer Name (required)
- Mobile Number (required) - 10-11 digits
- City - Location city
- State - Indian state
- Auto fields: Outstanding Balance (₹0), Total Purchased (₹0)

**Example:**

```
Name: Priya Singh
Mobile: +91-98765-43210
City: New Delhi
State: Delhi
```

#### **Customer Table**

Columns:

- **Name** - Full name
- **Mobile** - Contact number
- **City/State** - Location
- **Outstanding Balance** - Amount owed
- **Total Purchased** - Lifetime sales
- **Actions** - Edit button

#### **Customer History**

- Auto-updates on invoice generation
- Outstanding Balance: Sum of pending invoices
- Total Purchased: Sum of all invoice totals

### **Search & Filter**

- Search by Name or Mobile Number
- Real-time filtering
- Partial match supported

### **Edit Customer**

- Edit feature: Coming soon
- Will allow updating contact info
- Planned: Edit outstanding balance status

### **Use Cases**

- Client management
- Communication tracking
- Payment follow-up
- Customer lifetime value
- Repeat customer identification

---

## 💳 **4. Billing (Fast POS Terminal)**

### **Purpose**

Fast invoice generation with automatic GST calculation and inventory deduction.

### **POS Interface**

#### **1. Customer Selection**

Two options:

- **Select from dropdown** - Existing customers
- **Enter new customer name** - One-time customer

#### **2. Product Selection**

- Dropdown: "Add Product to Bill"
- Shows: Product name + Selling Price
- Stock must be > 0
- Error if product out of stock

#### **3. Item Cart**

**Table with:**

- Product name
- HSN Code (for GST reference)
- Unit Price
- Quantity (editable via input)
- Tax Rate (18% displayed)
- Line Total (Price × Qty)
- Remove button per item

**Features:**

- Change quantity on the fly
- Remove items individually
- Table auto-calculates totals
- Click quantity field to update

#### **4. Tax Calculation**

**Intrastate (Same State):**

```
Subtotal:     ₹6,999
CGST (9%):    ₹  630
SGST (9%):    ₹  630
─────────────────────
Total:        ₹8,259
```

**Interstate (Different State):**

```
Subtotal:     ₹6,999
IGST (18%):   ₹1,260
─────────────────────
Total:        ₹8,259
```

**Toggle:** Dropdown to select "Intrastate" or "Interstate"

### **Invoice Generation**

#### **Generate Bill**

1. Customer selected/entered ✓
2. Products added to cart ✓
3. Click "✓ Complete & Generate Bill"
4. System creates:
   - Unique Invoice ID (INV-2024-001)
   - Deducts inventory stock
   - Records in invoice list
   - Shows professional invoice

#### **After Generation**

- Professional invoice displayed
- UPI QR code generated
- Option to print
- Success message shown
- Bill form resets

### **Reset Bill**

- Clears all items
- Resets customer selection
- Resets tax type
- Ready for next bill

### **Use Cases**

- Point-of-sale transactions
- Counter billing
- Invoice generation
- Real-time stock updates
- Fast checkout (< 1 minute)

---

## 📄 **5. Invoices (Invoice Management)**

### **Purpose**

View, manage, and print professional tax invoices.

### **Invoice History**

#### **Invoice List Table**

Columns:

- **Invoice #** - Unique ID (INV-2024-XXX)
- **Customer** - Customer name
- **Amount (₹)** - Total invoice value
- **Tax** - Total GST/IGST
- **Status** - Paid / Pending badge
- **Date** - Invoice creation date
- **Actions** - View button

#### **Status Badges**

- **Paid** - Green badge (पेड in Hindi)
- **Pending** - Gold badge (पेंडिंग in Hindi)

### **Invoice Details View**

#### **Header Section**

- Business Name: Vyapar Solutions Pvt Ltd
- GSTIN: 18AABCR1234H1Z0
- PAN: AABCR1234H
- Address: Vyapar Bhawan, Business Park, Navi Mumbai
- Invoice #: INV-2024-001
- Date & Due Date

#### **Customer Section**

- Bill To: Customer name
- Mobile / City / State
- Customer ID

#### **Items Table**

Columns:

- Description (Product name)
- HSN/SAC Code
- Quantity
- Unit Price
- Tax Rate (18%)
- Amount

**Example:**

```
Thermal Barcode Scanner | 8471 | 1 | ₹6,999 | 18% | ₹6,999
```

#### **Tax Calculation**

**Intrastate Invoice:**

```
Subtotal (before tax):    ₹6,999.00
CGST @ 9%:                ₹  629.91
SGST @ 9%:                ₹  629.91
─────────────────────────────────────
Total Amount Payable:     ₹8,258.82
```

**Interstate Invoice:**

```
Subtotal (before tax):    ₹6,999.00
IGST @ 18%:               ₹1,259.82
─────────────────────────────────────
Total Amount Payable:     ₹8,258.82
```

#### **Bank Details Section**

- Bank: HDFC Bank
- Account: 50123456789
- IFSC: HDFC0000123
- UPI: vyapar@hdfc

#### **UPI QR Code**

- Scannable QR code
- Links to UPI payment
- Amount pre-filled
- Customer can pay instantly
- Generated dynamically

#### **Footer**

- "Digital Invoice - No signature required"
- GST compliance notice
- Professional closing

### **Invoice Actions**

#### **Print**

- Browser print dialog (Ctrl+P)
- Select "Print to PDF"
- Professional output
- All details included

#### **View**

- Click "View" button on any invoice
- Opens invoice modal
- Full invoice display
- Print & Close options

### **Use Cases**

- Customer invoice lookup
- GST compliance
- Payment tracking
- Print/email invoices
- Audit trail

---

## 📈 **6. Reports (Business Analytics)**

### **Purpose**

Analyze business metrics, revenue trends, and product performance.

### **KPI Summary**

#### **Total Revenue**

- Sum of all invoice totals
- Includes all invoices (Paid + Pending)
- Example: ₹25,197.00

#### **Total GST Collected**

- Sum of all CGST + SGST + IGST
- Used for GST filing
- Example: ₹4,537.64

#### **Invoice Count**

- Total invoices generated
- Includes all invoices
- Example: 5 invoices

#### **Average Invoice Value**

- Total Revenue ÷ Invoice Count
- Helps understand order size
- Example: ₹5,039.40

### **Top Products Report**

#### **Table Columns**

- **Product** - Product name
- **Units Sold** - Total quantity sold
- **Revenue** - Total sales value
- **% of Total** - Percentage of total revenue

#### **Example Report:**

```
Product               | Units | Revenue  | % Total
Thermal Scanner       |   1   | ₹6,999   | 27.8%
Label Roll Pack       |  10   | ₹2,490   | 9.9%
Cash Drawer           |   1   | ₹5,499   | 21.8%
```

#### **Insights**

- Best-selling products
- Revenue concentration
- Product mix analysis
- Demand patterns

### **Use Cases**

- Monthly business review
- GST filing preparation
- Product strategy
- Revenue forecasting
- Team performance review

---

## ⚙️ **Advanced Features**

### **Data Persistence**

- **Auto-save** - Every action saves to localStorage
- **Crash recovery** - Reopen app, data intact
- **Clear data** - localStorage.removeItem('vyaparData')

### **Responsive Design**

- Desktop: Full layout
- Tablet: Optimized columns
- Mobile: Stacked layout
- Touch-friendly buttons

### **Bilingual Support**

- **Dashboard**: "बीजक" (Invoices) + English
- **CRM**: "ग्राहक" (Customers) labels
- **Inventory**: "इन्वेंटरी" labels
- Mix of Hindi/English throughout

### **Dark Mode UI**

- Eye-friendly dark theme
- Gold accents for CTA
- High contrast text
- Professional startup look

### **Offline Capability**

- Works without internet
- Data stored locally
- No API calls required
- Perfect for retail environment

---

## 🔐 **Data Integrity**

### **Validation**

- Empty field checks
- Numeric field validation
- Phone number format
- Duplicate SKU prevention

### **Error Handling**

- User-friendly error messages
- Modal alerts
- Success notifications
- Graceful degradation

### **Data Recovery**

- Browser back button safe
- No data loss on refresh
- Invoice history preserved
- Inventory tracked

---

## 🎯 **Workflow Examples**

### **Daily Workflow**

```
1. Open app (8:00 AM)
2. Check Dashboard KPIs
3. Add new products (if needed)
4. Process customer bills (8-5 PM)
5. Check Reports (5:00 PM)
6. Close app (auto-saved)
```

### **New Customer**

```
1. Go to CRM tab
2. Click "+ Add Customer"
3. Enter name, mobile, city, state
4. Click "Add Customer"
5. Ready to bill this customer
```

### **Complete Sale**

```
1. Billing tab
2. Select/Add customer
3. Add products to cart
4. Verify quantities
5. Check GST (Intrastate/Interstate)
6. Click "Generate Bill"
7. Print or Close
8. Inventory auto-updates
9. Invoice saved
```

### **GST Compliance**

```
1. Reports tab
2. Note "Total GST Collected"
3. Export invoice list
4. Prepare GST-3B form
5. File with authorities
```

---

## 🎨 **UI Components**

### **KPI Cards**

- Hover effects
- Smooth transitions
- Icon + Value + Metric

### **Tables**

- Sortable columns (planned)
- Row hover highlight
- Compact design
- Action buttons per row

### **Modals**

- Centered overlay
- Smooth entrance
- Form validation
- Save/Cancel options

### **Buttons**

- Primary (Gold) - Main actions
- Secondary (Outlined) - Alternative
- Danger (Red) - Delete actions

### **Badges**

- Paid (Green)
- Pending (Gold)
- Low Stock (Red)

---

## 📋 **Keyboard Shortcuts** (Future)

- `Ctrl+N` - New Invoice
- `Ctrl+I` - Inventory
- `Ctrl+C` - Customers
- `Ctrl+R` - Reports
- `Ctrl+P` - Print (browser default)
- `Esc` - Close modal

---

## 🎁 **Premium Features** (Future)

- Multi-user login
- Cloud sync
- Email invoices
- SMS notifications
- Expense tracking
- Tax filing automation
- Mobile app
- Advanced analytics

---

**For questions**, refer to README.md or contact support@vyapar.com
