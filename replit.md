# Draw Trade - Price Prediction Platform

## Overview
A price prediction drawing website that allows users to visualize asset prices and draw their own predictions. The platform aggregates predictions to show community average forecasts.

## Project Structure
```
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx    # Asset search with autocomplete
│   │   │   ├── PriceChart.jsx   # Chart.js price visualization
│   │   │   └── DrawingCanvas.jsx # Drawing canvas for predictions
│   │   ├── styles/
│   │   │   └── index.css        # Global styles
│   │   ├── App.jsx              # Main application component
│   │   └── main.jsx             # Entry point
│   ├── package.json
│   └── vite.config.js
├── server/                 # Flask backend
│   ├── app.py              # API endpoints and database models
│   └── requirements.txt
└── replit.md               # This file
```

## Features
- Search for NASDAQ/NYSE stocks, Bitcoin, Ethereum, Gold, Silver
- View price charts with configurable timeframes (hourly, daily, weekly, monthly, yearly)
- Draw price predictions directly on the canvas
- Convert drawings to price series stored in PostgreSQL
- Display community average prediction as grey overlay

## Tech Stack
- **Frontend**: React 18, Vite, Chart.js
- **Backend**: Flask, SQLAlchemy
- **Database**: PostgreSQL
- **Data Source**: yfinance for market data

## API Endpoints
- `GET /api/search?q=<query>` - Search assets
- `GET /api/prices/<symbol>` - Get price history
- `GET /api/predictions/<symbol>` - Get community predictions
- `POST /api/predictions` - Submit new prediction

## Running the Project
The project runs two servers:
1. Frontend (Vite) on port 5000
2. Backend (Flask) on port 5001

## Recent Changes
- January 2026: Initial implementation
