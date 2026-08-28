# Vyapar Deployment Guide

## Production Deployment Instructions

This guide covers deploying Vyapar to production environments.

---

## 🚀 **Quick Start Deployment**

### **Option 1: Netlify (Fastest - 2 minutes)**

1. **Create Account**
   - Visit [netlify.com](https://netlify.com)
   - Sign up with GitHub/Google

2. **Deploy**
   - Drag & drop `vyapar.html` onto Netlify
   - Automatic URL generated
   - Instant live deployment

3. **Share**
   - Copy your Netlify URL
   - Share with team/evaluators
   - App is live immediately

### **Option 2: GitHub Pages**

1. **Create Repository**
   ```bash
   git init
   git add vyapar.html README.md
   git commit -m "Add Vyapar ERP"
   git branch -M main
   git remote add origin https://github.com/username/vyapar.git
   git push -u origin main
   ```

2. **Enable Pages**
   - Go to Settings → Pages
   - Select "Deploy from branch" → main
   - Root directory
   - Save

3. **Access**
   - Visit: `https://username.github.io/vyapar/vyapar.html`
   - Updates automatically on push

### **Option 3: Vercel**

1. **Connect GitHub**
   - Import repository from GitHub
   - Select `vyapar.html` as entry point

2. **Deploy**
   - Vercel auto-deploys
   - Get instant URL

3. **Custom Domain** (Optional)
   - Add domain in Vercel settings
   - Update DNS records

---

## 🏠 **Self-Hosted Deployment**

### **Using Apache (Linux/Windows)**

1. **Copy Files**
   ```bash
   sudo cp vyapar.html /var/www/html/
   sudo chown -R www-data:www-data /var/www/html/
   ```

2. **Enable .htaccess**
   ```bash
   sudo a2enmod rewrite
   sudo systemctl restart apache2
   ```

3. **Access**
   - Visit: `http://yourdomain.com/vyapar.html`

### **Using Nginx**

1. **Copy Files**
   ```bash
   sudo cp vyapar.html /var/www/html/
   sudo chown -R www-data:www-data /var/www/html/
   ```

2. **Nginx Config** (`/etc/nginx/sites-available/default`)
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       root /var/www/html;
       
       location / {
           try_files $uri $uri/ =404;
       }
   }
   ```

3. **Enable**
   ```bash
   sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### **Using Node.js**

1. **Simple HTTP Server**
   ```bash
   npm install -g http-server
   http-server .
   # Access: http://localhost:8080/vyapar.html
   ```

2. **Production with PM2**
   ```bash
   npm install -g pm2
   pm2 start "http-server" --name "vyapar"
   pm2 startup
   pm2 save
   ```

### **Using Python**

1. **Python 3**
   ```bash
   python -m http.server 8000
   # Access: http://localhost:8000/vyapar.html
   ```

2. **Production Setup**
   ```bash
   # Use gunicorn
   pip install gunicorn
   gunicorn --bind 0.0.0.0:8000 --workers 4 app.py
   ```

---

## 🔐 **HTTPS/SSL Setup**

### **Using Let's Encrypt (Free)**

1. **Install Certbot**
   ```bash
   sudo apt-get install certbot python3-certbot-apache
   # or for nginx
   sudo apt-get install certbot python3-certbot-nginx
   ```

2. **Get Certificate**
   ```bash
   sudo certbot --apache -d yourdomain.com
   # or
   sudo certbot --nginx -d yourdomain.com
   ```

3. **Auto-Renewal**
   ```bash
   sudo certbot renew --dry-run
   # Automatic renewal runs via cron
   ```

### **Nginx SSL Config**
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    root /var/www/html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 📊 **Domain Setup**

### **Point Domain to Server**

1. **Get Nameservers**
   - From your hosting provider

2. **Update DNS**
   - Login to domain registrar
   - Update nameservers
   - Wait 24-48 hours for propagation

3. **Verify**
   ```bash
   nslookup yourdomain.com
   # Should show your server IP
   ```

---

## ⚙️ **Performance Optimization**

### **Enable Caching**

**Nginx**
```nginx
location ~* \.(html|css|js|png|jpg|jpeg|gif|ico|svg)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

**Apache** (.htaccess)
```apache
<FilesMatch "\.(html|css|js|png|jpg|jpeg|gif|ico|svg)$">
    Header set Cache-Control "max-age=2592000, public"
</FilesMatch>
```

### **Enable Gzip Compression**

**Nginx**
```nginx
gzip on;
gzip_types text/plain text/css text/javascript application/json;
gzip_min_length 256;
```

**Apache**
```apache
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/css text/javascript application/json
</IfModule>
```

---

## 🌍 **CDN Integration**

### **CloudFlare (Free)**

1. **Create Account** - [cloudflare.com](https://cloudflare.com)

2. **Add Site**
   - Enter your domain
   - Update nameservers

3. **Settings**
   - Enable Caching: Aggressive
   - Minify: On
   - HTTPS: Flexible (if self-signed)

4. **Benefits**
   - Free SSL
   - DDoS Protection
   - Global CDN
   - Performance boost

---

## 📦 **Docker Deployment**

### **Dockerfile**
```dockerfile
FROM nginx:alpine

# Copy application
COPY vyapar.html /usr/share/nginx/html/
COPY README.md /usr/share/nginx/html/

# Nginx config
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### **nginx.conf**
```nginx
events { worker_connections 1024; }

http {
    server {
        listen 80;
        root /usr/share/nginx/html;
        
        location / {
            try_files $uri $uri/ =404;
        }
        
        # Cache static files
        location ~* \.(html|css|js)$ {
            expires 30d;
        }
    }
}
```

### **Deploy**
```bash
# Build image
docker build -t vyapar:latest .

# Run container
docker run -d -p 80:80 --name vyapar vyapar:latest

# Access
# http://localhost/vyapar.html
```

### **Docker Compose**
```yaml
version: '3.8'

services:
  vyapar:
    build: .
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    restart: always
```

---

## 🔍 **Monitoring & Analytics**

### **Add Google Analytics**

```html
<!-- Add before </head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'GA_ID');
</script>
```

### **Error Tracking (Sentry)**

```html
<!-- Add before </head> -->
<script src="https://browser.sentry-cdn.com/6.x/bundle.min.js"></script>
<script>
    Sentry.init({ dsn: 'YOUR_SENTRY_DSN' });
</script>
```

---

## 🔄 **Update Strategy**

### **Version Control**
```bash
# Tag releases
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0

# Create releases
# New feature → New version
```

### **Deployment Process**
```bash
1. Test locally
2. Commit changes
3. Push to GitHub
4. GitHub Actions auto-deploys
5. Verify in production
```

### **Rollback**
```bash
# If issues occur:
git revert COMMIT_HASH
git push origin main
# Auto-redeploys to previous version
```

---

## 📋 **Pre-Launch Checklist**

- [ ] Domain registered and configured
- [ ] SSL certificate installed
- [ ] HTTPS enforced
- [ ] Files uploaded
- [ ] Tested in production environment
- [ ] Analytics configured
- [ ] Error tracking enabled
- [ ] Backups configured
- [ ] Monitoring setup
- [ ] Documentation updated
- [ ] Team trained
- [ ] Launch announced

---

## 🆘 **Troubleshooting**

### **CORS Errors**
```nginx
# Add to nginx config
add_header 'Access-Control-Allow-Origin' '*';
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE';
```

### **High CPU Usage**
```bash
# Check processes
top -u www-data
# Optimize nginx workers
worker_processes auto;
worker_connections 1024;
```

### **Out of Memory**
```bash
# Check memory
free -h
# Increase swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### **Slow Performance**
- Enable caching
- Enable compression
- Optimize database queries
- Use CDN
- Monitor response times

---

## 📞 **Support & Maintenance**

### **Regular Tasks**
- Weekly: Check error logs
- Monthly: Review analytics
- Quarterly: Update dependencies
- Annually: Renew SSL certificate

### **Backup Strategy**
```bash
# Daily backups
0 2 * * * tar -czf /backups/vyapar-$(date +\%Y\%m\%d).tar.gz /var/www/html/

# Keep 30 days
find /backups -name "vyapar-*.tar.gz" -mtime +30 -delete
```

---

## ✅ **Production Readiness**

Your Vyapar deployment is production-ready when:

- ✅ HTTPS enabled
- ✅ Domain configured
- ✅ Performance optimized
- ✅ Backups running
- ✅ Monitoring active
- ✅ Error tracking enabled
- ✅ Team trained
- ✅ Documentation complete

**Deployed successfully?** Share with your team! 🎉
