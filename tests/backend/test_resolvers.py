"""
Resolver tests — verifies dependency tree building and mediation logic.
Run: pytest tests/backend/test_resolvers.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend'))

import pytest
from resolvers.npm_resolver import resolve as npm_resolve, _resolve_conflicts

def test_npm_resolve_returns_tuple():
    deps = [{'name': 'express', 'version': '4.17.1', 'pinned': True, 'warning': None}]
    result = npm_resolve(deps)
    assert isinstance(result, tuple)
    assert len(result) == 2

def test_npm_resolve_graph_has_type():
    deps = [{'name': 'express', 'version': '4.17.1', 'pinned': True, 'warning': None}]
    graph, _ = npm_resolve(deps)
    assert graph[0]['type'] == 'direct'

def test_npm_mediation_detects_conflict():
    version_map = {
        'lodash': [
            {'version': '4.17.4', 'depth': 1, 'requester': 'root'},
            {'version': '4.17.21', 'depth': 3, 'requester': 'terser'},
        ]
    }
    conflicts = _resolve_conflicts(version_map)
    assert len(conflicts) == 1
    assert conflicts[0]['package'] == 'lodash'

def test_npm_mediation_nearest_depth_wins():
    version_map = {
        'qs': [
            {'version': '6.5.2', 'depth': 2, 'requester': 'express'},
            {'version': '6.7.0', 'depth': 3, 'requester': 'body-parser'},
        ]
    }
    conflicts = _resolve_conflicts(version_map)
    assert conflicts[0]['selected'] == '6.5.2'

def test_npm_no_conflict_for_same_version():
    version_map = {
        'lodash': [
            {'version': '4.17.21', 'depth': 1, 'requester': 'root'},
            {'version': '4.17.21', 'depth': 2, 'requester': 'express'},
        ]
    }
    conflicts = _resolve_conflicts(version_map)
    assert len(conflicts) == 0

def test_npm_empty_deps_returns_empty():
    graph, mediation = npm_resolve([])
    assert graph == []
    assert mediation == []
