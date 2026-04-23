#!/bin/bash
# deploy.sh – RetailX deployment on Ubuntu

# 1. Update system
apt update && apt upgrade -y

# 2. Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx

# 3. Create project directory
mkdir -p /opt/retailx/{frontend,backend}

# 4. Clone/copy your project here, then:
cd /opt/retailx/backend
npm install

# 5. Set up Nginx
cp nginx/retailx.conf /etc/nginx/sites-available/retailx
ln -sf /etc/nginx/sites-available/retailx /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 6. Run backend with PM2 (auto-restart)
npm install -g pm2
pm2 start server.js --name retailx-backend
pm2 save
pm2 startup

# 7. Set up Let's Encrypt
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com    # ← Replace

echo "✅ RetailX deployed!"