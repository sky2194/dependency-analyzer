"""
Regression tests for parsers
Tests: npm, pypi, maven parsing correctness, malformed input handling
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parsers import npm_parser, pypi_parser, maven_parser
import unittest

class TestParsers(unittest.TestCase):
    
    def test_npm_parser_valid_input(self):
        """Test npm parser with valid package.json"""
        valid_json = '{"name":"test","version":"1.0.0","dependencies":{"express":"4.18.2"}}'
        result = npm_parser.parse(valid_json)
        
        self.assertEqual(result['project_name'], 'test')
        self.assertEqual(result['project_version'], '1.0.0')
        self.assertIn('express', [d['name'] for d in result['deps']])
    
    def test_npm_parser_malformed_input(self):
        """Test npm parser with malformed JSON"""
        malformed_json = '{invalid json}'
        with self.assertRaises(ValueError):
            npm_parser.parse(malformed_json)
    
    def test_npm_parser_empty_dependencies(self):
        """Test npm parser with no dependencies"""
        empty_json = '{"name":"test","version":"1.0.0"}'
        result = npm_parser.parse(empty_json)
        
        self.assertEqual(len(result['deps']), 0)
    
    def test_pypi_parser_valid_input(self):
        """Test PyPI parser with valid requirements.txt"""
        valid_reqs = 'requests==2.28.0\nflask>=2.0.0'
        result = pypi_parser.parse(valid_reqs)
        
        self.assertEqual(len(result['deps']), 2)
    
    def test_pypi_parser_malformed_input(self):
        """Test PyPI parser with malformed input"""
        malformed_reqs = ''
        with self.assertRaises(ValueError):
            pypi_parser.parse(malformed_reqs)
    
    def test_maven_parser_valid_input(self):
        """Test Maven parser with valid pom.xml"""
        valid_pom = '''<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <groupId>com.example</groupId>
  <artifactId>test</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>5.3.0</version>
    </dependency>
  </dependencies>
</project>'''
        result = maven_parser.parse(valid_pom)
        
        self.assertEqual(result['project_name'], 'com.example:test')
        self.assertIn('org.springframework:spring-core', [d['name'] for d in result['deps']])
    
    def test_maven_parser_malformed_input(self):
        """Test Maven parser with malformed XML"""
        malformed_xml = '<invalid><xml>'
        with self.assertRaises(ValueError):
            maven_parser.parse(malformed_xml)
    
    def test_maven_parser_xml_injection_prevention(self):
        """Test that XML injection is prevented"""
        injection_payload = '<?xml version="1.0"?><script>alert(1)</script>'
        with self.assertRaises(ValueError):
            maven_parser.parse(injection_payload)
    
    def test_package_name_validation(self):
        """Test that package names are validated"""
        from utils.validation import validate_package_name
        
        # Valid names
        self.assertTrue(validate_package_name('express'))
        self.assertTrue(validate_package_name('@babel/core'))
        self.assertTrue(validate_package_name('my-package'))
        
        # Invalid names
        with self.assertRaises(ValueError):
            validate_package_name('package;rm -rf')
        with self.assertRaises(ValueError):
            validate_package_name('$(whoami)')
    
    def test_version_validation(self):
        """Test that versions are validated"""
        from utils.validation import validate_version
        
        # Valid versions
        self.assertTrue(validate_version('1.0.0'))
        self.assertTrue(validate_version('^2.0.0'))
        self.assertTrue(validate_version('>=3.0.0'))
        
        # Invalid versions
        with self.assertRaises(ValueError):
            validate_version('version;rm -rf')
        # Very long versions should be rejected
        with self.assertRaises(ValueError):
            validate_version('1.0.0' * 50)

if __name__ == '__main__':
    unittest.main()
