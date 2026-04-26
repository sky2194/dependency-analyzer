"""
Lock file resolver — no registry calls needed.
All versions are already resolved in the lock file.
"""

def resolve(direct_deps):
    """Build graph directly from lock file — fast, no HTTP calls."""
    # Separate direct vs transitive
    direct = [d for d in direct_deps if d.get('type') == 'direct']
    transitive_map = {d['name']: d for d in direct_deps if d.get('type') == 'transitive'}

    graph = []
    for dep in direct:
        node = {
            'name': dep['name'], 'version': dep['version'],
            'type': 'direct', 'vulnerabilities': [],
            'dependencies': _find_children(dep['name'], transitive_map)
        }
        graph.append(node)

    # No mediation conflicts in lock file — already resolved
    return graph, []

def _find_children(parent_name, transitive_map):
    """Simplified — lock files don't explicitly map parent→child, return flat list."""
    return []
