import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import yfinance as yf
import json

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class Prediction(db.Model):
    __tablename__ = 'predictions'
    
    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String(20), nullable=False, index=True)
    timeframe = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    start_price = db.Column(db.Float, nullable=False)
    end_price = db.Column(db.Float, nullable=False)
    price_series = db.Column(db.Text, nullable=False)

with app.app_context():
    db.create_all()

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
                'startPrice': p.start_price,
                'endPrice': p.end_price,
                'createdAt': p.created_at.isoformat()
            }
            for p in predictions[:10]
        ],
        'average': average,
        'count': len(predictions)
    })

@app.route('/api/predictions', methods=['POST'])
def submit_prediction():
    data = request.get_json()
    
    symbol = data.get('symbol')
    timeframe = data.get('timeframe')
    points = data.get('points', [])
    chart_bounds = data.get('chartBounds', {})
    canvas_dimensions = data.get('canvasDimensions', {})
    
    if not symbol or not points or len(points) < 2:
        return jsonify({'error': 'Invalid prediction data'}), 400
    
    canvas_height = canvas_dimensions.get('height', 400)
    canvas_width_actual = canvas_dimensions.get('width', 400)
    
    price_range = chart_bounds.get('maxPrice', 100) - chart_bounds.get('minPrice', 0)
    padding = price_range * 0.1
    display_max = chart_bounds.get('maxPrice', 100) + padding
    display_min = chart_bounds.get('minPrice', 0) - padding
    
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
            y_normalized = 1 - (closest_point['y'] / canvas_height)
            price = display_min + y_normalized * (display_max - display_min)
        else:
            price = chart_bounds.get('lastPrice', 0)
        
        timestamp = start_time + (delta * i)
        price_series.append({
            'price': round(price, 2),
            'timestamp': timestamp.isoformat()
        })
    
    prediction = Prediction(
        symbol=symbol,
        timeframe=timeframe,
        start_price=price_series[0]['price'],
        end_price=price_series[-1]['price'],
        price_series=json.dumps(price_series)
    )
    
    db.session.add(prediction)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'predictionId': prediction.id,
        'message': 'Prediction saved successfully'
    })

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
