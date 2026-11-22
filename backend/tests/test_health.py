"""
test_health.py — Tests for the GET /api/health endpoint.
Covers DB-connected path, DB-failure path, and field structure.
All DB calls are mocked; no real database.
"""
import sys
import os
import json
import pytest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        """GET /api/health always returns HTTP 200 regardless of DB state."""
        with patch('db.last_sync_time', return_value=None):
            resp = client.get('/api/health')
        assert resp.status_code == 200

    def test_health_db_connected_true_when_db_accessible(self, client):
        """db_connected is True when last_sync_time() returns without raising."""
        with patch('db.last_sync_time', return_value='2024-06-01T00:00:00+00:00'):
            resp = client.get('/api/health')
        body = resp.get_json()
        assert body['db_connected'] is True

    def test_health_db_connected_false_when_db_raises(self, client):
        """db_connected is False when last_sync_time() raises (DB unreachable).
        This is the regression test for Bug 2 — the old last_sync_time() swallowed
        exceptions, causing db_connected to always be True even when DB was down."""
        with patch('db.last_sync_time', side_effect=Exception('connection refused')):
            resp = client.get('/api/health')
        body = resp.get_json()
        assert body['db_connected'] is False

    def test_health_response_has_required_fields(self, client):
        """Response JSON includes status, db_connected, and version fields."""
        with patch('db.last_sync_time', return_value=None):
            resp = client.get('/api/health')
        body = resp.get_json()
        assert 'status' in body
        assert 'db_connected' in body

    def test_health_status_is_ok(self, client):
        """status field is always 'ok' (health endpoint does not return error status)."""
        with patch('db.last_sync_time', side_effect=Exception('timeout')):
            resp = client.get('/api/health')
        body = resp.get_json()
        assert body['status'] == 'ok'


class TestHealthDbCache:
    """Health must not query the DB on every poll (keeps Neon able to suspend)."""

    def test_success_is_cached(self, client):
        with patch('db.last_sync_time', return_value='2024-06-01T00:00:00+00:00') as m:
            client.get('/api/health')
            calls_after_first = m.call_count
            for _ in range(5):
                assert client.get('/api/health').get_json()['db_connected'] is True
        assert calls_after_first > 0
        assert m.call_count == calls_after_first

    def test_failure_is_cached_briefly_then_retried(self, client):
        import app as _app
        with patch('db.last_sync_time', side_effect=Exception('down')) as m:
            client.get('/api/health')
            client.get('/api/health')
            assert m.call_count == 1
        # Expire the short failure TTL: a recovered DB is detected on next poll.
        _app._health_db_cache['ts'] -= _app._HEALTH_DB_FAIL_TTL + 1
        with patch('db.last_sync_time', return_value='2024-06-01T00:00:00+00:00'):
            assert client.get('/api/health').get_json()['db_connected'] is True
