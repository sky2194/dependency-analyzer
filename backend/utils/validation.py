import re

# Valid package name pattern: alphanumeric, dots, dashes, underscores, forward slashes, @ (for scoped packages)
PACKAGE_NAME_PATTERN = r'^[@a-zA-Z0-9._\-\/]+$'

# Valid version pattern: semver with optional operators
VERSION_PATTERN = r'^[~^<>=]*\d+(\.\d+){0,2}([\-+a-zA-Z0-9.]*)?$|^[*x]$|^latest$'

# Maven coordinate pattern
MAVEN_COORD_PATTERN = r'^[a-zA-Z0-9._\-]+$'

def validate_package_name(name):
    """
    Validate package name to prevent XSS and injection attacks.
    Rejects HTML, scripts, and special injection characters.
    """
    if not name or not isinstance(name, str):
        raise ValueError("Package name must be a non-empty string")
    
    # Check for obvious XSS attempts
    if any(char in name.lower() for char in ['<script', '</script>', 'javascript:', 'onerror', 'onload', 'onclick']):
        raise ValueError(f"Invalid package name '{name}': contains potentially malicious content")
    
    # Block path traversal
    if '..' in name or name.startswith('/'):
        raise ValueError(f"Invalid package name '{name}': path traversal not allowed")
    
    # Validate against allowed pattern
    if not re.match(PACKAGE_NAME_PATTERN, name):
        raise ValueError(f"Invalid package name '{name}': contains invalid characters. Only alphanumeric, dots, dashes, underscores, and forward slashes are allowed")
    
    return name

def validate_version(version):
    """
    Validate version string to prevent SQL injection and other attacks.
    Rejects SQL/meta characters and enforces semver-safe parsing.
    """
    if not version or not isinstance(version, str):
        raise ValueError("Version must be a non-empty string")
    
    # Check for SQL injection attempts
    if any(char in version.lower() for char in ['drop', 'delete', 'truncate', 'alter', 'exec', 'eval', ';', '--', '/*', '*/']):
        raise ValueError(f"Invalid version '{version}': contains potentially malicious content")
    
    # Prevent DoS with extremely long version strings
    if len(version) > 100:
        raise ValueError(f"Invalid version '{version}': version too long (max 100 characters)")
    
    # Validate against semver pattern
    if not re.match(VERSION_PATTERN, version.strip()):
        raise ValueError(f"Invalid version '{version}': must follow semver format (e.g., 1.0.0, ^1.0.0, ~1.0.0)")
    
    return version

def validate_maven_coordinate(value, field_name):
    """
    Validate Maven coordinates (groupId, artifactId) to prevent XML injection.
    """
    if not value or not isinstance(value, str):
        raise ValueError(f"{field_name} must be a non-empty string")
    
    # Block XML injection attempts
    if any(char in value for char in ['<', '>', '&', '"', "'"]):
        raise ValueError(f"Invalid {field_name} '{value}': contains XML metacharacters")
    
    # Validate against Maven coordinate pattern
    if not re.match(MAVEN_COORD_PATTERN, value):
        raise ValueError(f"Invalid {field_name} '{value}': must contain only alphanumeric characters, dots, dashes, and underscores")
    
    return value
