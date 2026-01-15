from datetime import datetime
from flask_login import UserMixin
import uuid

from db import db

DEFAULT_TOKEN_BALANCE = 100

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String, unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String, nullable=True)
    last_name = db.Column(db.String, nullable=True)
    profile_image_url = db.Column(db.String, nullable=True)
    token_balance = db.Column(db.Integer, default=DEFAULT_TOKEN_BALANCE, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    predictions = db.relationship('Prediction', backref='user', lazy=True)

class Prediction(db.Model):
    __tablename__ = 'predictions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('users.id'), nullable=True)
    symbol = db.Column(db.String(20), nullable=False, index=True)
    asset_name = db.Column(db.String(100), nullable=True)
    timeframe = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    start_price = db.Column(db.Float, nullable=False)
    end_price = db.Column(db.Float, nullable=False)
    price_series = db.Column(db.Text, nullable=False)
    staked_tokens = db.Column(db.Integer, default=0, nullable=False)
    accuracy_score = db.Column(db.Float, nullable=True)
    rewards_earned = db.Column(db.Integer, default=0, nullable=False)
    status = db.Column(db.String(20), default='active')


class PriceData(db.Model):
    """Store historical price data from Twelve Data API to reduce API calls and enable offline access."""
    __tablename__ = 'price_data'

    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String(20), nullable=False, index=True)
    interval = db.Column(db.String(10), nullable=False)  # 1min, 5min, 15min, 1h, 1day
    timestamp = db.Column(db.DateTime, nullable=False, index=True)
    open = db.Column(db.Float, nullable=False)
    high = db.Column(db.Float, nullable=False)
    low = db.Column(db.Float, nullable=False)
    close = db.Column(db.Float, nullable=False)
    volume = db.Column(db.BigInteger, nullable=True)
    fetched_at = db.Column(db.DateTime, default=datetime.utcnow)  # When we got this data

    __table_args__ = (
        db.UniqueConstraint('symbol', 'interval', 'timestamp', name='unique_price_point'),
        db.Index('idx_symbol_interval_timestamp', 'symbol', 'interval', 'timestamp'),
    )
