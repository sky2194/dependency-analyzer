"""
conftest.py — shared fixtures for the backend test suite.

No fake CVE IDs, no synthetic OSV payloads, no hardcoded mock registry
responses are stored here.  All vulnerability assertions are made against
the live OSV API using real package/version pairs with documented CVEs.
"""
import os
import sys
import pytest

# Must be set before any app import so the scheduler and DB init are skipped.
os.environ['DISABLE_SCHEDULER'] = 'true'
os.environ.setdefault('DATABASE_URL', 'postgresql://test:badpass@localhost/nonexistent_test')

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture
def client():
    """Flask test client.  Resets the in-memory rate-limiter store between
    tests so rate-limit assertions do not bleed across test functions."""
    from app import app, _rate_limiter
    app.config['TESTING'] = True
    _rate_limiter._store.clear()
    with app.test_client() as c:
        yield c


@pytest.fixture(autouse=True)
def _reset_health_cache():
    """Reset the health-check DB cache so DB availability state does not
    bleed across tests."""
    import app as _app
    _app._health_db_cache.update(ts=0.0, ttl=0, value=(None, None, None, False))
    yield
