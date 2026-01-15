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
import models
from models import User, OAuth, Prediction

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", os.urandom(24).hex())
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1, x_for=1, x_prefix=1)
CORS(app, supports_credentials=True)

replit_domain = os.environ.get('REPLIT_DEV_DOMAIN') or os.environ.get('REPLIT_DOMAINS', '').split(',')[0]
if replit_domain:
    app.config['PREFERRED_URL_SCHEME'] = 'https'

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

db.init_app(app)

with app.app_context():
    db.create_all()
    logging.info("Database tables created")

from replit_auth import init_auth, require_login
init_auth(app, db, OAuth, User)

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

@app.route('/api/auth/user')
def get_current_user():
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': current_user.id,
                'email': current_user.email,
                'firstName': current_user.first_name,
                'lastName': current_user.last_name,
                'profileImageUrl': current_user.profile_image_url,
                'tokenBalance': current_user.token_balance
            }
        })
    return jsonify({'authenticated': False, 'user': None})

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
            'lastTimestamp': prices[-1]['timestamp'] if prices else None
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
            'accuracyScore': p.accuracy_score,
            'rewardsEarned': p.rewards_earned,
            'status': p.status,
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
    
    if progress >= 0.01:
        num_points_to_check = max(1, int(progress * len(price_series)))
        num_points_to_check = min(num_points_to_check, len(price_series))
        
        score_sum = 0.0
        for i in range(num_points_to_check):
            predicted_price = price_series[i]['price']
            diff = current_price - predicted_price
            diff_squared = diff * diff
            if diff_squared > 0.0001:
                score_sum += 1.0 / diff_squared
            else:
                score_sum += 10000.0
        
        prediction.accuracy_score = round(score_sum, 4)
        
        if progress >= 1.0 and prediction.status == 'active':
            prediction.status = 'completed'
            if prediction.staked_tokens > 0:
                base_reward = prediction.staked_tokens
                reward_multiplier = prediction.accuracy_score / 50 if prediction.accuracy_score else 0
                rewards = int(base_reward * reward_multiplier)
                prediction.rewards_earned = rewards
                
                if prediction.user_id:
                    user = User.query.get(prediction.user_id)
                    if user:
                        user.token_balance += rewards
                        db.session.add(user)
        
        db.session.commit()
    
    return jsonify({
        'predictionId': prediction.id,
        'accuracyScore': prediction.accuracy_score,
        'status': prediction.status,
        'rewardsEarned': prediction.rewards_earned,
        'progress': round(progress * 100, 1)
    })

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
