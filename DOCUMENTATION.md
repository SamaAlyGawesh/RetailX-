# RetailX – Technical Documentation

## 1. System Overview
RetailX is a **client‑server** web application. The frontend (HTML/JS) communicates with a RESTful API built in Node.js/Express. Data is stored in a **SQLite** database. Authentication uses **JWT** tokens, and role‑based permissions restrict access to sensitive operations. The system now supports **pagination** on all major tables (products, sales, suppliers, users), and a **guest role** controls what unauthenticated visitors can see.

---

## 2. Database Schema

### 2.1 Tables

#### `users`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto‑increment |
| name | TEXT NOT NULL | Full name |
| email | TEXT UNIQUE NOT NULL | Login email |
| password | TEXT NOT NULL | bcrypt hashed |
| role | TEXT NOT NULL | `administrator`, `clerk`, `cashier`, `sales`, `user`, `viewer` |
| created_at | DATETIME | Account creation timestamp |

#### `products`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto‑increment |
| sku | TEXT NOT NULL | Stock Keeping Unit |
| name | TEXT NOT NULL | Product name |
| category | TEXT | Product category |
| quantity | INTEGER | Current stock |
| reorderLevel | INTEGER | Low‑stock threshold |
| price | REAL | Unit price |
| supplier | TEXT | Supplier name |
| image | TEXT | (Optional) filename of uploaded product image |
| created_at | DATETIME | Timestamp |

#### `sales`
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Transaction ID (e.g. TXN‑168...) |
| date | TEXT NOT NULL | Sale date & time (localised) |
| customer | TEXT | Customer name |
| items | INTEGER | Quantity sold |
| total | REAL | Total amount |
| status | TEXT | `Completed` |
| cashier | TEXT | Name of cashier who processed |
| created_at | DATETIME | Timestamp |

#### `suppliers`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto‑increment |
| name | TEXT NOT NULL | Supplier name |
| contact | TEXT | Contact person |
| email | TEXT | Email |
| phone | TEXT | Phone number |
| productsSuppliedList | TEXT | JSON array of product names |
| leadTime | INTEGER | Lead time in days |
| addedDate | TEXT | ISO date string |

#### `activity`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto‑increment |
| type | TEXT | `product`, `sale`, `stock`, `alert` |
| message | TEXT | Description |
| time | TEXT | Formatted time |
| created_at | DATETIME | Timestamp |

---

## 3. Authentication Flow

1. User sends `POST /api/auth/login` with email & password.
2. Backend queries `users` table, compares password hash with bcrypt.
3. On success, a JWT is generated containing `{id, email, role, name}` and signed with a secret (stored in `.env` or a default fallback).
4. Frontend stores the token in memory (`appState.token`) and in `localStorage` for persistence across page refreshes.
5. `authMiddleware.authenticate` verifies the token. `requireRole` checks the required role(s).

---

## 4. Role‑Based Access Control (RBAC)

Permissions are defined in `frontend/js/config.js` with the following roles:

| Role | Description |
|------|-------------|
| `administrator` | Full access to everything, including user management |
| `clerk` | Inventory & reports |
| `cashier` | Sales only |
| `sales` | Sales & reports |
| `user` | Dashboard & inventory view (no modifications) |
| `viewer` | Dashboard only (read‑only) |
| `guest` | Unauthenticated visitors – only Home page visible |

The `applyRoleBasedAccess()` function in `app.js` dynamically shows/hides navigation links based on the current user's role. For guests, all links are hidden except Home.

The middleware `requireRole` on the backend ensures that even if the frontend is bypassed, the server enforces the correct privileges.

---

## 5. Pagination System

All major data tables implement server‑side pagination:

- **Page size:** 15 items per page (configurable in each frontend module)
- **API parameters:** `?page=<n>&limit=<n>` (optional `&search=` for products)
- **API response:**
  ```json
  {
    "products": [...],
    "total": 47,
    "page": 2,
    "pages": 4
  }
  ```
- **Frontend:** `pagination.js` provides a generic `renderPagination(currentPage, totalPages, containerId, callback)` function that renders numbered buttons with Previous/Next navigation.  
- **Row numbering:** Each row displays its sequential number across pages (e.g., page 2 starts at 16).
Affected routes:
- `GET /api/products?page=&limit=&search=`
- `GET /api/sales?page=&limit=`
- `GET /api/suppliers?page=&limit=`
- `GET /api/users?page=&limit=`

---

## 6. Frontend Architecture
- Single Page Application (SPA) – All sections (`#homePage`, `#dashboardPage`, etc.) are hidden/shown using CSS class `active`.
- No frameworks – Pure vanilla JavaScript, 14 files organised by feature.
- API module (`api.js`) – Centralised `fetch` wrapper that adds auth header and handles errors. Functions accept pagination parameters.
- Translation – `translations.js` contains two objects (`en`, `ar`). `applyLanguage()` replaces all `innerText` of elements with matching `id`.
- Charts – Chart.js is used in the reports section (profit chart).
- Pagination – `pagination.js` provides a reusable component for all tables.
- Responsive – `responsive.js` controls the mobile hamburger menu.
- Security – All sensitive actions first check `hasPermission()` on the frontend; the backend repeats the check.

---

## 7. Key Backend Routes

### 7.1 Auth Routes
- `POST /api/auth/register` – Validates input, forces role to `user` (prevents self‑assignment), hashes password, inserts into `users`.
- `POST /api/auth/login` – Validates credentials, returns JWT and user object (without password).
### 7.2 Product Routes
- `GET /api/products` – Supports pagination (`page`, `limit`) and `search` query param.
- `POST /api/products` – Inserts new product, writes activity log.
- `PATCH /api/products/:id/stock` – Updates quantity, writes activity.
- `DELETE /api/products/:id` – Deletes product, writes activity.
### 7.3 Sales Routes
- `GET /api/sales` – Supports pagination (`page`, `limit`), returns all sales ordered by creation date.
- `POST /api/sales` – Checks stock, deducts quantity, inserts sale record, writes activity.
- `DELETE /api/sales/:id` – Only admin can delete.
### 7.4 Supplier Routes
- `GET /api/suppliers` – Supports pagination, parses `productsSuppliedList` from JSON string to array.
- `POST /api/suppliers` – Stores productsSuppliedList as JSON string.
- `PUT /api/suppliers/:id` – Full update.
- `DELETE /api/suppliers/:id` – Only admin.
### 7.5 User Management Routes (Admin Only)
- `GET /api/users` – Supports pagination, returns `{users, total, page, pages}`. Only accessible by administrator.
- `PATCH /api/users/:id/role` – Updates a user's role. Validates against allowed roles. Only admin.

---

## 8. Deployment Architecture
```text
[Client Browser]
│
▼
[Nginx] (port 80/443)
│ ├── static files → /opt/retailx/frontend
│ └── /api/* → proxy_pass http://127.0.0.1:3000
│
▼
[Node.js + Express] (PM2 managed)
│
▼
[SQLite] (file: retailx.db)

SSL is provided by Certbot (Let's Encrypt).  
The Nginx config redirects all HTTP traffic to HTTPS.
```

---

## 9. Backup & Restore

- **Backup endpoint** `/api/backup` returns a JSON snapshot of all tables.
- **Frontend** download button generates a JSON file.
- **Restore** is currently not implemented via API; manual restore can be done by replacing `retailx.db`.

---

## 10. Security Considerations

- Passwords are hashed using **bcryptjs** (10 salt rounds).
- JWT tokens expire after **24 hours**.
- All API routes (except register/login) are protected.
- CORS is enabled for development; in production Nginx serves everything from the same origin, eliminating cross‑origin requests.
- SQLite database is stored outside the web root.
- Firewall (UFW) restricts access to ports 22, 80, and 443 only.

---

## 11. What's New (v2.0)
Compared to the original release, the following enhancements have been added:
- ✅ Pagination on all data tables (Products, Sales, Suppliers, Users)
- ✅ Row numbering with sequential numbering across pages
- ✅ New user roles (user, viewer, guest) with granular permissions
- ✅ User management page (Admin only) with role editing
- ✅ Dynamic navbar that reflects current user permissions
- ✅ Persistent sessions via localStorage
- ✅ Responsive hamburger menu for mobile devices
- ✅ Excel‑like filtering and sorting on all table headers
- ✅ Guest mode – controls what unauthenticated visitors can access

---

## 12. Future Enhancements)
- Product image upload and display.
- Email notifications for low stock.
- Bulk actions (multi‑select delete/export).
- Password reset via email.
- Automated daily database backups.

*Document version: 2.0 – May 2026*
