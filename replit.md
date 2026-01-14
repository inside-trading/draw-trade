# Draw Trade - Price Prediction Platform

## Overview
A price prediction drawing website that allows users to visualize asset prices and draw their own predictions. The platform aggregates predictions to show community average forecasts, supports user authentication, and includes a token staking system.

## Project Structure
```
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx      # Asset search with autocomplete
│   │   │   ├── PriceChart.jsx     # Chart.js price visualization
│   │   │   ├── DrawingCanvas.jsx  # Drawing canvas for predictions
│   │   │   ├── AuthHeader.jsx     # User auth controls and profile
│   │   │   └── PredictionsTable.jsx # Community predictions list
│   │   ├── hooks/
│   │   │   └── useAuth.js         # Authentication hook
│   │   ├── styles/
│   │   │   └── index.css          # Global styles
│   │   ├── App.jsx                # Main application component
│   │   └── main.jsx               # Entry point
│   ├── package.json
│   └── vite.config.js
├── server/                 # Flask backend
│   ├── app.py              # API endpoints
│   ├── models.py           # Database models (User, OAuth, Prediction)
│   ├── db.py               # SQLAlchemy setup
│   ├── replit_auth.py      # Replit OAuth authentication
│   └── requirements.txt
└── replit.md               # This file
```

## Features
- Search for NASDAQ/NYSE stocks, Bitcoin, Ethereum, Gold, Silver
- View price charts with configurable timeframes (hourly, daily, weekly, monthly, yearly)
- Draw price predictions directly on the canvas
- Custom Min/Max price inputs for exact price targets
- Convert drawings to price series stored in PostgreSQL
- Display community average prediction as grey overlay
- User authentication via Replit OAuth (Google, GitHub, email)
- Token staking system with default 1000 tokens per user
- Community predictions table with sorting and filtering

## Tech Stack
- **Frontend**: React 18, Vite, Chart.js, Axios
- **Backend**: Flask, SQLAlchemy, Flask-Login, Flask-Dance
- **Database**: PostgreSQL
- **Auth**: Replit OpenID Connect
- **Data Source**: yfinance for market data

## API Endpoints
- `GET /api/search?q=<query>` - Search assets
- `GET /api/prices/<symbol>` - Get price history
- `GET /api/predictions/<symbol>` - Get community predictions for asset
- `GET /api/predictions/all` - Get all predictions with pagination/filtering
- `POST /api/predictions` - Submit new prediction (with optional staking), returns price series
- `GET /api/auth/user` - Get current authenticated user
- `GET /api/user/predictions` - Get current user's predictions
- `GET /api/user/prediction/<symbol>` - Get user's latest prediction for an asset
- `POST /api/predictions/<id>/score` - Update prediction accuracy score
- `GET /auth/login` - Begin OAuth login flow
- `GET /auth/logout` - Log out user

## Database Models
- **User**: id, email, first_name, last_name, profile_image_url, token_balance
- **OAuth**: user_id, browser_session_key, provider, token
- **Prediction**: id, user_id, symbol, asset_name, timeframe, start_price, end_price, price_series, staked_tokens, accuracy_score, rewards_earned, status

## Running the Project
The project runs two servers:
1. Frontend (Vite) on port 5000
2. Backend (Flask) on port 8000

## Recent Changes
- January 2026: Initial implementation
- January 2026: Added sentiment slider (bearish/bullish) to control canvas price range
- January 2026: Fixed price chart Y-axis to remain static when drawing
- January 2026: Added time/date labels on horizontal axis based on timeframe
- January 2026: Canvas left edge = current time, right edge = prediction end time
- January 2026: Added exact Min/Max price text inputs for precise predictions
- January 2026: Added Replit OAuth authentication system
- January 2026: Created User model with token balance (default 1000 tokens)
- January 2026: Added token staking on predictions
- January 2026: Created community predictions table with sorting/filtering
- January 2026: Added processed prediction line display (purple) after submission
- January 2026: Added user's last prediction display on canvas
- January 2026: Implemented auto-scroll to canvas when drawing starts
- January 2026: Added live price polling every 30 seconds
- January 2026: Implemented live scoring system with accuracy calculation
- January 2026: Added accuracy score display in info bar
