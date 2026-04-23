# RetailX – Retail Inventory Management System

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-18%2B-green)
![SQLite](https://img.shields.io/badge/database-SQLite-lightgrey)

**RetailX** is a full‑stack inventory management application designed for small and medium retail businesses.  
It provides a modern, bilingual (Arabic/English) dashboard to manage products, sales, suppliers, and generate reports – all secured by role‑based access control.

---

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [User Roles & Permissions](#user-roles--permissions)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [License](#license)
- [Contact](#contact)

---

## Features
- **User Authentication** – Sign up / Sign in with JWT tokens
- **Role‑based Access Control** – Administrator, Inventory Clerk, Cashier, Sales Representative
- **Dashboard** – Real‑time statistics (total products, low stock alerts, today’s sales, out‑of‑stock)
- **Inventory Management** – Add, edit, delete products; search & filter; low‑stock warnings
- **Sales Processing** – Create sales, auto‑deduct stock, print invoices, track cashier performance
- **Supplier Management** – Add, edit, delete suppliers; assign multiple products to each supplier
- **Reports & Analytics** – View and download detailed CSV reports (stock, sales, inventory value, supplier performance)
- **Settings** – Change currency (USD, EUR, GBP, EGP), notification preferences, backup & restore
- **Bilingual UI** – Full Arabic / English translation with RTL support
- **Chatbot Assistant** – Built‑in assistant for quick queries (offline)
- **Responsive Design** – Works on desktop, tablet, and mobile

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Backend | Node.js + Express |
| Database | SQLite (via `better-sqlite3`) |
| Authentication | JSON Web Tokens (JWT) + bcrypt |
| Charts | Chart.js |
| Deployment | Nginx reverse proxy + PM2 process manager |

---

## Project Structure

```text
RetailX-/
├── frontend/
│ ├── index.html
│ ├── css/
│ │ └── style.css
│ └── js/
│ ├── config.js # Constants, appState, permissions
│ ├── translations.js # Arabic / English strings
│ ├── api.js # All fetch() calls to backend
│ ├── auth.js # Login, signup, logout
│ ├── inventory.js # Product CRUD
│ ├── sales.js # Sales creation & listing
│ ├── suppliers.js # Supplier management
│ ├── reports.js # Report generation & CSV export
│ ├── dashboard.js # Dashboard stats & activity
│ ├── settings.js # Currency, backup, restore
│ ├── chatbot.js # Chat assistant
│ └── app.js # Navigation & initialisation
├── backend/
│ ├── server.js # Express entry point
│ ├── db.js # SQLite setup & seeding
│ ├── authMiddleware.js # JWT verification & role guard
│ ├── routes/
│ │ ├── auth.js
│ │ ├── products.js
│ │ ├── sales.js
│ │ ├── suppliers.js
│ │ ├── reports.js
│ │ ├── activity.js
│ │ └── backup.js
│ ├── package.json
│ └── .env
├── nginx/
│ └── retailx.conf
├── deploy.sh
├── README.md
└── .gitignore
```

---

## Setup & Installation

### Prerequisites
- Node.js **v18+** and npm
- Git

### 1. Clone the repository
```bash
git clone https://github.com/SamaAlyGawesh/RetailX-.git
cd RetailX-
```

### 2. Backend setup
```bash
cd backend
npm install
node server.js


```
#### The API will be running at http://localhost:3000.
#### A default admin user is seeded automatically:
- Email: `admin@retailx.com`
- Password: `admin123`

### 3. Frontend setup
Open a new terminal in the frontend folder and serve the files (you cannot open `index.html` directly because of CORS):
```bash
cd frontend
npx serve .
```
Open the displayed URL (e.g. http://localhost:3001) in your browser.

> Note: The frontend connects to http://localhost:3000/api. If you change the backend port, edit frontend/js/config.js.

## User Roles & Permissions
|Permission|Administrator|Inventory Clerk|Cashier|Sales Rep|
|----------|-------------|---------------|-------|---------|
|Dashboard|✔|✔|✔|✔|
|Inventory|✔|✔|–|–|
|Add / Delete Product|✔|✔|–|–|
|Sales|✔|–|✔|✔|
|Reports|✔|✔|–|✔|
|Suppliers|✔|–|–|–|
|Settings|✔|–|–|–|
|Import / Export|✔|–|–|–|

## API Endpoints

### Authentication
|Method|Endpoint|Description|
|------|--------|-----------|
|POST|`/api/auth/register`|Create new user|
|POST|`/api/auth/login`|Login, returns JWT|

### Products
|Method|Endpoint|Auth|Description|
|------|--------|----|-----------|
|GET|`/api/products`|required|List products (optional `?search=`)|
|POST|/`api/products`|admin, clerk|Create product|
|PATCH|`/api/products/:id/stock`|admin, clerk|Update stock quantity|
|DELETE|`/api/products/:id`|admin|Delete product|

### Sales
|Method|Endpoint|Auth|Description|
|------|--------|----|-----------|
|GET|`/api/sales`|required|List all sales|
|POST|`/api/sales`|admin, cashier, sales|Create sale (deducts stock)|
|DELETE|`/api/sales/:id`|admin|Delete sale|

### Suppliers
|Method|Endpoint|Auth|Description|
|------|--------|----|-----------|
|GET|`/api/suppliers`|required|List suppliers|
|POST|`/api/suppliers`|admin|Create supplier|
|PUT|`/api/suppliers/:id`|admin|Update supplier|
|DELETE|`/api/suppliers/:id`|admin|Delete supplier|

### Activity & Backup
|Method|Endpoint|Auth|Description|
|------|--------|----|-----------|
|GET|/`api/activity`|required|Recent 20 activities|
|GET|/`api/backup`|required|Full database backup (JSON)|

*All protected routes require `Authorization: Bearer <token>` header.*

## Deployment
For production, use the provided `nginx/retailx.conf` and `deploy.sh` script on a fresh Ubuntu server.

### Quick steps (Ubuntu 22.04 / 24.04)
- 1. Upload the project to `/opt/retailx/`
- 2. Run
```bash
chmod +x deploy.sh
sudo ./deploy.sh
```
- 3. The script will:

- - Install Node.js, Nginx, and PM2
- - Copy the Nginx configuration
- - Start the backend with PM2
- - Obtain a free SSL certificate (Let's Encrypt)

## Screenshots
// need to add photos here
(Add screenshots of the Dashboard, Inventory, Sales, and Reports pages here. Use the ![alt](url) format.)

## License
This project is licensed under the MIT License. See the [LICENSE]() file for details.

## Contact
- RetailX Team
- Cairo, Egypt
- 📧 sama.aly1016@gmail.com
- Project Link: https://github.com/SamaAlyGawesh/RetailX-