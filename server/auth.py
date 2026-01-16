import re
import secrets
from functools import wraps
from flask import Blueprint, request, jsonify
from flask_login import LoginManager, login_user, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash

from db import db
from models import User, DEFAULT_TOKEN_BALANCE

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')
login_manager = LoginManager()

# Store for auth tokens (in production, use Redis or database)
auth_tokens = {}

def init_auth(app):
    login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

def get_authenticated_user():
    """Get authenticated user from session cookie OR auth token header."""
    # First try session-based auth
    if current_user.is_authenticated:
        return current_user

    # Fall back to token-based auth for mobile
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header[7:]
        user_id = auth_tokens.get(token)
        if user_id:
            user = User.query.get(user_id)
            if user:
                return user

    return None

def require_login(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_authenticated_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def is_valid_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    first_name = data.get('firstName', '').strip()
    last_name = data.get('lastName', '').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    if not is_valid_email(email):
        return jsonify({'error': 'Invalid email format'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({'error': 'Email already registered'}), 409

    user = User(
        email=email,
        password_hash=generate_password_hash(password),
        first_name=first_name or None,
        last_name=last_name or None,
        token_balance=DEFAULT_TOKEN_BALANCE
    )

    db.session.add(user)
    db.session.commit()

    login_user(user, remember=True)

    # Generate auth token for mobile/cross-origin support
    auth_token = secrets.token_urlsafe(32)
    auth_tokens[auth_token] = user.id

    return jsonify({
        'success': True,
        'authToken': auth_token,
        'user': {
            'id': user.id,
            'email': user.email,
            'firstName': user.first_name,
            'lastName': user.last_name,
            'tokenBalance': user.token_balance
        }
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid email or password'}), 401

    login_user(user, remember=True)

    # Generate auth token for mobile/cross-origin support
    auth_token = secrets.token_urlsafe(32)
    auth_tokens[auth_token] = user.id

    return jsonify({
        'success': True,
        'authToken': auth_token,
        'user': {
            'id': user.id,
            'email': user.email,
            'firstName': user.first_name,
            'lastName': user.last_name,
            'profileImageUrl': user.profile_image_url,
            'tokenBalance': user.token_balance
        }
    })

@auth_bp.route('/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({'success': True})

@auth_bp.route('/user')
def get_current_user_route():
    user = get_authenticated_user()
    if user:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': user.id,
                'email': user.email,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'profileImageUrl': user.profile_image_url,
                'tokenBalance': user.token_balance
            }
        })
    return jsonify({'authenticated': False, 'user': None})
