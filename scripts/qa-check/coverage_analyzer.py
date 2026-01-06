#!/usr/bin/env python3
"""
Coverage Analyzer
Automated tool to identify files without corresponding tests in the project.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Set

class CoverageAnalyzer:
    """Main class for coverage analyzer functionality"""
    
    def __init__(self, target_path: str, verbose: bool = False):
        self.root_path = Path(target_path).resolve()
        self.verbose = verbose
        self.results = {
            'summary': {},
            'untested_files': [],
            'tested_files': []
        }
        self.source_extensions = {'.js', '.jsx', '.ts', '.tsx'}
        self.exclude_dirs = {'node_modules', '.git', 'dist', 'build', 'public'}
    
    def run(self) -> Dict:
        """Execute the main functionality"""
        print(f"🚀 Running {self.__class__.__name__}...")
        print(f"📁 Root: {self.root_path}")
        
        try:
            self.analyze()
            self.generate_report()
            return self.results
            
        except Exception as e:
            print(f"❌ Error: {e}")
            sys.exit(1)
    
    def is_test_file(self, path: Path) -> bool:
        """Check if a file is a test file"""
        return (path.name.endswith('.test.js') or 
                path.name.endswith('.spec.js') or 
                path.name.endswith('.test.jsx') or 
                path.name.endswith('.spec.jsx') or
                '__tests__' in str(path))

    def get_test_name(self, path: Path) -> str:
        """Get the expected test name for a source file"""
        stem = path.stem
        return f"{stem}.test{path.suffix}"

    def analyze(self):
        """Scan directories for source files and matching tests"""
        if self.verbose:
            print("📊 Scanning project structure...")
        
        all_source_files: List[Path] = []
        all_test_files: Set[str] = set()

        for path in self.root_path.rglob('*'):
            if any(part in path.parts for part in self.exclude_dirs):
                continue
            
            if path.is_file():
                if self.is_test_file(path):
                    all_test_files.add(path.name)
                elif path.suffix in self.source_extensions:
                    all_source_files.append(path)

        for src in all_source_files:
            test_name = self.get_test_name(src)
            rel_path = src.relative_to(self.root_path)
            
            if test_name in all_test_files:
                self.results['tested_files'].append(str(rel_path))
            else:
                self.results['untested_files'].append(str(rel_path))

        total = len(all_source_files)
        untested = len(self.results['untested_files'])
        tested = len(self.results['tested_files'])
        
        self.results['summary'] = {
            'total_source_files': total,
            'tested_files': tested,
            'untested_files': untested,
            'coverage_percentage': (tested / total * 100) if total > 0 else 0
        }
    
    def generate_report(self):
        """Generate and display the report"""
        summary = self.results['summary']
        print("\n" + "="*50)
        print("📊 TEST COVERAGE ANALYSIS REPORT")
        print("="*50)
        print(f"Total Source Files: {summary['total_source_files']}")
        print(f"Tested Files:       {summary['tested_files']}")
        print(f"Untested Files:     {summary['untested_files']}")
        print(f"Coverage:           {summary['coverage_percentage']:.2f}%")
        print("="*50)
        
        if self.results['untested_files']:
            print("\nCritical Untested Files (first 10):")
            for f in self.results['untested_files'][:10]:
                print(f"  - {f}")
        print("="*50 + "\n")

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Coverage Analyzer")
    parser.add_argument('target', nargs='?', default='.', help='Root path to analyze')
    parser.add_argument('--verbose', '-v', action='store_true', help='Enable verbose output')
    parser.add_argument('--json', action='store_true', help='Output results as JSON')
    
    args = parser.parse_args()
    
    analyzer = CoverageAnalyzer(args.target, verbose=args.verbose)
    results = analyzer.run()
    
    if args.json:
        print(json.dumps(results, indent=2))

if __name__ == '__main__':
    main()
