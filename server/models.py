from datetime import datetime
from flask_dance.consumer.storage.sqla import OAuthConsumerMixin
from flask_login import UserMixin
from sqlalchemy import UniqueConstraint

from db import db

DEFAULT_TOKEN_BALANCE = 1000

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.String, primary_key=True)
    email = db.Column(db.String, unique=True, nullable=True)
    first_name = db.Column(db.String, nullable=True)
    last_name = db.Column(db.String, nullable=True)
    profile_image_url = db.Column(db.String, nullable=True)
    token_balance = db.Column(db.Integer, default=DEFAULT_TOKEN_BALANCE, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    
    predictions = db.relationship('Prediction', backref='user', lazy=True)

class OAuth(OAuthConsumerMixin, db.Model):
    user_id = db.Column(db.String, db.ForeignKey(User.id))
    browser_session_key = db.Column(db.String, nullable=False)
    user = db.relationship(User)

    __table_args__ = (UniqueConstraint(
        'user_id',
        'browser_session_key',
        'provider',
        name='uq_user_browser_session_key_provider',
    ),)

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
