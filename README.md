# 🚌 Sakay — Marikina Fare Checker

A full-stack public transport fare checker for Filipino commuters in Marikina City.

## Stack

| Layer    | Tech                         |
|----------|------------------------------|
| Frontend | React 18, Vite 5, CSS Modules |
| Backend  | Express 4, Node.js (ESM)     |
| Routing  | React Router v6              |
| API comm | Fetch API (proxied by Vite)  |

---

## Getting Started

### 1. Install Node.js
Download from https://nodejs.org (LTS version recommended).

### 2. Install dependencies
```bash
npm install
```

### 3. Run frontend + backend together
```bash
npm run dev:full
```

Or run them separately in two terminals:
```bash
# Terminal 1 — Express API on port 3001
npm run server

# Terminal 2 — Vite dev server on port 5173
npm run dev
```

Then open: **http://localhost:5173**

---

## Project Structure

```
Sakay/
├── index.html                  # Vite entry point
├── vite.config.js              # Vite config + API proxy
├── package.json
├── .env                        # PORT=3001
│
├── server/                     # Express backend
│   ├── index.js                # App entry
│   ├── data/
│   │   ├── locations.js        # Marikina locations dataset
│   │   └── fareMatrix.js       # LTFRB sample fare matrix
│   └── routes/
│       ├── locations.js        # GET /api/locations?q=
│       └── fares.js            # POST /api/fares/calculate
│                               # GET  /api/fares/matrix
│
└── src/                        # React frontend
    ├── main.jsx
    ├── App.jsx
    ├── styles/globals.css
    ├── services/api.js         # All fetch calls
    ├── components/
    │   ├── Layout/             # Header, Footer, Layout wrapper
    │   ├── Jeepney/            # Animated SVG jeepney
    │   ├── FareChecker/        # LocationInput, TransportSelector,
    │   │                       # PassengerSelector, FareCard
    │   └── FareResult/         # Fare result modal
    └── pages/
        ├── HomePage.jsx
        └── HowItWorksPage.jsx
```

---

## API Endpoints

### `GET /api/health`
Returns API status.

### `GET /api/locations?q=<query>`
Returns up to 8 Marikina locations matching the query.

### `POST /api/fares/calculate`
```json
{
  "from": "Marikina City Hall",
  "to": "SM City Marikina",
  "transport": "Jeepney",
  "passengerType": "Student"
}
```
Returns fare breakdown including base fare, extra distance, discount, and total.

### `GET /api/fares/matrix`
Returns the full fare matrix and discount rates.

---

## Passenger Discounts

| Type           | Discount |
|----------------|----------|
| Regular        | 0%       |
| Student        | 20%      |
| Senior Citizen | 20%      |
| PWD            | 20%      |

Discounts are based on RA 9994 (Expanded Senior Citizens Act) and RA 10754 (PWD Act). Always bring a valid ID and confirm with the driver.

---

> ⚠ **Disclaimer:** Fares shown are sample estimates for prototype/demo purposes only. Not affiliated with LTFRB or any government agency.
