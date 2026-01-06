#!/usr/bin/env python3
"""
Test Suite Generator
Automated tool to scaffold test files for source files.
"""

import os
import sys
import argparse
from pathlib import Path

BACKEND_TEMPLATE = """import { describe, it, expect, vi } from 'vitest';
import { %s } from './%s';

describe('%s', () => {
    it('should be defined', () => {
        expect(%s).toBeDefined();
    });
});
"""

FRONTEND_TEMPLATE = """import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import %s from './%s';

describe('%s', () => {
    it('renders without crashing', () => {
        // render(<%s />);
    });
});
"""

class TestSuiteGenerator:
    """Main class for test suite generator functionality"""
    
    def __init__(self, target_path: str, verbose: bool = False):
        self.target_path = Path(target_path).resolve()
        self.verbose = verbose
    
    def run(self):
        """Execute the main functionality"""
        print(f"🚀 Running {self.__class__.__name__}...")
        
        if not self.target_path.exists():
            print(f"❌ Error: File not found {self.target_path}")
            return

        if self.target_path.is_dir():
            print("❌ Error: Target must be a file, not a directory.")
            return

        test_file = self.target_path.parent / f"{self.target_path.stem}.test{self.target_path.suffix}"
        
        if test_file.exists():
            print(f"⚠️  Test already exists: {test_file}")
            return

        self.generate_test(self.target_path, test_file)
    
    def generate_test(self, src: Path, dest: Path):
        """Generate a test file based on the source file"""
        content = ""
        name = src.stem
        
        if 'backend' in str(src):
            content = BACKEND_TEMPLATE % (name, name, name, name)
        elif 'frontend' in str(src):
            # Try to guess if it's a component (starts with uppercase)
            if name[0].isupper():
                content = FRONTEND_TEMPLATE % (name, name, name, name)
            else:
                content = BACKEND_TEMPLATE % (name, name, name, name)
        else:
            content = BACKEND_TEMPLATE % (name, name, name, name)

        with open(dest, 'w') as f:
            f.write(content)
        
        print(f"✅ Created test: {dest}")

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Test Suite Generator")
    parser.add_argument('target', help='Source file to generate test for')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose output')
    
    args = parser.parse_args()
    
    generator = TestSuiteGenerator(args.target, verbose=args.verbose)
    generator.run()

if __name__ == '__main__':
    main()
