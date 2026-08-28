# Vyapar Backend - Quick Start (5 Minutes)

## ⚡ **Fastest Way to Get Started**

---

## ✅ **Step 1: Install Prerequisites** (2 min)

### **Check you have:**
```bash
node --version      # Should show v14+
npm --version       # Should show 6+
mysql --version     # Should show 5.7+
```

### **If not installed:**
- Node.js: https://nodejs.org/ (LTS version)
- MySQL: https://dev.mysql.com/downloads/mysql/

---

## ✅ **Step 2: Setup Project** (1 min)

```bash
# Create folder
mkdir vyapar-backend
cd vyapar-backend

# Copy these files here:
# - server.js
# - package.json
# - database.sql
# - .env.example

# Install dependencies
npm install
```

**Expected output:**
```
added 45 packages in 12s
```

---

## ✅ **Step 3: Setup Database** (1 min)

**Open MySQL:**
```bash
mysql -u root -p
```

**Run this in MySQL command line:**
```sql
CREATE DATABASE vyapar;
USE vyapar;
```

**Load schema** (from terminal, not MySQL):
```bash
mysql -u root -p vyapar < database.sql
```

**Verify tables exist:**
```bash
mysql -u root -p vyapar
SHOW TABLES;
SELECT COUNT(*) FROM products;
```

Should show: `products`, `customers`, `invoices`, `invoice_items`, `users`

---

## ✅ **Step 4: Configure Environment** (1 min)

```bash
# Copy template
cp .env.example .env

# Edit .env file
# Change these values:
# DB_HOST=localhost
# DB_USER=root
# DB_PASS=your_mysql_password
# DB_NAME=vyapar
# PORT=3000
```

**Edit in your text editor:**
```
DB_HOST=localhost
DB_USER=root
DB_PASS=YourPassword123
DB_NAME=vyapar
PORT=3000
NODE_ENV=development
JWT_SECRET=your_secret_key_here
```

---

## ✅ **Step 5: Start Server** (1 min)

```bash
npm start
```

**Expected output:**
```
🚀 Vyapar Backend running on http://localhost:3000
📊 API docs at http://localhost:3000/api/health
```

**🎉 Server is running!**

---

## 🧪 **Step 6: Test API** (Optional)

**In a new terminal window:**

```bash
# Test if server is running
curl http://localhost:3000/api/health

# Expected response:
# {"status":"OK","message":"Vyapar API running"}
```

**Get all products:**
```bash
curl http://localhost:3000/api/products
```

**Get all customers:**
```bash
curl http://localhost:3000/api/customers
```

---

## 🌐 **Step 7: Connect Frontend**

**Open in browser:** `vyapar-with-backend.html`

**Check console** (F12 → Console):
- Should show "Connected" with green status
- Products/Customers/Invoices should load

---

## ✅ **Checklist**

- [ ] Node.js installed
- [ ] MySQL installed & running
- [ ] Created vyapar database
- [ ] Ran database.sql schema
- [ ] Created .env file
- [ ] Updated DB credentials in .env
- [ ] Ran `npm install`
- [ ] Ran `npm start`
- [ ] Server running on :3000
- [ ] API responding to requests
- [ ] Frontend connects successfully

---

## 🎯 **Troubleshooting**

### **"npm: command not found"**
→ Install Node.js from nodejs.org

### **"MySQL connection failed"**
→ Check .env password is correct
→ Verify MySQL is running: `sudo service mysql status`

### **"Database vyapar not found"**
→ Run: `mysql -u root -p vyapar < database.sql`

### **"Port 3000 already in use"**
→ Change PORT in .env to 3001 or 8000

### **"Cannot GET /api/products"**
→ Server not running, check npm start output

### **Frontend shows "Disconnected"**
→ Verify API_URL in vyapar-with-backend.html is `http://localhost:3000/api`

---

## 🚀 **What's Next?**

### **Immediate:**
1. ✅ Backend running
2. ✅ Frontend connected
3. ✅ Test all API endpoints

### **This Week:**
1. Add sample data via API
2. Test invoice generation
3. Verify stock deduction
4. Check reports endpoint

### **Next Week:**
1. Deploy to cloud (Heroku/AWS)
2. Add authentication
3. Setup SSL/HTTPS
4. Configure backups

### **For Presentation:**
1. Demo local version (vyapar.html)
2. Mention backend capability
3. Show API architecture diagram
4. Emphasize "production-ready"

---

## 📊 **API Quick Reference**

```bash
# Products
curl http://localhost:3000/api/products                        # GET all
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","hsn":"8471","sku":"TEST-001","purchasePrice":1000,"sellingPrice":1500,"stock":10}'  # POST

# Customers
curl http://localhost:3000/api/customers                       # GET all
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","mobile":"+91-9876543210","city":"Mumbai","state":"Maharashtra"}'  # POST

# Invoices
curl http://localhost:3000/api/invoices                        # GET all

# Reports
curl http://localhost:3000/api/reports/summary                 # Business summary

# Health
curl http://localhost:3000/api/health                          # Server status
```

---

## 📝 **File Reference**

| File | Purpose |
|------|---------|
| server.js | Express server (run with `npm start`) |
| database.sql | MySQL schema (run once to setup DB) |
| .env.example | Template (copy to .env, edit values) |
| .gitignore | Git ignore rules |
| package.json | Dependencies (run `npm install`) |

---

## 🎓 **For More Info**

- **Setup Details**: BACKEND-SETUP.md
- **API Documentation**: API-INTEGRATION.md
- **Deployment**: DEPLOYMENT.md
- **Features**: FEATURES.md
- **Demo Script**: PRESENTATION-GUIDE.md

---

## 🎉 **You're Done!**

Your Vyapar backend is now:
- ✅ Running on http://localhost:3000
- ✅ Connected to MySQL database
- ✅ Ready to serve API requests
- ✅ Ready to scale to production

**Next:** Open `vyapar-with-backend.html` in browser and watch it connect! 🚀

---

**Questions?** Check BACKEND-SETUP.md for detailed troubleshooting
