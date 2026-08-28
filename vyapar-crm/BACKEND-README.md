# Vyapar Backend API

Complete Node.js/Express backend for Vyapar ERP system with MySQL database.

---

## 🚀 **Quick Start**

### **1 Minute Setup:**

```bash
# Install dependencies
npm install

# Setup database
# - Create database: CREATE DATABASE vyapar;
# - Run schema: mysql -u root -p vyapar < database.sql

# Configure environment
cp .env.example .env
# Edit .env with your DB credentials

# Start server
npm start
```

Server runs on `http://localhost:3000`

---

## 📁 **Project Structure**

```
vyapar-backend/
├── server.js              # Main Express server
├── package.json           # Dependencies
├── database.sql           # MySQL schema
├── .env.example          # Environment template
├── .gitignore            # Git ignore file
├── BACKEND-README.md     # This file
├── BACKEND-SETUP.md      # Detailed setup guide
└── logs/                 # Server logs (created)
```

---

## 📊 **Database**

**Tables:**
- `products` - Inventory items with HSN codes
- `customers` - Client profiles
- `invoices` - Sales records
- `invoice_items` - Line items per invoice
- `users` - Multi-user authentication

**Automatic Demo Data:**
- 4 products pre-loaded
- 3 sample customers
- 2 sample invoices

---

## 🔌 **API Endpoints**

### **Products**
```
GET    /api/products              List all
POST   /api/products              Create
PUT    /api/products/:id          Update
DELETE /api/products/:id          Delete
```

### **Customers**
```
GET    /api/customers             List all
POST   /api/customers             Create
PUT    /api/customers/:id         Update
DELETE /api/customers/:id         Delete
```

### **Invoices**
```
GET    /api/invoices              List all
POST   /api/invoices              Create
PUT    /api/invoices/:id/status   Update status
DELETE /api/invoices/:id          Delete
```

### **Reports**
```
GET    /api/reports/summary       Business summary
```

### **Health**
```
GET    /api/health                Server status
```

---

## 🧪 **Testing API**

**Using cURL:**
```bash
# Get all products
curl http://localhost:3000/api/products

# Create product
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Scanner","hsn":"8471","sku":"TBS-001","purchasePrice":4500,"sellingPrice":6999,"stock":10}'

# Create customer
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"Raj Kumar","mobile":"+91-9876543210","city":"Mumbai","state":"Maharashtra"}'

# Create invoice
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "customerId":1,
    "customerName":"Raj Kumar",
    "items":[{"productId":1,"name":"Scanner","hsn":"8471","qty":1,"price":6999}],
    "subtotal":6999,"cgst":630,"sgst":630,"igst":0,"total":8259,
    "status":"Pending","taxState":"intrastate"
  }'
```

**Using Postman:**
1. Import collection
2. Set base URL: `http://localhost:3000`
3. Test each endpoint

---

## 🔒 **Security Features**

✅ CORS enabled (configurable)  
✅ Input validation  
✅ SQL injection prevention (prepared statements)  
✅ Error handling  
✅ Environment variables for secrets  
✅ JWT ready (optional authentication)  
✅ Password hashing (bcryptjs)  

---

## 🌐 **Connect Frontend**

Update `vyapar-with-backend.html`:
```javascript
const API_URL = 'http://localhost:3000/api';
```

For production:
```javascript
const API_URL = 'https://api.yourdomain.com/api';
```

---

## 🚢 **Deployment**

### **Heroku**
```bash
heroku create vyapar-api
heroku config:set DB_HOST=... DB_USER=... DB_PASS=...
git push heroku main
```

### **AWS EC2**
```bash
sudo apt-get install nodejs mysql-server
git clone repo
npm install
pm2 start server.js
```

### **DigitalOcean**
Use App Platform with `.do/app.yaml`

See `DEPLOYMENT.md` for detailed instructions.

---

## 📝 **Features**

✅ Complete CRUD for products, customers, invoices  
✅ Automatic GST calculation (CGST/SGST/IGST)  
✅ HSN code tracking for tax compliance  
✅ Real-time inventory updates  
✅ Invoice status tracking  
✅ Business analytics & reports  
✅ Customer balance tracking  
✅ JSON response format  
✅ Error handling  
✅ Logging  

---

## 🐛 **Troubleshooting**

**Database connection error?**
```bash
# Check MySQL is running
sudo service mysql status

# Verify .env credentials
cat .env | grep DB_
```

**Port already in use?**
```bash
# Use different port
PORT=3001 npm start
```

**CORS error?**
- Update API_URL in frontend
- Or configure CORS in server.js

**Can't create invoice?**
- Ensure customer and products exist first
- Check stock availability

---

## 📚 **Documentation**

- **Setup Guide**: See `BACKEND-SETUP.md`
- **API Details**: See `API-INTEGRATION.md`
- **Deployment**: See `DEPLOYMENT.md`
- **Frontend**: See `vyapar-with-backend.html`

---

## 🔧 **Configuration**

**Edit `.env`:**
```
DB_HOST=localhost
DB_USER=root
DB_PASS=password
DB_NAME=vyapar
PORT=3000
NODE_ENV=production
JWT_SECRET=your_secret_key
```

**Edit `server.js`:**
- Add authentication routes
- Customize CORS origin
- Add rate limiting
- Add payment integration

---

## 📦 **Dependencies**

- **express** - Web framework
- **mysql2** - Database driver
- **cors** - Cross-origin support
- **dotenv** - Environment variables
- **jsonwebtoken** - Authentication
- **bcryptjs** - Password hashing

Install with:
```bash
npm install
```

---

## 🚀 **Next Steps**

1. Run backend locally
2. Test all API endpoints
3. Connect frontend (`vyapar-with-backend.html`)
4. Deploy to cloud (Heroku/AWS/DigitalOcean)
5. Add authentication (JWT)
6. Integrate payment gateway
7. Build mobile app

---

## 📞 **Support**

- Check logs: `npm start` (real-time) or `logs/` folder
- Test API: `curl http://localhost:3000/api/health`
- Database issues: Verify MySQL is running
- Port issues: Use different PORT=XXXX
- CORS issues: Update API_URL in frontend

---

**Backend Setup Complete!** ✅

Version: 1.0  
Last Updated: August 2026
