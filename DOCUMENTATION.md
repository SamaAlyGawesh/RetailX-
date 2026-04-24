# RetailX – Technical Documentation

## 1. System Overview
RetailX is a **client‑server** web application. The frontend (HTML/JS) communicates with a RESTful API built in Node.js/Express. Data is stored in a **SQLite** database. Authentication uses **JWT** tokens, and role‑based permissions restrict access to sensitive operations.

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
| role | TEXT NOT NULL | `administrator`, `clerk`, `cashier`, `sales` |
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
4. Frontend stores the token in memory (`appState.token`) and attaches it to all subsequent requests as `Authorization: Bearer <token>`.
5. `authMiddleware.authenticate` verifies the token. `requireRole` checks the required role(s).

---

## 4. Role‑Based Access Control (RBAC)

Permissions are defined in `frontend/js/config.js`. The middleware `requireRole` on the backend ensures that even if the frontend is bypassed, the server enforces the correct privileges.

| Permission | Backend middleware |
|------------|-------------------|
| Create product | `requireRole('administrator', 'clerk')` |
| Delete product | `requireRole('administrator')` |
| Create sale | `requireRole('administrator', 'cashier', 'sales')` |
| Delete sale | `requireRole('administrator')` |
| Supplier CRUD | `requireRole('administrator')` |

---

## 5. Frontend Architecture

- **Single Page Application (SPA)** – All sections (`#homePage`, `#dashboardPage`, etc.) are hidden/shown using CSS class `active`.
- **No frameworks** – Pure vanilla JavaScript, 12 files organised by feature.
- **API module** (`api.js`) – Centralised `fetch` wrapper that adds auth header and handles errors.
- **Translation** – `translations.js` contains two objects (`en`, `ar`). `applyLanguage()` replaces all `innerText` of elements with matching `id`.
- **Charts** – Chart.js is used in the reports section (profit chart).
- **Security** – All sensitive actions first check `hasPermission()` on the frontend; the backend repeats the check.

---

## 6. Key Backend Routes

### 6.1 Auth Routes
- `POST /api/auth/register` – Validates input, hashes password, inserts into `users`.
- `POST /api/auth/login` – Validates credentials, returns JWT and user object (without password).

### 6.2 Product Routes
- `GET /api/products` – Supports query param `search` (filters by name or SKU).
- `POST /api/products` – Inserts new product, writes activity log.
- `PATCH /api/products/:id/stock` – Updates quantity, writes activity.
- `DELETE /api/products/:id` – Deletes product, writes activity.

### 6.3 Sales Routes
- `GET /api/sales` – Returns all sales ordered by creation date.
- `POST /api/sales` – Checks stock, deducts quantity, inserts sale record, writes activity.
- `DELETE /api/sales/:id` – Only admin can delete.

### 6.4 Supplier Routes
- `GET /api/suppliers` – Parses `productsSuppliedList` from JSON string to array.
- `POST /api/suppliers` – Stores `productsSuppliedList` as JSON string.
- `PUT /api/suppliers/:id` – Full update.
- `DELETE /api/suppliers/:id` – Only admin.

---

## 7. Deployment Architecture
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
The `deploy.sh` script automates the entire setup.
```

---

## 8. Backup & Restore

- **Backup endpoint** `/api/backup` returns a JSON snapshot of all tables.
- **Frontend** download button generates a JSON file.
- **Restore** is currently not implemented via API; manual restore can be done by replacing `retailx.db`.

---

## 9. Security Considerations

- Passwords are hashed using **bcryptjs** (10 salt rounds).
- JWT tokens expire after **24 hours**.
- All API routes (except register/login) are protected.
- CORS is enabled for development; in production Nginx serves everything from the same origin, eliminating cross‑origin requests.
- SQLite database is stored outside the web root.

---

## 10. Future Enhancements
- Add pagination for large datasets.
- Implement image uploads for products.
- Add email notifications for low stock.
- Build a mobile app using the same API.

---

*Document version: 1.0 – April 2026*
