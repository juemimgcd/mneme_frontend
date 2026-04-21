# Nginx 反向代理部署步骤

当前前端已配置为请求同源 API：

```env
VITE_API_BASE_URL=/api
VITE_API_PREFIX=
VITE_USE_MOCKS=false
```

浏览器访问：

```text
http://你的域名
```

前端登录请求会变成：

```text
http://你的域名/api/auth/login
```

再由前端服务器 Nginx 转发到后端：

```text
http://124.223.14.145:8000/auth/login
```

## 1. 前端服务器配置 Nginx

如果你使用域名 `www.mneme.com.cn`，可以直接在 Ubuntu 服务器上运行仓库里的脚本：

```bash
sudo bash deploy/setup_nginx_www_mneme.sh
```

如果要顺便申请 HTTPS 证书，先确保域名已经解析到这台前端服务器，再执行：

```bash
sudo ENABLE_HTTPS=true CERTBOT_EMAIL=你的邮箱 bash deploy/setup_nginx_www_mneme.sh
```

脚本默认配置：

```text
DOMAIN=www.mneme.com.cn
SITE_ROOT=/var/www/mneme-frontend
BACKEND_UPSTREAM=http://124.223.14.145:8000
```

在前端服务器上创建或修改：

```bash
sudo nano /etc/nginx/sites-available/mneme.conf
```

写入下面配置，把 `your-domain.com` 改成你的真实域名：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/mneme-frontend;
    index index.html;

    client_max_body_size 20m;

    location /api/ {
        rewrite ^/api/?(.*)$ /$1 break;
        proxy_pass http://124.223.14.145:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $proxy_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用配置：

```bash
sudo ln -sf /etc/nginx/sites-available/mneme.conf /etc/nginx/sites-enabled/mneme.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 2. 重新构建并部署前端

在前端项目目录执行：

```bash
npm ci
npm run build
sudo mkdir -p /var/www/mneme-frontend
sudo rm -rf /var/www/mneme-frontend/*
sudo cp -r dist/. /var/www/mneme-frontend/
sudo systemctl reload nginx
```

## 3. 后端 CORS 配置

使用 Nginx 同源反代后，浏览器只访问前端域名，不再直接跨域访问后端 IP。

后端可以保守配置为放行前端域名：

```env
CORS_ALLOWED_ORIGINS=["http://your-domain.com","https://your-domain.com"]
CORS_ALLOW_ORIGIN_REGEX=
```

如果暂时还保留 IP 直连测试，也可以额外加上前端 IP：

```env
CORS_ALLOWED_ORIGINS=["http://your-domain.com","https://your-domain.com","http://8.147.57.104"]
```

改完后重启后端服务。

## 4. 验证

浏览器开发者工具里登录请求应该是：

```text
POST http://你的域名/api/auth/login
```

不应该再是：

```text
POST http://124.223.14.145:8000/auth/login
```

如果还是请求后端 IP，说明服务器上的前端没有用最新 `.env` 重新构建。
