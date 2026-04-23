# retailx - Inventory

## Project Structure
```text
retailx/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── config.js          ← constants, appState, permissions
│   │   ├── translations.js    ← language strings (en, ar)
│   │   ├── api.js             ← all fetch() calls to backend
│   │   ├── auth.js            ← login, signup, logout, session
│   │   ├── inventory.js       ← product CRUD
│   │   ├── sales.js           ← sale create, delete, invoice print
│   │   ├── suppliers.js       ← supplier CRUD
│   │   ├── reports.js         ← view & download CSV reports
│   │   ├── dashboard.js       ← stats cards, activity log, charts
│   │   ├── settings.js        ← currency, backup, restore
│   │   ├── chatbot.js         ← chat assistant
│   │   └── app.js             ← navigation, event wiring, init
├── backend/
│   ├── package.json
│   ├── server.js              ← Express entry point
│   ├── db.js                  ← SQLite init + seed data
│   ├── authMiddleware.js      ← JWT verification
│   ├── routes/
│   │   ├── auth.js
│   │   ├── products.js
│   │   ├── sales.js
│   │   ├── suppliers.js
│   │   └── reports.js
├── nginx/
│   └── retailx.conf
└── deploy.sh
```