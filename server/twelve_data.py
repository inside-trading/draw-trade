"""
Twelve Data API Integration Service

This module handles fetching price data from the Twelve Data API and caching it
in our database to reduce API calls and enable eventual independence from external
data sources.

API Documentation: https://twelvedata.com/docs
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import requests

from db import db
from models import PriceData

logger = logging.getLogger(__name__)

TWELVE_DATA_API_KEY = os.environ.get('TWELVE_DATA_API_KEY')
TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com'

# Map our internal intervals to Twelve Data intervals
INTERVAL_MAP = {
    '1m': '1min',
    '5m': '5min',
    '15m': '15min',
    '30m': '30min',
    '1h': '1h',
    '4h': '4h',
    '1d': '1day',
    '1wk': '1week',
    '1mo': '1month',
}

# How long cached data is considered fresh (before we fetch new data)
CACHE_FRESHNESS = {
    '1min': timedelta(minutes=1),
    '5min': timedelta(minutes=5),
    '15min': timedelta(minutes=15),
    '30min': timedelta(minutes=30),
    '1h': timedelta(hours=1),
    '4h': timedelta(hours=4),
    '1day': timedelta(hours=6),  # Refresh daily data every 6 hours
    '1week': timedelta(days=1),
    '1month': timedelta(days=7),
}

# Symbol format conversion for Twelve Data
# Twelve Data uses different formats for some assets
def convert_symbol_for_twelve_data(symbol: str) -> str:
    """Convert our symbol format to Twelve Data format."""
    # Crypto: BTC-USD -> BTC/USD
    if '-USD' in symbol:
        return symbol.replace('-USD', '/USD')
    # Futures: GC=F -> XAU/USD (Gold), SI=F -> XAG/USD (Silver)
    if symbol == 'GC=F':
        return 'XAU/USD'
    if symbol == 'SI=F':
        return 'XAG/USD'
    # Stocks remain the same
    return symbol


def convert_symbol_from_twelve_data(symbol: str) -> str:
    """Convert Twelve Data symbol format back to our format."""
    if '/USD' in symbol:
        # Check if it's a precious metal
        if symbol == 'XAU/USD':
            return 'GC=F'
        if symbol == 'XAG/USD':
            return 'SI=F'
        # Regular crypto
        return symbol.replace('/USD', '-USD')
    return symbol


def get_twelve_data_interval(interval: str) -> str:
    """Convert our interval format to Twelve Data format."""
    return INTERVAL_MAP.get(interval, interval)


def fetch_from_twelve_data(symbol: str, interval: str, outputsize: int = 100) -> Optional[List[Dict[str, Any]]]:
    """
    Fetch price data from Twelve Data API.

    Args:
        symbol: The trading symbol (e.g., 'AAPL', 'BTC-USD')
        interval: Time interval (e.g., '1m', '5m', '1h', '1d')
        outputsize: Number of data points to fetch (max 5000 for API plan)

    Returns:
        List of price data dictionaries or None if fetch failed
    """
    if not TWELVE_DATA_API_KEY:
        logger.warning("TWELVE_DATA_API_KEY not configured")
        return None

    td_symbol = convert_symbol_for_twelve_data(symbol)
    td_interval = get_twelve_data_interval(interval)

    url = f"{TWELVE_DATA_BASE_URL}/time_series"
    params = {
        'symbol': td_symbol,
        'interval': td_interval,
        'outputsize': outputsize,
        'apikey': TWELVE_DATA_API_KEY,
    }

    try:
        logger.info(f"Fetching from Twelve Data: {td_symbol} @ {td_interval}")
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()

        data = response.json()

        # Check for API errors
        if data.get('status') == 'error':
            logger.error(f"Twelve Data API error: {data.get('message')}")
            return None

        if 'values' not in data:
            logger.error(f"Unexpected response format: {data}")
            return None

        # Parse the values - they come in reverse chronological order
        values = data['values']
        prices = []

        for item in values:
            try:
                prices.append({
                    'timestamp': item['datetime'],
                    'open': float(item['open']),
                    'high': float(item['high']),
                    'low': float(item['low']),
                    'close': float(item['close']),
                    'volume': int(item.get('volume', 0)) if item.get('volume') else None,
                })
            except (KeyError, ValueError) as e:
                logger.warning(f"Error parsing price item: {e}")
                continue

        # Reverse to get chronological order
        prices.reverse()

        logger.info(f"Fetched {len(prices)} price points from Twelve Data")
        return prices

    except requests.RequestException as e:
        logger.error(f"Request to Twelve Data failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Error fetching from Twelve Data: {e}")
        return None


def store_price_data(symbol: str, interval: str, prices: List[Dict[str, Any]]) -> int:
    """
    Store price data in the database.

    Args:
        symbol: The trading symbol
        interval: Time interval
        prices: List of price data dictionaries

    Returns:
        Number of records stored
    """
    td_interval = get_twelve_data_interval(interval)
    stored_count = 0

    for price in prices:
        try:
            # Parse timestamp - Twelve Data format: "2024-01-15 09:30:00"
            timestamp_str = price['timestamp']
            try:
                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d')

            # Check if this data point already exists
            existing = PriceData.query.filter_by(
                symbol=symbol,
                interval=td_interval,
                timestamp=timestamp
            ).first()

            if existing:
                # Update existing record
                existing.open = price['open']
                existing.high = price['high']
                existing.low = price['low']
                existing.close = price['close']
                existing.volume = price.get('volume')
                existing.fetched_at = datetime.utcnow()
            else:
                # Create new record
                price_data = PriceData(
                    symbol=symbol,
                    interval=td_interval,
                    timestamp=timestamp,
                    open=price['open'],
                    high=price['high'],
                    low=price['low'],
                    close=price['close'],
                    volume=price.get('volume'),
                )
                db.session.add(price_data)

            stored_count += 1

        except Exception as e:
            logger.warning(f"Error storing price data: {e}")
            continue

    try:
        db.session.commit()
        logger.info(f"Stored/updated {stored_count} price records for {symbol}")
    except Exception as e:
        logger.error(f"Error committing price data: {e}")
        db.session.rollback()
        return 0

    return stored_count


def get_cached_prices(symbol: str, interval: str, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Get price data from our database cache.

    Args:
        symbol: The trading symbol
        interval: Time interval
        limit: Maximum number of records to return

    Returns:
        List of price data dictionaries
    """
    td_interval = get_twelve_data_interval(interval)

    price_records = PriceData.query.filter_by(
        symbol=symbol,
        interval=td_interval
    ).order_by(PriceData.timestamp.desc()).limit(limit).all()

    # Reverse to get chronological order
    price_records.reverse()

    prices = []
    for record in price_records:
        prices.append({
            'timestamp': record.timestamp.isoformat(),
            'open': record.open,
            'high': record.high,
            'low': record.low,
            'close': record.close,
            'volume': record.volume,
        })

    return prices


def is_cache_fresh(symbol: str, interval: str) -> bool:
    """
    Check if our cached data is fresh enough.

    Args:
        symbol: The trading symbol
        interval: Time interval

    Returns:
        True if cache is fresh, False if we should refresh
    """
    td_interval = get_twelve_data_interval(interval)

    # Get the most recent record
    latest = PriceData.query.filter_by(
        symbol=symbol,
        interval=td_interval
    ).order_by(PriceData.fetched_at.desc()).first()

    if not latest:
        return False

    freshness_duration = CACHE_FRESHNESS.get(td_interval, timedelta(hours=1))
    age = datetime.utcnow() - latest.fetched_at

    return age < freshness_duration


def get_prices_with_cache(symbol: str, interval: str, outputsize: int = 100) -> Dict[str, Any]:
    """
    Get price data, using cache when fresh and fetching from Twelve Data when needed.

    This is the main function to use for getting price data. It:
    1. Checks if we have fresh cached data
    2. If not, fetches from Twelve Data and stores in cache
    3. Returns the price data

    Args:
        symbol: The trading symbol
        interval: Time interval
        outputsize: Number of data points to fetch

    Returns:
        Dictionary with prices and metadata
    """
    # Check if cache is fresh
    if is_cache_fresh(symbol, interval):
        logger.info(f"Using cached data for {symbol} @ {interval}")
        prices = get_cached_prices(symbol, interval, outputsize)
        source = 'cache'
    else:
        # Try to fetch from Twelve Data
        fetched_prices = fetch_from_twelve_data(symbol, interval, outputsize)

        if fetched_prices:
            # Store in cache
            store_price_data(symbol, interval, fetched_prices)
            prices = get_cached_prices(symbol, interval, outputsize)
            source = 'twelve_data'
        else:
            # Fall back to cache even if stale
            prices = get_cached_prices(symbol, interval, outputsize)
            source = 'cache_stale' if prices else None

    if not prices:
        return {
            'prices': [],
            'error': 'No price data available',
            'source': None
        }

    closes = [p['close'] for p in prices]

    return {
        'prices': prices,
        'minPrice': min(closes),
        'maxPrice': max(closes),
        'lastPrice': closes[-1] if closes else 0,
        'lastTimestamp': prices[-1]['timestamp'] if prices else None,
        'source': source,
        'count': len(prices)
    }


def cleanup_old_data(days_to_keep: int = 30) -> int:
    """
    Clean up old price data to manage database size.

    Args:
        days_to_keep: Number of days of data to keep

    Returns:
        Number of records deleted
    """
    cutoff = datetime.utcnow() - timedelta(days=days_to_keep)

    try:
        deleted = PriceData.query.filter(
            PriceData.timestamp < cutoff
        ).delete()

        db.session.commit()
        logger.info(f"Cleaned up {deleted} old price records")
        return deleted
    except Exception as e:
        logger.error(f"Error cleaning up old data: {e}")
        db.session.rollback()
        return 0
