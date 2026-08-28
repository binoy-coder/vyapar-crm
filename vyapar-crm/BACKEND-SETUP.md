# Vyapar Backend Setup Guide

## Complete Installation & Configuration for Production

---

## 📋 **Prerequisites**

Before starting, ensure you have:

1. **Node.js** (v14+) - [Download](https://nodejs.org/)
2. **MySQL** (v5.7+) - [Download](https://dev.mysql.com/downloads/)
3. **Git** (optional) - [Download](https://git-scm.com/)
4. **Postman** (for testing APIs) - [Download](https://www.postman.com/)

### **Verify Installation**
```bash
node --version      # Should show v14+
npm --version       # Should show 6+
mysql --version     # Should show 5.7+
```

---

## 🚀 **Quick Start (5 minutes)**

### **Step 1: Clone/Download Files**
```bash
# Create project folder
mkdir vyapar-backend
cd vyapar-backend

# Copy all backend files here:
# - server.js
# - package.json
# - database.sql
# - .env.example
```

### **Step 2: Install Dependencies**
```bash
npm install
```

This installs:
- express (web framework)
- mysql2 (database driver)
- cors (cross-origin support)
- dotenv (environment variables)
- jsonwebtoken (authentication)
- bcryptjs (password hashing)

### **Step 3: Setup Database**

**Open MySQL:**
```bash
mysql -u root -p
```

**Run database script:**
```bash
# In MySQL command line
source database.sql;
```

Or manually:
```sql
CREATE DATABASE vyapar;
USE vyapar;
-- Run all SQL from database.sql file
```

### **Step 4: Configure Environment**
```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your values
# DB_HOST=localhost
# DB_USER=root
# DB_PASS=your_password
# DB_NAME=vyapar
# PORT=3000
```

### **Step 5: Start Server**
```bash
npm start
```

**Output:**
```
🚀 Vyapar Backend running on http://localhost:3000
📊 API docs at http://localhost:3000/api/health
```

### **Step 6: Test API**
```bash
# In another terminal, test health check
curl http://localhost:3000/api/health

# Expected response:
# {"status":"OK","message":"Vyapar API running"}
```

✅ **Backend is running!**

---

## 📊 **Database Schema Overview**

### **Tables Created:**

1. **products** - Inventory items
   - Fields: id, name, hsn, sku, purchase_price, selling_price, stock
   - Indexes: hsn, sku, stock

2. **customers** - Client profiles
   - Fields: id, name, mobile, city, state, gstin, outstanding_balance, total_purchased
   - Indexes: name, mobile, state

3. **invoices** - Sales records
   - Fields: id, customer_id, customer_name, subtotal, cgst, sgst, igst, total, status, tax_state
   - Indexes: customer_id, status, date

4. **invoice_items** - Invoice line items
   - Fields: id, invoice_id, product_id, product_name, hsn, quantity, price
   - Foreign keys: invoice_id, product_id

5. **users** - Multi-user authentication (optional)
   - Fields: id, username, password, email, role

### **Views Created:**
- low_stock_items
- sales_summary
- customer_balances
- top_products

---

## 🔌 **API Endpoints Reference**

### **Products**
```
GET    /api/products           - List all products
POST   /api/products           - Create product
GET    /api/products/:id       - Get single product
PUT    /api/products/:id       - Update product
DELETE /api/products/:id       - Delete product
```

**Example - Create Product:**
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Thermal Scanner",
    "hsn": "8471",
    "sku": "TBS-001",
    "purchasePrice": 4500,
    "sellingPrice": 6999,
    "stock": 10
  }'
```

### **Customers**
```
GET    /api/customers          - List all customers
POST   /api/customers          - Create customer
GET    /api/customers/:id      - Get single customer
PUT    /api/customers/:id      - Update customer
DELETE /api/customers/:id      - Delete customer
```

**Example - Create Customer:**
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Raj Kumar",
    "mobile": "+91-9876543210",
    "city": "Mumbai",
    "state": "Maharashtra"
  }'
```

### **Invoices**
```
GET    /api/invoices           - List all invoices
POST   /api/invoices           - Create invoice
GET    /api/invoices/:id       - Get single invoice
PUT    /api/invoices/:id/status - Update status
DELETE /api/invoices/:id       - Delete invoice
```

**Example - Create Invoice:**
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 1,
    "customerName": "Raj Kumar",
    "items": [
      {
        "productId": 1,
        "name": "Scanner",
        "hsn": "8471",
        "qty": 2,
        "price": 6999
      }
    ],
    "subtotal": 13998,
    "cgst": 1260,
    "sgst": 1260,
    "igst": 0,
    "total": 16518,
    "status": "Pending",
    "taxState": "intrastate"
  }'
```

### **Reports**
```
GET    /api/reports/summary    - Business summary (revenue, GST, etc.)
```

### **Health Check**
```
GET    /api/health             - Check if API is running
```

---

## 🧪 **Testing with Postman**

### **Setup Postman Collection:**

1. **Create New Collection: "Vyapar API"**

2. **Add Requests:**

**GET Products:**
- Method: GET
- URL: `http://localhost:3000/api/products`
- Click Send

**POST Product:**
- Method: POST
- URL: `http://localhost:3000/api/products`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "name": "Test Product",
  "hsn": "8471",
  "sku": "TEST-001",
  "purchasePrice": 1000,
  "sellingPrice": 1500,
  "stock": 5
}
```
- Click Send

Repeat for Customers, Invoices, etc.

---

## 🌐 **Connect Frontend to Backend**

### **Update Frontend Configuration:**

In `vyapar-with-backend.html`, at the top:
```javascript
const API_URL = 'http://localhost:3000/api';
```

Change to your backend URL:
```javascript
// Local development
const API_URL = 'http://localhost:3000/api';

// Production
const API_URL = 'https://yourdomain.com/api';
```

### **Enable CORS (if frontend on different domain)**

In `server.js`, CORS is already configured:
```javascript
app.use(cors());
```

For specific domains:
```javascript
app.use(cors({
    origin: ['http://localhost:3000', 'https://yourdomain.com'],
    credentials: true
}));
```

---

## 🔒 **Security Configuration**

### **1. Environment Variables**

**Create `.env` file:**
```bash
cp .env.example .env
```

**Edit `.env`:**
```
DB_HOST=localhost
DB_USER=root
DB_PASS=StrongPassword123!
DB_NAME=vyapar
PORT=3000
NODE_ENV=production
JWT_SECRET=your_super_secret_jwt_key_change_this
CORS_ORIGIN=https://yourdomain.com
```

### **2. Database Security**

```bash
# Create limited database user (don't use root in production)
mysql -u root -p

CREATE USER 'vyapar'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON vyapar.* TO 'vyapar'@'localhost';
FLUSH PRIVILEGES;
```

### **3. Password Hashing**

Update `server.js` to hash passwords:
```javascript
const bcrypt = require('bcryptjs');

app.post('/api/users', async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    // Save hashedPassword to database
});
```

### **4. JWT Authentication**

Enable authentication in `server.js`:
```javascript
// Add authenticateToken middleware to protected routes
app.get('/api/products', authenticateToken, async (req, res) => {
    // Only authenticated users can access
});
```

---

## 📈 **Production Deployment**

### **Option 1: Heroku (Easy)**

```bash
# Login to Heroku
heroku login

# Create app
heroku create vyapar-api

# Set environment variables
heroku config:set DB_HOST=your_db_host
heroku config:set DB_USER=your_user
heroku config:set DB_PASS=your_password

# Deploy
git push heroku main

# Check logs
heroku logs --tail
```

### **Option 2: AWS EC2**

```bash
# SSH into server
ssh -i key.pem ubuntu@your-server.com

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL
sudo apt-get install -y mysql-server

# Clone repo & install
git clone your-repo
cd vyapar-backend
npm install

# Start with PM2
npm install -g pm2
pm2 start server.js --name "vyapar-api"
pm2 startup
pm2 save
```

### **Option 3: DigitalOcean App Platform**

1. Connect GitHub repository
2. Create `.do/app.yaml`:
```yaml
name: vyapar-backend
services:
- name: api
  github:
    repo: your-username/vyapar-backend
    branch: main
  build_command: npm install
  run_command: npm start
  http_port: 3000
  envs:
  - key: DB_HOST
    value: ${db.host}
  - key: DB_USER
    value: ${db.username}
  - key: DB_PASS
    value: ${db.password}
  - key: DB_NAME
    value: ${db.name}
databases:
- name: db
  engine: MYSQL
  version: "8"
```

3. Deploy via DigitalOcean console

---

## 🚨 **Troubleshooting**

### **Issue: "Cannot connect to database"**

**Solution:**
```bash
# Check MySQL is running
sudo service mysql status

# Start MySQL if stopped
sudo service mysql start

# Verify credentials in .env
# Test connection:
mysql -h localhost -u root -p vyapar
```

### **Issue: "Port 3000 already in use"**

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### **Issue: "CORS error"**

**Solution:**
Update frontend API_URL to match backend URL. If on same server, use:
```javascript
const API_URL = '/api'; // Relative URL
```

### **Issue: "401 Unauthorized"**

**Solution:**
- Check JWT token is valid
- Verify JWT_SECRET in .env
- Ensure token is in Authorization header:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/products
```

---

## 📊 **Database Backup & Restore**

### **Backup**
```bash
mysqldump -u root -p vyapar > vyapar_backup.sql
```

### **Restore**
```bash
mysql -u root -p vyapar < vyapar_backup.sql
```

### **Automated Daily Backup**
```bash
# Add to crontab
0 2 * * * mysqldump -u root -p'password' vyapar > /backups/vyapar_$(date +\%Y\%m\%d).sql
```

---

## 🔍 **Monitoring & Logs**

### **View Server Logs**
```bash
# Real-time logs
npm start

# Or with logging file
npm start > logs/vyapar.log 2>&1 &
tail -f logs/vyapar.log
```

### **Database Query Logs**
```bash
# Enable in MySQL
mysql> SET GLOBAL general_log = 'ON';
mysql> SET GLOBAL log_output = 'TABLE';
mysql> SELECT * FROM mysql.general_log;
```

### **Performance Monitoring**
```bash
# Check slow queries
SELECT * FROM mysql.slow_log;

# Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2; -- 2 seconds
```

---

## ✅ **Production Checklist**

- [ ] Database secured (not using root user)
- [ ] Environment variables configured (.env)
- [ ] HTTPS enabled (SSL certificate)
- [ ] CORS configured for frontend domain
- [ ] JWT authentication enabled
- [ ] Passwords hashed with bcrypt
- [ ] Rate limiting configured
- [ ] Database backups automated
- [ ] Error logging setup
- [ ] Monitoring enabled
- [ ] Database indexed properly
- [ ] Firewalls configured
- [ ] Load balancer setup (if needed)

---

## 📚 **Next Steps**

1. **Local Testing**: Verify all APIs work locally
2. **Frontend Connection**: Connect Vyapar frontend to this backend
3. **Multi-user Setup**: Enable authentication
4. **Payment Integration**: Add Razorpay/PayU integration
5. **Mobile App**: Build React Native/Flutter app using same APIs
6. **Advanced Analytics**: Add reporting dashboard

---

## 📞 **Support**

- **API Documentation**: See API-INTEGRATION.md
- **Deployment Help**: See DEPLOYMENT.md
- **Frontend Setup**: See README.md
- **Issues**: Check TROUBLESHOOTING section above

---

**Backend is now live and ready to serve Vyapar!** 🎉

Version: 1.0  
Last Updated: August 2026
