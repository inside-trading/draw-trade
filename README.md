# Draw Trade

A price prediction platform where users can draw their predictions for asset prices and see the wisdom of the crowd.

**Domains:** draw.trade | doodle.trade | squiggle.trade

## Features

- **Asset Search**: Search and select from NASDAQ/NYSE stocks, Bitcoin, Ethereum, Gold, and Silver
- **Time Windows**: Predict for hourly, daily, weekly, monthly, or yearly timeframes
- **Interactive Drawing**: Draw your price prediction directly on a canvas next to the live price chart
- **Crowd Wisdom**: See the average of all community predictions as a grey overlay
- **Automatic Price Conversion**: Drawings are converted to precise price series with appropriate granularity

## Tech Stack

- **Frontend**: Next.js 14 with React and TypeScript
- **Styling**: Tailwind CSS
- **Charts**: TradingView Lightweight Charts
- **Database**: SQLite with better-sqlite3
- **Drawing**: HTML5 Canvas API

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build

```bash
npm run build
npm start
```

## How It Works

1. **Select an Asset**: Use the search bar to find stocks (AAPL, MSFT, etc.), crypto (BTC, ETH), or commodities (GOLD, SILVER)

2. **Choose a Time Window**: Select the prediction timeframe:
   - Hourly: Predict the next 60 minutes (1-minute intervals)
   - Daily: Predict the next 24 hours (1-hour intervals)
   - Weekly: Predict the next 7 days (1-hour intervals)
   - Monthly: Predict the next 30 days (1-day intervals)
   - Yearly: Predict the next 365 days (1-day intervals)

3. **Draw Your Prediction**: Click and drag on the canvas to the right of the price chart to draw your prediction

4. **See Crowd Wisdom**: Your drawing is saved and the community average is displayed as a grey dashed line

## Price Conversion

Drawings are converted to price series based on the time window:

| Time Window | Prediction Duration | Price Points |
|-------------|---------------------|--------------|
| Hourly      | 60 minutes          | Per minute   |
| Daily       | 24 hours            | Per hour     |
| Weekly      | 7 days              | Per hour     |
| Monthly     | 30 days             | Per day      |
| Yearly      | 365 days            | Per day      |

## Database Schema

Predictions are stored in SQLite with two tables:

- `predictions`: Stores prediction metadata (id, asset, time window, session, timestamp)
- `prediction_points`: Stores individual price points (time, price)

## License

MIT
