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
from models import User, Prediction, PriceData
from auth import auth_bp, init_auth, require_login
import twelve_data

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

CORS(app,
     supports_credentials=True,
     origins=allowed_origins,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

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
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

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

    if not current_user.is_authenticated:
        return jsonify({'error': 'You must be logged in to submit predictions'}), 401

    if staked_tokens < 1:
        return jsonify({'error': 'Minimum stake is 1 token'}), 400

    user_id = current_user.id
    user = User.query.get(current_user.id)
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

    prediction = Prediction(
        user_id=user_id,
        symbol=symbol,
        asset_name=asset_name,
        timeframe=timeframe,
        start_price=price_series[0]['price'],
        end_price=price_series[-1]['price'],
        price_series=json.dumps(price_series),
        staked_tokens=staked_tokens
    )

    db.session.add(prediction)
    db.session.commit()

    return jsonify({
        'success': True,
        'predictionId': prediction.id,
        'message': 'Prediction saved successfully',
        'tokenBalance': user_balance,
        'priceSeries': price_series
    })

@app.route('/api/user/predictions')
@require_login
def get_user_predictions():
    predictions = Prediction.query.filter_by(
        user_id=current_user.id
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
    if not current_user.is_authenticated:
        return jsonify({'prediction': None})

    timeframe = request.args.get('timeframe', 'daily')

    prediction = Prediction.query.filter_by(
        user_id=current_user.id,
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

    if prediction.user_id and current_user.is_authenticated:
        if str(prediction.user_id) != str(current_user.id):
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
def close_prediction_early(prediction_id):
    """Close a prediction early and receive prorated payoff."""
    prediction = Prediction.query.get(prediction_id)
    if not prediction:
        return jsonify({'error': 'Prediction not found'}), 404

    if str(prediction.user_id) != str(current_user.id):
        return jsonify({'error': 'You can only close your own predictions'}), 403

    if prediction.status != 'active':
        return jsonify({'error': 'Prediction is not active'}), 400

    data = request.get_json()
    current_price = data.get('currentPrice')

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

    if progress < 0.05:
        return jsonify({'error': 'Cannot close prediction in first 5% of timeframe'}), 400

    # Calculate MSPE over elapsed points
    current_point_index = min(int(progress * n_total), n_total - 1)
    n_elapsed = current_point_index + 1

    spe_sum = 0.0
    for i in range(n_elapsed):
        predicted_price = price_series[i]['price']
        diff = current_price - predicted_price
        spe = (diff * diff) / current_price
        spe_sum += spe

    mspe = spe_sum / n_elapsed
    prediction.accuracy_score = round(mspe, 6)

    # Calculate prorated payoff
    # Payoff = (stake * n_elapsed / MSPE) * progress_multiplier
    # Early close gets reduced payoff (progress_multiplier)
    if mspe > 0 and prediction.staked_tokens > 0:
        base_payoff = (prediction.staked_tokens * n_elapsed) / mspe
        progress_multiplier = 0.5 + (progress * 0.5)  # 50% to 100% based on progress
        payoff = int(base_payoff * progress_multiplier)
    else:
        payoff = 0

    prediction.status = 'closed'
    prediction.rewards_earned = payoff

    # Credit user
    user = User.query.get(current_user.id)
    if user:
        user.token_balance += payoff
        db.session.add(user)

    db.session.commit()

    return jsonify({
        'success': True,
        'predictionId': prediction.id,
        'mspe': prediction.accuracy_score,
        'progress': round(progress * 100, 1),
        'payoff': payoff,
        'newBalance': user.token_balance if user else 0,
        'message': f'Position closed early at {round(progress * 100, 1)}% progress'
    })


@app.route('/api/leaderboard')
def get_leaderboard():
    """Get leaderboard of users ranked by mean MSPE across all predictions."""
    from sqlalchemy import func

    # Get users with their average MSPE and prediction count
    user_stats = db.session.query(
        Prediction.user_id,
        func.avg(Prediction.accuracy_score).label('mean_mspe'),
        func.count(Prediction.id).label('prediction_count'),
        func.sum(Prediction.staked_tokens).label('total_staked'),
        func.sum(Prediction.rewards_earned).label('total_rewards')
    ).filter(
        Prediction.user_id.isnot(None),
        Prediction.accuracy_score.isnot(None)
    ).group_by(Prediction.user_id).all()

    leaderboard = []
    for stat in user_stats:
        user = User.query.get(stat.user_id)
        if user:
            display_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
            if not display_name:
                display_name = user.email.split('@')[0] if user.email else 'Anonymous'

            leaderboard.append({
                'userId': user.id,
                'displayName': display_name,
                'meanMspe': round(float(stat.mean_mspe), 6) if stat.mean_mspe else None,
                'predictionCount': stat.prediction_count,
                'totalStaked': stat.total_staked or 0,
                'totalRewards': stat.total_rewards or 0,
                'tokenBalance': user.token_balance,
                'profitLoss': (stat.total_rewards or 0) - (stat.total_staked or 0)
            })

    # Sort by mean MSPE (lower is better), then by token balance
    leaderboard.sort(key=lambda x: (x['meanMspe'] if x['meanMspe'] is not None else float('inf'), -x['tokenBalance']))

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

    user = User.query.get(current_user.id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Get prediction stats
    predictions = Prediction.query.filter_by(user_id=current_user.id).all()

    active_predictions = [p for p in predictions if p.status == 'active']
    completed_predictions = [p for p in predictions if p.status in ('completed', 'closed')]

    # Calculate mean MSPE
    mspe_values = [p.accuracy_score for p in predictions if p.accuracy_score is not None]
    mean_mspe = sum(mspe_values) / len(mspe_values) if mspe_values else None

    # Calculate totals
    total_staked = sum(p.staked_tokens for p in predictions)
    total_rewards = sum(p.rewards_earned or 0 for p in predictions)

    # Get user's rank on leaderboard
    all_user_mspes = db.session.query(
        Prediction.user_id,
        func.avg(Prediction.accuracy_score).label('mean_mspe')
    ).filter(
        Prediction.user_id.isnot(None),
        Prediction.accuracy_score.isnot(None)
    ).group_by(Prediction.user_id).all()

    sorted_users = sorted(all_user_mspes, key=lambda x: x.mean_mspe if x.mean_mspe else float('inf'))
    rank = next((i + 1 for i, u in enumerate(sorted_users) if u.user_id == current_user.id), None)

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
    predictions = Prediction.query.filter_by(
        user_id=current_user.id
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


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
