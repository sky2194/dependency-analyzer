#!/usr/bin/env python3
"""Test Maven parser and resolver"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from parsers.maven_parser import parse
from resolvers.maven_resolver import resolve

# Test pom.xml content
test_pom = """<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.example</groupId>
    <artifactId>my-app</artifactId>
    <version>1.0.0</version>
    
    <dependencies>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-core</artifactId>
            <version>5.3.30</version>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
            <version>2.7.0</version>
        </dependency>
    </dependencies>
</project>"""

print("Testing Maven parser...")
try:
    parsed = parse(test_pom)
    print(f"✓ Parser successful")
    print(f"  Project: {parsed['project_name']}")
    print(f"  Version: {parsed['project_version']}")
    print(f"  Dependencies: {len(parsed['deps'])}")
    for dep in parsed['deps']:
        print(f"    - {dep['name']}@{dep['version']} (pinned: {dep['pinned']})")
except Exception as e:
    print(f"✗ Parser failed: {e}")

print("\nTesting Maven resolver...")
try:
    graph_deps, conflicts = resolve(parsed['deps'], max_depth=2)
    print(f"✓ Resolver successful")
    print(f"  Graph nodes: {len(graph_deps)}")
    print(f"  Conflicts: {len(conflicts)}")
    
    # Count total packages
    def count_packages(deps):
        count = 0
        for dep in deps:
            count += 1
            count += count_packages(dep.get('dependencies', []))
        return count
    
    total = count_packages(graph_deps)
    print(f"  Total packages: {total}")
except Exception as e:
    print(f"✗ Resolver failed: {e}")

print("\nTest complete")
