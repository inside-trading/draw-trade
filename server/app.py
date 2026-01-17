import os
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_login import current_user
from datetime import datetime, timedelta
from werkzeug.middleware.proxy_fix import ProxyFix
import yfinance as yf
import json
import logging

logging.basicConfig(level=logging.DEBUG)

from db import db
from models import User, Prediction, PriceData, UserPerformanceHistory, MetaPrediction, DEFAULT_TOKEN_BALANCE
from auth import auth_bp, init_auth, require_login, get_authenticated_user
import twelve_data
import math
import pytz
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", os.urandom(24).hex())
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1, x_for=1, x_prefix=1)

# Configure CORS for production
frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
allowed_origins = [
    frontend_url,
    'http://localhost:5173',
    'http://localhost:5001',
    'http://localhost:5000',
    'http://localhost:3000',
]
# Add Vercel preview URLs pattern
if os.environ.get('VERCEL_URL'):
    allowed_origins.append(f"https://{os.environ.get('VERCEL_URL')}")

# Add the production domain
production_domain = os.environ.get('PRODUCTION_DOMAIN', 'draw.trade')
allowed_origins.extend([
    f'https://{production_domain}',
    f'https://www.{production_domain}',
])

# Log allowed origins for debugging
logging.info(f"Allowed CORS origins: {allowed_origins}")

CORS(app,
     supports_credentials=True,
     origins=allowed_origins,
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     expose_headers=['Set-Cookie'])

# Handle Railway's postgres:// URL format (SQLAlchemy requires postgresql://)
database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

if not database_url:
    database_url = 'sqlite:///local.db'
    logging.warning("DATABASE_URL not set, using SQLite for local development")

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}
# For cross-origin auth between Vercel frontend and Railway backend:
# - SameSite=None allows cookies in cross-origin requests
# - Secure=True is required when SameSite=None (HTTPS only)
is_production = os.environ.get('RAILWAY_ENVIRONMENT') or os.environ.get('FLASK_ENV') == 'production'
app.config['SESSION_COOKIE_SAMESITE'] = 'None' if is_production else 'Lax'
app.config['SESSION_COOKIE_SECURE'] = is_production
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
app.config['REMEMBER_COOKIE_DURATION'] = timedelta(days=30)
app.config['REMEMBER_COOKIE_SAMESITE'] = 'None' if is_production else 'Lax'
app.config['REMEMBER_COOKIE_SECURE'] = is_production
app.config['REMEMBER_COOKIE_HTTPONLY'] = True

logging.info(f"Production mode: {is_production}, SameSite: {'None' if is_production else 'Lax'}")

db.init_app(app)

with app.app_context():
    db.create_all()
    logging.info("Database tables created")

# Initialize authentication
init_auth(app)
app.register_blueprint(auth_bp)

@app.before_request
def make_session_permanent():
    session.permanent = True

POPULAR_STOCKS = [
    {'symbol': 'AAPL', 'name': 'Apple Inc.', 'type': 'Stock'},
    {'symbol': 'MSFT', 'name': 'Microsoft Corporation', 'type': 'Stock'},
    {'symbol': 'GOOGL', 'name': 'Alphabet Inc.', 'type': 'Stock'},
    {'symbol': 'AMZN', 'name': 'Amazon.com Inc.', 'type': 'Stock'},
    {'symbol': 'TSLA', 'name': 'Tesla Inc.', 'type': 'Stock'},
    {'symbol': 'META', 'name': 'Meta Platforms Inc.', 'type': 'Stock'},
    {'symbol': 'NVDA', 'name': 'NVIDIA Corporation', 'type': 'Stock'},
    {'symbol': 'JPM', 'name': 'JPMorgan Chase & Co.', 'type': 'Stock'},
    {'symbol': 'V', 'name': 'Visa Inc.', 'type': 'Stock'},
    {'symbol': 'WMT', 'name': 'Walmart Inc.', 'type': 'Stock'},
    {'symbol': 'BTC-USD', 'name': 'Bitcoin', 'type': 'Crypto'},
    {'symbol': 'ETH-USD', 'name': 'Ethereum', 'type': 'Crypto'},
    {'symbol': 'GC=F', 'name': 'Gold Futures', 'type': 'Commodity'},
    {'symbol': 'SI=F', 'name': 'Silver Futures', 'type': 'Commodity'},
]

# Supported languages
SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'pt']

# Supported timezones (common ones)
SUPPORTED_TIMEZONES = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Toronto', 'America/Sao_Paulo', 'America/Mexico_City',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Seoul',
    'Australia/Sydney', 'Pacific/Auckland', 'UTC'
]


def is_crypto(symbol):
    """Check if a symbol is a cryptocurrency."""
    return '-USD' in symbol.upper() or symbol.upper() in ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE']


def is_market_open(symbol):
    """
    Check if the market is currently open for the given symbol.
    Crypto markets are always open.
    US stock market hours: 9:30 AM - 4:00 PM ET, Monday-Friday.
    Futures have extended hours but we'll use regular hours for simplicity.
    """
    if is_crypto(symbol):
        return True

    # Get current time in Eastern timezone
    eastern = pytz.timezone('America/New_York')
    now = datetime.now(eastern)

    # Check if it's a weekend
    if now.weekday() >= 5:  # Saturday = 5, Sunday = 6
        return False

    # Check market hours (9:30 AM - 4:00 PM ET)
    market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)

    return market_open <= now <= market_close


def get_next_market_open(symbol):
    """Get the next market open time for a symbol."""
    if is_crypto(symbol):
        return None  # Always open

    eastern = pytz.timezone('America/New_York')
    now = datetime.now(eastern)

    # Find next weekday at 9:30 AM
    next_open = now.replace(hour=9, minute=30, second=0, microsecond=0)

    # If we're past market close today, move to next day
    market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)
    if now >= market_close or now >= next_open:
        next_open += timedelta(days=1)

    # Skip weekends
    while next_open.weekday() >= 5:
        next_open += timedelta(days=1)

    return next_open.isoformat()


def calculate_contrarian_score(prediction_series, meta_series):
    """
    Calculate how different a prediction is from the meta-prediction.
    Returns a score where higher = more contrarian.
    Uses correlation-based measure: contrarian_score = 1 - abs(correlation)
    """
    if not prediction_series or not meta_series:
        return 0.5  # Neutral score if no comparison possible

    # Align series by length
    min_len = min(len(prediction_series), len(meta_series))
    if min_len < 2:
        return 0.5

    pred_prices = [p['price'] for p in prediction_series[:min_len]]
    meta_prices = [p['price'] for p in meta_series[:min_len]]

    # Calculate percentage changes instead of raw prices
    pred_changes = [(pred_prices[i] - pred_prices[i-1]) / pred_prices[i-1] if pred_prices[i-1] != 0 else 0
                    for i in range(1, len(pred_prices))]
    meta_changes = [(meta_prices[i] - meta_prices[i-1]) / meta_prices[i-1] if meta_prices[i-1] != 0 else 0
                    for i in range(1, len(meta_prices))]

    if not pred_changes or not meta_changes:
        return 0.5

    # Calculate correlation
    n = len(pred_changes)
    mean_pred = sum(pred_changes) / n
    mean_meta = sum(meta_changes) / n

    numerator = sum((pred_changes[i] - mean_pred) * (meta_changes[i] - mean_meta) for i in range(n))
    pred_variance = sum((p - mean_pred) ** 2 for p in pred_changes)
    meta_variance = sum((m - mean_meta) ** 2 for m in meta_changes)

    if pred_variance == 0 or meta_variance == 0:
        return 0.5

    correlation = numerator / math.sqrt(pred_variance * meta_variance)

    # Contrarian score: 0 = same as consensus, 1 = completely opposite
    # We reward both being different AND being accurate
    contrarian_score = (1 - abs(correlation)) * 0.5 + 0.5  # Scale to 0.5-1.0 range

    return round(contrarian_score, 4)


def calculate_new_payoff(staked_tokens, accuracy_score, contrarian_score, n_points, is_early_close=False, progress=1.0):
    """
    New payoff function that rewards both accuracy and contrarian predictions.

    Payoff = stake * (accuracy_multiplier * contrarian_bonus) * progress_factor

    Where:
    - accuracy_multiplier = n_points / (1 + MSPE)  (higher for lower MSPE)
    - contrarian_bonus = 1 + (contrarian_score - 0.5) * 2  (1.0 to 2.0x)
    - progress_factor = 0.5 + 0.5 * progress (for early close)
    """
    if staked_tokens <= 0 or accuracy_score is None:
        return 0

    # Base accuracy multiplier (capped to prevent extreme values)
    mspe_capped = max(accuracy_score, 0.001)  # Prevent division by near-zero
    accuracy_multiplier = min(n_points / (1 + mspe_capped), n_points * 10)  # Cap at 10x n_points

    # Contrarian bonus (1.0x to 2.0x)
    c_score = contrarian_score if contrarian_score is not None else 0.5
    contrarian_bonus = 1.0 + (c_score - 0.5) * 2.0

    # Progress factor for early close
    progress_factor = 1.0 if not is_early_close else (0.5 + 0.5 * progress)

    # Calculate final payoff
    raw_payoff = staked_tokens * accuracy_multiplier * contrarian_bonus * progress_factor

    # Apply reasonable bounds (0.1x to 100x stake)
    min_payoff = int(staked_tokens * 0.1)
    max_payoff = int(staked_tokens * 100)

    return max(min_payoff, min(int(raw_payoff), max_payoff))


def update_meta_prediction(symbol, new_prediction_series):
    """Update the meta-prediction for a symbol by incorporating a new prediction."""
    meta = MetaPrediction.query.filter_by(symbol=symbol).first()

    if not meta:
        # Create new meta-prediction
        meta = MetaPrediction(
            symbol=symbol,
            price_series=json.dumps(new_prediction_series),
            prediction_count=1
        )
        db.session.add(meta)
    else:
        # Update existing meta-prediction with weighted average
        existing_series = json.loads(meta.price_series) if meta.price_series else []
        count = meta.prediction_count

        # Weighted average: existing gets weight=count, new gets weight=1
        updated_series = []
        max_len = max(len(existing_series), len(new_prediction_series))

        for i in range(max_len):
            if i < len(existing_series) and i < len(new_prediction_series):
                avg_price = (existing_series[i]['price'] * count + new_prediction_series[i]['price']) / (count + 1)
                updated_series.append({
                    'price': round(avg_price, 2),
                    'timestamp': new_prediction_series[i].get('timestamp', existing_series[i].get('timestamp'))
                })
            elif i < len(new_prediction_series):
                updated_series.append(new_prediction_series[i])
            else:
                updated_series.append(existing_series[i])

        meta.price_series = json.dumps(updated_series)
        meta.prediction_count = count + 1

    db.session.commit()
    return meta

@app.route('/api/search')
def search_assets():
    query = request.args.get('q', '').upper()

    if not query:
        return jsonify({'results': POPULAR_STOCKS[:10]})

    matches = [
        asset for asset in POPULAR_STOCKS
        if query in asset['symbol'] or query in asset['name'].upper()
    ]

    if len(matches) < 5 and len(query) >= 1:
        try:
            ticker = yf.Ticker(query)
            info = ticker.info
            if info.get('shortName') or info.get('longName'):
                asset_type = 'Crypto' if '-USD' in query else 'Stock'
                matches.insert(0, {
                    'symbol': query,
                    'name': info.get('shortName') or info.get('longName') or query,
                    'type': asset_type
                })
        except Exception:
            pass

    return jsonify({'results': matches[:10]})

@app.route('/api/prices/<symbol>')
def get_prices(symbol):
    interval = request.args.get('interval', '5m')
    period = request.args.get('period', '5d')
    source = request.args.get('source', 'auto')  # 'auto', 'twelve_data', 'yfinance'

    # Map period to approximate outputsize for Twelve Data
    period_to_outputsize = {
        '1d': 100,      # 1 day of 1m data ~= 390 bars (market hours)
        '5d': 500,      # 5 days
        '1mo': 720,     # 1 month of hourly data
        '6mo': 180,     # 6 months of daily data
        '1y': 365,      # 1 year of daily data
    }
    outputsize = period_to_outputsize.get(period, 100)

    # Try Twelve Data first if API key is configured and source allows it
    if source in ('auto', 'twelve_data') and twelve_data.TWELVE_DATA_API_KEY:
        result = twelve_data.get_prices_with_cache(symbol, interval, outputsize)
        if result.get('prices'):
            return jsonify(result)

    # Fall back to yfinance
    if source in ('auto', 'yfinance'):
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval)

            if df.empty:
                return jsonify({'error': 'No data found'}), 404

            prices = []
            for timestamp, row in df.iterrows():
                prices.append({
                    'timestamp': timestamp.isoformat(),
                    'open': float(row['Open']),
                    'high': float(row['High']),
                    'low': float(row['Low']),
                    'close': float(row['Close']),
                    'volume': int(row['Volume'])
                })

            closes = [p['close'] for p in prices]

            return jsonify({
                'prices': prices,
                'minPrice': min(closes),
                'maxPrice': max(closes),
                'lastPrice': closes[-1] if closes else 0,
                'lastTimestamp': prices[-1]['timestamp'] if prices else None,
                'source': 'yfinance'
            })

        except Exception as e:
            logging.error(f"yfinance error for {symbol}: {e}")
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'No data source available'}), 500


@app.route('/api/prices/refresh/<symbol>', methods=['POST'])
def refresh_prices(symbol):
    """Force refresh price data from Twelve Data API."""
    interval = request.args.get('interval', '5m')
    outputsize = request.args.get('outputsize', 100, type=int)

    if not twelve_data.TWELVE_DATA_API_KEY:
        return jsonify({'error': 'Twelve Data API key not configured'}), 503

    # Fetch fresh data from Twelve Data
    prices = twelve_data.fetch_from_twelve_data(symbol, interval, outputsize)

    if prices:
        stored = twelve_data.store_price_data(symbol, interval, prices)
        return jsonify({
            'success': True,
            'message': f'Refreshed {stored} price points for {symbol}',
            'count': stored
        })

    return jsonify({'error': 'Failed to fetch price data'}), 500


@app.route('/api/prices/stats')
def price_stats():
    """Get statistics about cached price data."""
    from sqlalchemy import func

    stats = db.session.query(
        PriceData.symbol,
        PriceData.interval,
        func.count(PriceData.id).label('count'),
        func.min(PriceData.timestamp).label('oldest'),
        func.max(PriceData.timestamp).label('newest'),
    ).group_by(PriceData.symbol, PriceData.interval).all()

    result = []
    for stat in stats:
        result.append({
            'symbol': stat.symbol,
            'interval': stat.interval,
            'count': stat.count,
            'oldest': stat.oldest.isoformat() if stat.oldest else None,
            'newest': stat.newest.isoformat() if stat.newest else None,
        })

    return jsonify({
        'stats': result,
        'twelveDataConfigured': bool(twelve_data.TWELVE_DATA_API_KEY)
    })

@app.route('/api/predictions/<symbol>')
def get_predictions(symbol):
    timeframe = request.args.get('timeframe', 'daily')

    predictions = Prediction.query.filter_by(
        symbol=symbol,
        timeframe=timeframe
    ).order_by(Prediction.created_at.desc()).limit(100).all()

    if not predictions:
        return jsonify({
            'predictions': [],
            'average': [],
            'count': 0
        })

    all_series = []
    max_length = 0

    for pred in predictions:
        series = json.loads(pred.price_series)
        all_series.append(series)
        max_length = max(max_length, len(series))

    average = []
    if all_series:
        for i in range(max_length):
            prices_at_index = []
            for series in all_series:
                if i < len(series):
                    prices_at_index.append(series[i]['price'])

            if prices_at_index:
                avg_price = sum(prices_at_index) / len(prices_at_index)
                timestamp = all_series[0][min(i, len(all_series[0]) - 1)].get('timestamp')
                average.append({
                    'price': avg_price,
                    'timestamp': timestamp
                })

    return jsonify({
        'predictions': [
            {
                'id': p.id,
                'userId': p.user_id,
                'startPrice': p.start_price,
                'endPrice': p.end_price,
                'stakedTokens': p.staked_tokens,
                'status': p.status,
                'createdAt': p.created_at.isoformat()
            }
            for p in predictions[:10]
        ],
        'average': average,
        'count': len(predictions)
    })

@app.route('/api/predictions/all')
def get_all_predictions():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    symbol = request.args.get('symbol')
    timeframe = request.args.get('timeframe')
    user_id = request.args.get('user_id')
    sort_by = request.args.get('sort_by', 'created_at')
    sort_order = request.args.get('sort_order', 'desc')

    query = Prediction.query

    if symbol:
        query = query.filter(Prediction.symbol == symbol)
    if timeframe:
        query = query.filter(Prediction.timeframe == timeframe)
    if user_id:
        query = query.filter(Prediction.user_id == user_id)

    sort_column = getattr(Prediction, sort_by, Prediction.created_at)
    if sort_order == 'desc':
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    predictions_data = []
    for p in paginated.items:
        user_name = None
        if p.user_id:
            user = User.query.get(p.user_id)
            if user:
                user_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email or 'Anonymous'

        # Calculate estimated payoff
        price_series = json.loads(p.price_series) if p.price_series else []
        n_total = len(price_series)

        if p.status in ('completed', 'closed'):
            est_payoff = p.rewards_earned or 0
        elif p.accuracy_score is not None and p.accuracy_score > 0 and p.staked_tokens > 0:
            est_payoff = int((p.staked_tokens * n_total) / p.accuracy_score)
        else:
            est_payoff = None  # Not yet calculated

        # Calculate progress for active predictions
        progress = None
        if p.status == 'active':
            now = datetime.utcnow()
            timeframe_durations = {
                'hourly': timedelta(hours=1),
                'daily': timedelta(days=1),
                'weekly': timedelta(weeks=1),
                'monthly': timedelta(days=30),
                'yearly': timedelta(days=365)
            }
            total_duration = timeframe_durations.get(p.timeframe, timedelta(days=1))
            elapsed = now - p.created_at
            progress = min(100.0, (elapsed.total_seconds() / total_duration.total_seconds()) * 100)

        predictions_data.append({
            'id': p.id,
            'userId': p.user_id,
            'userName': user_name or 'Anonymous',
            'symbol': p.symbol,
            'assetName': p.asset_name,
            'timeframe': p.timeframe,
            'startPrice': p.start_price,
            'endPrice': p.end_price,
            'stakedTokens': p.staked_tokens,
            'mspe': p.accuracy_score,
            'estimatedPayoff': est_payoff,
            'rewardsEarned': p.rewards_earned,
            'status': p.status,
            'progress': round(progress, 1) if progress is not None else None,
            'createdAt': p.created_at.isoformat()
        })

    return jsonify({
        'predictions': predictions_data,
        'total': paginated.total,
        'pages': paginated.pages,
        'currentPage': page
    })

@app.route('/api/predictions', methods=['POST'])
def submit_prediction():
    data = request.get_json()

    symbol = data.get('symbol')
    asset_name = data.get('assetName')
    timeframe = data.get('timeframe')
    points = data.get('points', [])
    chart_bounds = data.get('chartBounds', {})
    canvas_dimensions = data.get('canvasDimensions', {})
    staked_tokens = data.get('stakedTokens', 0)

    if not symbol or not points or len(points) < 2:
        return jsonify({'error': 'Invalid prediction data'}), 400

    # Check market hours for non-crypto assets
    if not is_market_open(symbol):
        next_open = get_next_market_open(symbol)
        return jsonify({
            'error': f'Market is closed. Trading available during market hours (9:30 AM - 4:00 PM ET, Mon-Fri).',
            'nextOpen': next_open,
            'isCrypto': False
        }), 400

    # Use get_authenticated_user to support both cookie and token auth
    auth_user = get_authenticated_user()
    if not auth_user:
        return jsonify({'error': 'You must be logged in to submit predictions'}), 401

    if staked_tokens < 1:
        return jsonify({'error': 'Minimum stake is 1 token'}), 400

    user_id = auth_user.id
    user = User.query.get(auth_user.id)
    if user.token_balance < staked_tokens:
        return jsonify({'error': 'Insufficient token balance'}), 400
    user.token_balance -= staked_tokens
    db.session.add(user)
    user_balance = user.token_balance

    canvas_height = canvas_dimensions.get('height', 400)
    bottom_padding = canvas_dimensions.get('bottomPadding', 30)
    drawable_height = canvas_height - bottom_padding

    display_max = canvas_dimensions.get('priceMax')
    display_min = canvas_dimensions.get('priceMin')

    if display_max is None or display_min is None:
        price_range = chart_bounds.get('maxPrice', 100) - chart_bounds.get('minPrice', 0)
        padding = price_range * 0.1
        display_max = chart_bounds.get('maxPrice', 100) + padding
        display_min = chart_bounds.get('minPrice', 0) - padding

    if display_max <= display_min:
        display_max = display_min + 10

    timeframe_intervals = {
        'hourly': {'count': 60, 'delta': timedelta(minutes=1)},
        'daily': {'count': 24, 'delta': timedelta(hours=1)},
        'weekly': {'count': 7 * 24, 'delta': timedelta(hours=1)},
        'monthly': {'count': 30, 'delta': timedelta(days=1)},
        'yearly': {'count': 365, 'delta': timedelta(days=1)}
    }

    config = timeframe_intervals.get(timeframe, timeframe_intervals['daily'])
    num_points = config['count']
    delta = config['delta']

    price_series = []
    start_time = datetime.utcnow()

    canvas_width = max(p['x'] for p in points) - min(p['x'] for p in points) if points else 1
    min_x = min(p['x'] for p in points)

    for i in range(num_points):
        progress = i / (num_points - 1) if num_points > 1 else 0
        target_x = min_x + progress * canvas_width

        closest_point = None
        min_distance = float('inf')

        for point in points:
            distance = abs(point['x'] - target_x)
            if distance < min_distance:
                min_distance = distance
                closest_point = point

        if closest_point:
            clamped_y = max(0, min(closest_point['y'], drawable_height))
            y_normalized = 1 - (clamped_y / drawable_height)
            y_normalized = max(0, min(1, y_normalized))
            price = display_min + y_normalized * (display_max - display_min)
        else:
            price = chart_bounds.get('lastPrice', 0)

        timestamp = start_time + (delta * i)
        price_series.append({
            'price': round(price, 2),
            'timestamp': timestamp.isoformat()
        })

    # Get meta-prediction for contrarian score calculation
    meta = MetaPrediction.query.filter_by(symbol=symbol).first()
    meta_series = json.loads(meta.price_series) if meta and meta.price_series else []
    contrarian_score = calculate_contrarian_score(price_series, meta_series)

    prediction = Prediction(
        user_id=user_id,
        symbol=symbol,
        asset_name=asset_name,
        timeframe=timeframe,
        start_price=price_series[0]['price'],
        end_price=price_series[-1]['price'],
        price_series=json.dumps(price_series),
        staked_tokens=staked_tokens,
        contrarian_score=contrarian_score
    )

    db.session.add(prediction)
    db.session.commit()

    # Update meta-prediction with this new prediction
    update_meta_prediction(symbol, price_series)

    return jsonify({
        'success': True,
        'predictionId': prediction.id,
        'message': 'Prediction saved successfully',
        'tokenBalance': user_balance,
        'priceSeries': price_series,
        'contrarianScore': contrarian_score
    })

@app.route('/api/user/predictions')
@require_login
def get_user_predictions():
    auth_user = get_authenticated_user()
    predictions = Prediction.query.filter_by(
        user_id=auth_user.id
    ).order_by(Prediction.created_at.desc()).all()

    return jsonify({
        'predictions': [
            {
                'id': p.id,
                'symbol': p.symbol,
                'assetName': p.asset_name,
                'timeframe': p.timeframe,
                'startPrice': p.start_price,
                'endPrice': p.end_price,
                'stakedTokens': p.staked_tokens,
                'accuracyScore': p.accuracy_score,
                'rewardsEarned': p.rewards_earned,
                'status': p.status,
                'createdAt': p.created_at.isoformat()
            }
            for p in predictions
        ]
    })

@app.route('/api/user/prediction/<symbol>')
def get_user_latest_prediction(symbol):
    auth_user = get_authenticated_user()
    if not auth_user:
        return jsonify({'prediction': None})

    timeframe = request.args.get('timeframe', 'daily')

    prediction = Prediction.query.filter_by(
        user_id=auth_user.id,
        symbol=symbol.upper(),
        timeframe=timeframe
    ).order_by(Prediction.created_at.desc()).first()

    if not prediction:
        return jsonify({'prediction': None})

    price_series = json.loads(prediction.price_series) if prediction.price_series else []

    return jsonify({
        'prediction': {
            'id': prediction.id,
            'symbol': prediction.symbol,
            'timeframe': prediction.timeframe,
            'startPrice': prediction.start_price,
            'endPrice': prediction.end_price,
            'priceSeries': price_series,
            'stakedTokens': prediction.staked_tokens,
            'accuracyScore': prediction.accuracy_score,
            'status': prediction.status,
            'createdAt': prediction.created_at.isoformat()
        }
    })

@app.route('/api/predictions/<int:prediction_id>/score', methods=['POST'])
def update_prediction_score(prediction_id):
    """
    Update prediction score using Mean Squared Percentage Error (MSPE).

    MSPE = (1/N) * Σ [(actual - predicted)² / actual]

    Where N is the number of elapsed time points.
    Payoff = stake * N / MSPE (lower MSPE = higher reward)
    """
    prediction = Prediction.query.get(prediction_id)
    if not prediction:
        return jsonify({'error': 'Prediction not found'}), 404

    auth_user = get_authenticated_user()
    if prediction.user_id and auth_user:
        if str(prediction.user_id) != str(auth_user.id):
            return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    current_price = data.get('currentPrice')

    if current_price is None:
        return jsonify({'error': 'Current price required'}), 400

    if current_price <= 0:
        return jsonify({'error': 'Invalid price'}), 400

    price_series = json.loads(prediction.price_series) if prediction.price_series else []

    if not price_series:
        return jsonify({'error': 'No price series data'}), 400

    now = datetime.utcnow()
    prediction_created = prediction.created_at

    timeframe_durations = {
        'hourly': timedelta(hours=1),
        'daily': timedelta(days=1),
        'weekly': timedelta(weeks=1),
        'monthly': timedelta(days=30),
        'yearly': timedelta(days=365)
    }

    total_duration = timeframe_durations.get(prediction.timeframe, timedelta(days=1))
    elapsed = now - prediction_created
    progress = min(1.0, elapsed.total_seconds() / total_duration.total_seconds())

    n_total = len(price_series)  # Total prediction points
    current_point_index = 0
    predicted_price_at_now = None
    mspe = None

    if progress >= 0.01:
        # Calculate number of elapsed points
        current_point_index = min(
            int(progress * n_total),
            n_total - 1
        )
        n_elapsed = current_point_index + 1  # Number of points that have elapsed

        predicted_price_at_now = price_series[current_point_index]['price']

        # Compute MSPE over all elapsed points
        # SPE = (actual - predicted)² / actual
        # MSPE = mean of all SPE values
        spe_sum = 0.0
        for i in range(n_elapsed):
            predicted_price = price_series[i]['price']
            diff = current_price - predicted_price
            spe = (diff * diff) / current_price
            spe_sum += spe

        mspe = spe_sum / n_elapsed
        prediction.accuracy_score = round(mspe, 6)

        if progress >= 1.0 and prediction.status == 'active':
            prediction.status = 'completed'
            if prediction.staked_tokens > 0 and mspe > 0:
                # Payoff = stake * N / MSPE
                # Lower MSPE = higher rewards
                payoff = (prediction.staked_tokens * n_total) / mspe
                rewards = int(payoff)
                prediction.rewards_earned = rewards

                if prediction.user_id:
                    user = User.query.get(prediction.user_id)
                    if user:
                        user.token_balance += rewards
                        db.session.add(user)

        db.session.commit()

    return jsonify({
        'predictionId': prediction.id,
        'mspe': prediction.accuracy_score,
        'status': prediction.status,
        'rewardsEarned': prediction.rewards_earned,
        'progress': round(progress * 100, 1),
        'currentPointIndex': current_point_index,
        'nElapsed': current_point_index + 1 if progress >= 0.01 else 0,
        'nTotal': n_total,
        'predictedPrice': predicted_price_at_now,
        'actualPrice': current_price
    })


def calculate_payoff(staked_tokens, n_total, mspe):
    """Calculate payoff based on stake, prediction length, and MSPE.

    Payoff = stake * N / MSPE
    Lower MSPE = higher rewards
    """
    if mspe is None or mspe <= 0 or staked_tokens <= 0:
        return 0
    return int((staked_tokens * n_total) / mspe)


def calculate_estimated_payoff(prediction, current_price=None):
    """Calculate estimated payoff for a prediction based on current state."""
    price_series = json.loads(prediction.price_series) if prediction.price_series else []
    n_total = len(price_series)

    if prediction.status == 'completed':
        return prediction.rewards_earned or 0

    if prediction.accuracy_score is not None and prediction.accuracy_score > 0:
        return calculate_payoff(prediction.staked_tokens, n_total, prediction.accuracy_score)

    # If no score yet, estimate based on start vs end price difference
    if current_price and prediction.start_price:
        diff = abs(current_price - prediction.start_price)
        estimated_mspe = (diff * diff) / current_price if current_price > 0 else 1
        if estimated_mspe > 0:
            return calculate_payoff(prediction.staked_tokens, n_total, estimated_mspe)

    return 0


@app.route('/api/predictions/<int:prediction_id>/close', methods=['POST'])
@require_login
def close_or_collect_prediction(prediction_id):
    """Close a prediction early or collect rewards for completed predictions."""
    prediction = Prediction.query.get(prediction_id)
    if not prediction:
        return jsonify({'error': 'Prediction not found'}), 404

    # Use get_authenticated_user for token-based auth support
    auth_user = get_authenticated_user()
    if str(prediction.user_id) != str(auth_user.id):
        return jsonify({'error': 'You can only close your own predictions'}), 403

    if prediction.status != 'active':
        return jsonify({'error': 'Prediction is not active'}), 400

    # Check market hours for non-crypto assets
    if not is_market_open(prediction.symbol):
        next_open = get_next_market_open(prediction.symbol)
        return jsonify({
            'error': f'Market is closed. Try again during market hours (9:30 AM - 4:00 PM ET, Mon-Fri).',
            'nextOpen': next_open,
            'isCrypto': False
        }), 400

    data = request.get_json() or {}
    current_price = data.get('currentPrice')

    # If no current price provided, try to fetch it
    if current_price is None or current_price <= 0:
        # Use the start price as a fallback (will result in lower accuracy score)
        current_price = prediction.start_price
        if current_price is None or current_price <= 0:
            return jsonify({'error': 'Valid current price required'}), 400

    price_series = json.loads(prediction.price_series) if prediction.price_series else []
    n_total = len(price_series)

    if not price_series:
        return jsonify({'error': 'No price series data'}), 400

    # Calculate progress
    now = datetime.utcnow()
    prediction_created = prediction.created_at

    timeframe_durations = {
        'hourly': timedelta(hours=1),
        'daily': timedelta(days=1),
        'weekly': timedelta(weeks=1),
        'monthly': timedelta(days=30),
        'yearly': timedelta(days=365)
    }

    total_duration = timeframe_durations.get(prediction.timeframe, timedelta(days=1))
    elapsed = now - prediction_created
    progress = min(1.0, elapsed.total_seconds() / total_duration.total_seconds())

    # Determine if this is early close or reward collection
    is_early_close = progress < 1.0
    is_completed = progress >= 1.0

    # For early close, require minimum 5% progress
    if is_early_close and progress < 0.05:
        return jsonify({'error': 'Cannot close prediction in first 5% of timeframe'}), 400

    # Calculate MSPE over elapsed points
    current_point_index = min(int(progress * n_total), n_total - 1)
    n_elapsed = current_point_index + 1 if is_early_close else n_total

    spe_sum = 0.0
    for i in range(n_elapsed):
        predicted_price = price_series[i]['price']
        diff = current_price - predicted_price
        spe = (diff * diff) / current_price if current_price > 0 else 0
        spe_sum += spe

    mspe = spe_sum / n_elapsed if n_elapsed > 0 else 0
    prediction.accuracy_score = round(mspe, 6)

    # Calculate payoff using new function with contrarian bonus
    payoff = calculate_new_payoff(
        prediction.staked_tokens,
        mspe,
        prediction.contrarian_score,
        n_total,
        is_early_close=is_early_close,
        progress=progress
    )

    # Set status based on whether it's early close or full completion
    prediction.status = 'closed' if is_early_close else 'completed'
    prediction.rewards_earned = payoff

    # Credit user
    user = User.query.get(auth_user.id)
    if user:
        user.token_balance += payoff
        db.session.add(user)

    db.session.commit()

    # Different messages for close vs collect
    if is_completed:
        message = f'Rewards collected! You earned {payoff:,} tokens.'
    else:
        message = f'Position closed early at {round(progress * 100, 1)}% progress. You received {payoff:,} tokens.'

    return jsonify({
        'success': True,
        'predictionId': prediction.id,
        'mspe': prediction.accuracy_score,
        'contrarianScore': prediction.contrarian_score,
        'progress': round(progress * 100, 1),
        'payoff': payoff,
        'newBalance': user.token_balance if user else 0,
        'message': message,
        'isEarlyClose': is_early_close
    })


def calculate_time_weighted_mspe(predictions, half_life_days=30):
    """
    Calculate time-weighted MSPE where recent predictions have more weight.
    Uses exponential decay with configurable half-life.

    Weight = exp(-ln(2) * days_ago / half_life_days)

    Time-weighted MSPE = Σ(weight_i * mspe_i) / Σ(weight_i)
    """
    now = datetime.utcnow()
    decay_constant = math.log(2) / half_life_days

    total_weighted_mspe = 0.0
    total_weight = 0.0

    for pred in predictions:
        if pred.accuracy_score is None:
            continue

        days_ago = (now - pred.created_at).total_seconds() / 86400.0
        weight = math.exp(-decay_constant * days_ago)

        total_weighted_mspe += weight * pred.accuracy_score
        total_weight += weight

    if total_weight == 0:
        return None

    return total_weighted_mspe / total_weight


@app.route('/api/leaderboard')
def get_leaderboard():
    """Get leaderboard of users ranked by time-weighted MSPE across all predictions."""
    from sqlalchemy import func

    # Get all users with predictions
    user_ids = db.session.query(Prediction.user_id).filter(
        Prediction.user_id.isnot(None),
        Prediction.accuracy_score.isnot(None)
    ).distinct().all()

    user_ids = [u[0] for u in user_ids]

    leaderboard = []
    for user_id in user_ids:
        user = User.query.get(user_id)
        if not user:
            continue

        # Get all predictions with scores for this user
        predictions = Prediction.query.filter(
            Prediction.user_id == user_id,
            Prediction.accuracy_score.isnot(None)
        ).all()

        if not predictions:
            continue

        # Calculate time-weighted MSPE
        tw_mspe = calculate_time_weighted_mspe(predictions)

        # Calculate regular mean MSPE for comparison
        mean_mspe = sum(p.accuracy_score for p in predictions) / len(predictions)

        # Calculate totals
        total_staked = sum(p.staked_tokens for p in predictions)
        total_rewards = sum(p.rewards_earned or 0 for p in predictions)
        prediction_count = len(predictions)

        display_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        if not display_name:
            display_name = user.email.split('@')[0] if user.email else 'Anonymous'

        leaderboard.append({
            'userId': user.id,
            'displayName': display_name,
            'timeWeightedMspe': round(float(tw_mspe), 6) if tw_mspe else None,
            'meanMspe': round(float(mean_mspe), 6) if mean_mspe else None,
            'predictionCount': prediction_count,
            'totalStaked': total_staked or 0,
            'totalRewards': total_rewards or 0,
            'tokenBalance': user.token_balance,
            'profitLoss': (total_rewards or 0) - (total_staked or 0)
        })

    # Sort by time-weighted MSPE (lower is better), then by token balance
    leaderboard.sort(key=lambda x: (x['timeWeightedMspe'] if x['timeWeightedMspe'] is not None else float('inf'), -x['tokenBalance']))

    # Add rank
    for i, entry in enumerate(leaderboard):
        entry['rank'] = i + 1

    return jsonify({
        'leaderboard': leaderboard,
        'totalUsers': len(leaderboard)
    })


@app.route('/api/user/stats')
@require_login
def get_user_stats():
    """Get detailed statistics for the current user."""
    from sqlalchemy import func

    auth_user = get_authenticated_user()
    user = User.query.get(auth_user.id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Get prediction stats
    predictions = Prediction.query.filter_by(user_id=auth_user.id).all()

    active_predictions = [p for p in predictions if p.status == 'active']
    completed_predictions = [p for p in predictions if p.status in ('completed', 'closed')]

    # Calculate mean MSPE
    mspe_values = [p.accuracy_score for p in predictions if p.accuracy_score is not None]
    mean_mspe = sum(mspe_values) / len(mspe_values) if mspe_values else None

    # Calculate time-weighted MSPE
    tw_mspe = calculate_time_weighted_mspe(predictions)

    # Calculate totals
    total_staked = sum(p.staked_tokens for p in predictions)
    total_rewards = sum(p.rewards_earned or 0 for p in predictions)

    # Get user's rank on leaderboard (using time-weighted MSPE)
    all_user_ids = db.session.query(Prediction.user_id).filter(
        Prediction.user_id.isnot(None),
        Prediction.accuracy_score.isnot(None)
    ).distinct().all()

    user_tw_mspes = []
    for (uid,) in all_user_ids:
        user_preds = Prediction.query.filter(
            Prediction.user_id == uid,
            Prediction.accuracy_score.isnot(None)
        ).all()
        user_tw = calculate_time_weighted_mspe(user_preds)
        if user_tw is not None:
            user_tw_mspes.append((uid, user_tw))

    sorted_users = sorted(user_tw_mspes, key=lambda x: x[1])
    rank = next((i + 1 for i, (uid, _) in enumerate(sorted_users) if uid == auth_user.id), None)

    # Build prediction history for chart
    prediction_history = []
    for p in sorted(predictions, key=lambda x: x.created_at):
        prediction_history.append({
            'id': p.id,
            'symbol': p.symbol,
            'timeframe': p.timeframe,
            'stakedTokens': p.staked_tokens,
            'rewardsEarned': p.rewards_earned,
            'mspe': p.accuracy_score,
            'status': p.status,
            'createdAt': p.created_at.isoformat()
        })

    return jsonify({
        'user': {
            'id': user.id,
            'email': user.email,
            'firstName': user.first_name,
            'lastName': user.last_name,
            'tokenBalance': user.token_balance,
            'createdAt': user.created_at.isoformat()
        },
        'stats': {
            'totalPredictions': len(predictions),
            'activePredictions': len(active_predictions),
            'completedPredictions': len(completed_predictions),
            'meanMspe': round(mean_mspe, 6) if mean_mspe else None,
            'timeWeightedMspe': round(tw_mspe, 6) if tw_mspe else None,
            'totalStaked': total_staked,
            'totalRewards': total_rewards,
            'profitLoss': total_rewards - total_staked,
            'rank': rank,
            'totalRankedUsers': len(sorted_users)
        },
        'predictionHistory': prediction_history
    })


@app.route('/api/user/predictions/detailed')
@require_login
def get_user_predictions_detailed():
    """Get detailed predictions for the current user with progress info."""
    auth_user = get_authenticated_user()
    predictions = Prediction.query.filter_by(
        user_id=auth_user.id
    ).order_by(Prediction.created_at.desc()).all()

    now = datetime.utcnow()
    timeframe_durations = {
        'hourly': timedelta(hours=1),
        'daily': timedelta(days=1),
        'weekly': timedelta(weeks=1),
        'monthly': timedelta(days=30),
        'yearly': timedelta(days=365)
    }

    result = []
    for p in predictions:
        # Calculate progress
        progress = None
        if p.status == 'active':
            total_duration = timeframe_durations.get(p.timeframe, timedelta(days=1))
            elapsed = now - p.created_at
            progress = min(100.0, (elapsed.total_seconds() / total_duration.total_seconds()) * 100)

        # Calculate estimated payoff
        price_series = json.loads(p.price_series) if p.price_series else []
        n_total = len(price_series)

        if p.status in ('completed', 'closed'):
            est_payoff = p.rewards_earned or 0
        elif p.accuracy_score and p.accuracy_score > 0 and p.staked_tokens > 0:
            est_payoff = int((p.staked_tokens * n_total) / p.accuracy_score)
        else:
            est_payoff = None

        result.append({
            'id': p.id,
            'symbol': p.symbol,
            'assetName': p.asset_name,
            'timeframe': p.timeframe,
            'startPrice': p.start_price,
            'endPrice': p.end_price,
            'stakedTokens': p.staked_tokens,
            'mspe': p.accuracy_score,
            'estimatedPayoff': est_payoff,
            'rewardsEarned': p.rewards_earned,
            'status': p.status,
            'progress': round(progress, 1) if progress is not None else None,
            'createdAt': p.created_at.isoformat()
        })

    return jsonify({'predictions': result})


@app.route('/api/trades/top-profitable')
def get_top_profitable_trades():
    """Get the most profitable trades of all time."""
    limit = request.args.get('limit', 20, type=int)

    # Get completed predictions sorted by profit (rewards - staked)
    predictions = Prediction.query.filter(
        Prediction.status.in_(['completed', 'closed']),
        Prediction.rewards_earned.isnot(None),
        Prediction.user_id.isnot(None)
    ).order_by(
        (Prediction.rewards_earned - Prediction.staked_tokens).desc()
    ).limit(limit).all()

    result = []
    for p in predictions:
        user = User.query.get(p.user_id)
        display_name = 'Anonymous'
        if user:
            display_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
            if not display_name:
                display_name = user.email.split('@')[0] if user.email else 'Anonymous'

        profit = (p.rewards_earned or 0) - p.staked_tokens

        result.append({
            'id': p.id,
            'userId': p.user_id,
            'userName': display_name,
            'symbol': p.symbol,
            'assetName': p.asset_name,
            'timeframe': p.timeframe,
            'stakedTokens': p.staked_tokens,
            'rewardsEarned': p.rewards_earned or 0,
            'profit': profit,
            'mspe': p.accuracy_score,
            'status': p.status,
            'createdAt': p.created_at.isoformat()
        })

    return jsonify({
        'trades': result,
        'total': len(result)
    })


@app.route('/api/trades/<int:prediction_id>/details')
def get_trade_details(prediction_id):
    """Get detailed trade info including prediction series and actual price data for overlay."""
    prediction = Prediction.query.get(prediction_id)
    if not prediction:
        return jsonify({'error': 'Trade not found'}), 404

    # Get user info
    user = None
    display_name = 'Anonymous'
    if prediction.user_id:
        user = User.query.get(prediction.user_id)
        if user:
            display_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
            if not display_name:
                display_name = user.email.split('@')[0] if user.email else 'Anonymous'

    # Parse prediction price series
    price_series = json.loads(prediction.price_series) if prediction.price_series else []

    # Calculate progress
    now = datetime.utcnow()
    timeframe_durations = {
        'hourly': timedelta(hours=1),
        'daily': timedelta(days=1),
        'weekly': timedelta(weeks=1),
        'monthly': timedelta(days=30),
        'yearly': timedelta(days=365)
    }

    total_duration = timeframe_durations.get(prediction.timeframe, timedelta(days=1))
    elapsed = now - prediction.created_at
    progress = min(1.0, elapsed.total_seconds() / total_duration.total_seconds())

    # Calculate profit
    profit = None
    if prediction.status in ['completed', 'closed']:
        profit = (prediction.rewards_earned or 0) - prediction.staked_tokens

    # Get actual price data for the prediction period
    actual_prices = []
    interval_map = {
        'hourly': '1min',
        'daily': '1h',
        'weekly': '1h',
        'monthly': '1day',
        'yearly': '1day'
    }
    interval = interval_map.get(prediction.timeframe, '1h')

    # Get price data from cache
    end_time = prediction.created_at + total_duration
    if now < end_time:
        end_time = now

    price_data = PriceData.query.filter(
        PriceData.symbol == prediction.symbol,
        PriceData.interval == interval,
        PriceData.timestamp >= prediction.created_at,
        PriceData.timestamp <= end_time
    ).order_by(PriceData.timestamp.asc()).all()

    actual_prices = [
        {
            'timestamp': pd.timestamp.isoformat(),
            'price': pd.close
        }
        for pd in price_data
    ]

    return jsonify({
        'trade': {
            'id': prediction.id,
            'userId': prediction.user_id,
            'userName': display_name,
            'symbol': prediction.symbol,
            'assetName': prediction.asset_name,
            'timeframe': prediction.timeframe,
            'startPrice': prediction.start_price,
            'endPrice': prediction.end_price,
            'stakedTokens': prediction.staked_tokens,
            'rewardsEarned': prediction.rewards_earned,
            'profit': profit,
            'mspe': prediction.accuracy_score,
            'status': prediction.status,
            'progress': round(progress * 100, 1),
            'createdAt': prediction.created_at.isoformat()
        },
        'predictionSeries': price_series,
        'actualPrices': actual_prices
    })


@app.route('/api/user/performance-history')
@require_login
def get_user_performance_history():
    """Get historical performance data for the current user."""
    auth_user = get_authenticated_user()

    # Get performance history records
    history = UserPerformanceHistory.query.filter_by(
        user_id=auth_user.id
    ).order_by(UserPerformanceHistory.recorded_at.asc()).all()

    return jsonify({
        'history': [
            {
                'recordedAt': h.recorded_at.isoformat(),
                'tokenBalance': h.token_balance,
                'totalPredictions': h.total_predictions,
                'completedPredictions': h.completed_predictions,
                'meanMspe': h.mean_mspe,
                'timeWeightedMspe': h.time_weighted_mspe,
                'totalStaked': h.total_staked,
                'totalRewards': h.total_rewards,
                'profitLoss': h.profit_loss,
                'rank': h.rank
            }
            for h in history
        ]
    })


def record_user_performance_snapshot(user_id):
    """Record a performance snapshot for a user."""
    user = User.query.get(user_id)
    if not user:
        return None

    predictions = Prediction.query.filter_by(user_id=user_id).all()
    completed = [p for p in predictions if p.status in ('completed', 'closed')]

    mspe_values = [p.accuracy_score for p in predictions if p.accuracy_score is not None]
    mean_mspe = sum(mspe_values) / len(mspe_values) if mspe_values else None
    tw_mspe = calculate_time_weighted_mspe(predictions)

    total_staked = sum(p.staked_tokens for p in predictions)
    total_rewards = sum(p.rewards_earned or 0 for p in predictions)

    # Calculate rank
    all_user_ids = db.session.query(Prediction.user_id).filter(
        Prediction.user_id.isnot(None),
        Prediction.accuracy_score.isnot(None)
    ).distinct().all()

    user_tw_mspes = []
    for (uid,) in all_user_ids:
        user_preds = Prediction.query.filter(
            Prediction.user_id == uid,
            Prediction.accuracy_score.isnot(None)
        ).all()
        user_tw = calculate_time_weighted_mspe(user_preds)
        if user_tw is not None:
            user_tw_mspes.append((uid, user_tw))

    sorted_users = sorted(user_tw_mspes, key=lambda x: x[1])
    rank = next((i + 1 for i, (uid, _) in enumerate(sorted_users) if uid == user_id), None)

    snapshot = UserPerformanceHistory(
        user_id=user_id,
        token_balance=user.token_balance,
        total_predictions=len(predictions),
        completed_predictions=len(completed),
        mean_mspe=mean_mspe,
        time_weighted_mspe=tw_mspe,
        total_staked=total_staked,
        total_rewards=total_rewards,
        profit_loss=total_rewards - total_staked,
        rank=rank
    )

    db.session.add(snapshot)
    db.session.commit()
    return snapshot


@app.route('/api/admin/record-snapshots', methods=['POST'])
def record_all_performance_snapshots():
    """Record performance snapshots for all users. Can be called by a cron job."""
    # Get all users with predictions
    user_ids = db.session.query(Prediction.user_id).filter(
        Prediction.user_id.isnot(None)
    ).distinct().all()

    recorded = 0
    for (user_id,) in user_ids:
        snapshot = record_user_performance_snapshot(user_id)
        if snapshot:
            recorded += 1

    return jsonify({
        'success': True,
        'snapshotsRecorded': recorded
    })


@app.route('/api/user/settings', methods=['GET'])
@require_login
def get_user_settings():
    """Get current user settings."""
    auth_user = get_authenticated_user()
    user = User.query.get(auth_user.id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Settings stored in session until we add DB migration
    return jsonify({
        'settings': {
            'timezone': session.get('user_timezone', 'America/New_York'),
            'language': session.get('user_language', 'en')
        },
        'availableTimezones': SUPPORTED_TIMEZONES,
        'availableLanguages': SUPPORTED_LANGUAGES
    })


@app.route('/api/user/settings', methods=['PUT'])
@require_login
def update_user_settings():
    """Update user settings (timezone, language)."""
    auth_user = get_authenticated_user()
    user = User.query.get(auth_user.id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()

    # Store settings in session until we add DB migration
    if 'timezone' in data:
        if data['timezone'] in SUPPORTED_TIMEZONES:
            session['user_timezone'] = data['timezone']
        else:
            return jsonify({'error': f'Invalid timezone. Supported: {", ".join(SUPPORTED_TIMEZONES[:5])}...'}), 400

    if 'language' in data:
        if data['language'] in SUPPORTED_LANGUAGES:
            session['user_language'] = data['language']
        else:
            return jsonify({'error': f'Invalid language. Supported: {", ".join(SUPPORTED_LANGUAGES)}'}), 400

    return jsonify({
        'success': True,
        'settings': {
            'timezone': session.get('user_timezone', 'America/New_York'),
            'language': session.get('user_language', 'en')
        }
    })


@app.route('/api/admin/reset-balances', methods=['POST'])
def reset_all_user_balances():
    """Reset all user token balances to default (100). Admin endpoint."""
    # In production, this should have admin authentication
    data = request.get_json() or {}
    admin_key = data.get('adminKey')

    # Simple security check - in production use proper admin auth
    expected_key = os.environ.get('ADMIN_SECRET_KEY', 'admin-reset-key-2024')
    if admin_key != expected_key:
        return jsonify({'error': 'Unauthorized'}), 403

    # Reset all user balances
    users = User.query.all()
    reset_count = 0

    for user in users:
        user.token_balance = DEFAULT_TOKEN_BALANCE
        reset_count += 1

    db.session.commit()

    logging.info(f"Admin action: Reset {reset_count} user balances to {DEFAULT_TOKEN_BALANCE}")

    return jsonify({
        'success': True,
        'message': f'Reset {reset_count} user balances to {DEFAULT_TOKEN_BALANCE} tokens',
        'usersReset': reset_count
    })


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
