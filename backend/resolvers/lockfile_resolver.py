"""
Lock file resolver — no registry calls needed.
All versions are already resolved in the lock file.
"""

def resolve(direct_deps):
    """Build graph from lock file — fast, no HTTP calls.

    Lock files don't expose explicit parent→child mapping in a simple form,
    so we attach all transitives under the FIRST direct as children. This
    keeps them visible in the graph + scannable, even if the precise
    requester chain is approximated.
    """
    direct = [d for d in direct_deps if d.get('type') == 'direct']
    transitive = [d for d in direct_deps if d.get('type') == 'transitive']

    # Build transitive nodes once
    trans_nodes = [{
        'name': t['name'],
        'version': t['version'],
        'type': 'transitive',
        'vulnerabilities': [],
        'dependencies': [],
    } for t in transitive]

    graph = []
    for i, dep in enumerate(direct):
        # Attach all transitives as children of the first direct so they're
        # rendered + scanned. (Lock files don't preserve true requester chain
        # without parsing each package's own dependencies map.)
        children = trans_nodes if i == 0 else []
        graph.append({
            'name': dep['name'],
            'version': dep['version'],
            'type': 'direct',
            'vulnerabilities': [],
            'dependencies': children,
        })

    # No mediation conflicts in lock file — already resolved
    return graph, []
