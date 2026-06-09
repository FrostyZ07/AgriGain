#!/usr/bin/env python3
"""
RAG Evaluation Script for Agricultural Waste Backend

This script evaluates the quality of RAG-generated opportunities against
a 'golden set' of test queries. As specified in Phase 4.2 of devplan.md.

Features:
- Loads test queries from test_queries.csv
- Runs RAG pipeline on each test case
- Evaluates response quality using multiple metrics
- Generates comprehensive evaluation report
- Provides manual review interface for quality assessment

Usage:
    python evaluate_rag.py [--output-file results.json] [--interactive]
"""

import csv
import json
import logging
import time
import re
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
from pathlib import Path
import argparse
import statistics

# Import our modules
import chromadb
from sentence_transformers import SentenceTransformer
from rag_service import RAGService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RAGEvaluator:
    """Comprehensive RAG evaluation system"""
    
    def __init__(self, rag_service: RAGService):
        """Initialize with a RAG service instance"""
        self.rag_service = rag_service
        self.evaluation_results = []
        self.start_time = None
        
    def load_test_queries(self, csv_path: str = "test_queries.csv") -> List[Dict[str, Any]]:
        """Load test queries from CSV file"""
        test_queries = []
        
        try:
            with open(csv_path, 'r', newline='', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    # Convert total_kg to float
                    row['total_kg'] = float(row['total_kg'])
                    # Parse expected categories
                    row['expected_categories'] = [cat.strip() for cat in row['expected_categories'].split(',')]
                    test_queries.append(row)
            
            logger.info(f"Loaded {len(test_queries)} test queries from {csv_path}")
            return test_queries
            
        except FileNotFoundError:
            logger.error(f"Test queries file not found: {csv_path}")
            return []
        except Exception as e:
            logger.error(f"Error loading test queries: {e}")
            return []
    
    def extract_categories_from_response(self, response_text: str) -> Set[str]:
        """Extract mentioned categories from the RAG response"""
        found_categories = set()
        
        # Look for category indicators in the response
        category_indicators = {
            'on_farm_use': [
                'on-farm', 'on farm', 'direct use', 'composting', 'mulch', 'fodder', 
                'bedding', 'soil improvement', 'organic matter', 'farm use'
            ],
            'local_sale': [
                'local sale', 'sell locally', 'nearby buyers', 'local market', 
                'direct selling', 'local buyers', 'community sale', 'village market'
            ],
            'process_and_sell': [
                'process and sell', 'processing', 'value addition', 'manufacturing',
                'briquettes', 'pellets', 'biogas', 'charcoal', 'paper', 'packaging',
                'industrial processing', 'commercial processing'
            ]
        }
        
        response_lower = response_text.lower()
        
        for category, indicators in category_indicators.items():
            for indicator in indicators:
                if indicator in response_lower:
                    found_categories.add(category)
                    break
        
        return found_categories
    
    def calculate_category_accuracy(self, expected: List[str], found: Set[str]) -> Dict[str, float]:
        """Calculate precision, recall, and F1 score for category detection"""
        expected_set = set(expected)
        
        # True positives: categories that are both expected and found
        true_positives = len(expected_set.intersection(found))
        
        # False positives: categories found but not expected
        false_positives = len(found - expected_set)
        
        # False negatives: categories expected but not found
        false_negatives = len(expected_set - found)
        
        # Calculate metrics
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        return {
            'precision': precision,
            'recall': recall,
            'f1_score': f1_score,
            'true_positives': true_positives,
            'false_positives': false_positives,
            'false_negatives': false_negatives
        }
    
    def calculate_response_quality_metrics(self, response: Dict[str, Any], query: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate various quality metrics for the RAG response"""
        opportunities_text = response.get('opportunities_text', '')
        
        # Basic response metrics
        response_length = len(opportunities_text)
        word_count = len(opportunities_text.split())
        
        # Check if response contains expected waste type
        waste_type_mentioned = query['waste_type'].replace('_', ' ') in opportunities_text.lower()
        region_mentioned = query['region'] in opportunities_text.lower() if query['region'] != 'all' else True
        
        # Look for actionable content indicators
        actionable_indicators = [
            'step', 'process', 'method', 'contact', 'price', 'market', 'buyer',
            'equipment', 'material', 'technique', 'procedure', 'approach'
        ]
        actionable_score = sum(1 for indicator in actionable_indicators 
                              if indicator in opportunities_text.lower()) / len(actionable_indicators)
        
        # Check for safety considerations
        safety_mentioned = any(term in opportunities_text.lower() 
                             for term in ['safety', 'caution', 'warning', 'protective', 'hazard'])
        
        # Category extraction
        found_categories = self.extract_categories_from_response(opportunities_text)
        category_accuracy = self.calculate_category_accuracy(query['expected_categories'], found_categories)
        
        return {
            'response_length': response_length,
            'word_count': word_count,
            'waste_type_mentioned': waste_type_mentioned,
            'region_mentioned': region_mentioned,
            'actionable_score': actionable_score,
            'safety_mentioned': safety_mentioned,
            'found_categories': list(found_categories),
            'category_accuracy': category_accuracy,
            'sources_used': response.get('sources_used', 0),
            'processing_time_ms': response.get('processing_time_ms', 0),
            'context_length': response.get('context_length', 0)
        }
    
    def evaluate_single_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate a single test query"""
        logger.info(f"Evaluating Test ID {query['test_id']}: {query['waste_type']} ({query['total_kg']}kg) in {query['region']}")
        
        start_time = time.time()
        
        try:
            # Run RAG pipeline
            response = self.rag_service.get_grounded_opportunities(
                waste_type=query['waste_type'],
                total_kg=query['total_kg'],
                region=query['region']
            )
            
            # Calculate quality metrics
            quality_metrics = self.calculate_response_quality_metrics(response, query)
            
            # Compile evaluation result
            evaluation = {
                'test_id': query['test_id'],
                'query': query,
                'response': response,
                'quality_metrics': quality_metrics,
                'evaluation_time': time.time() - start_time,
                'timestamp': datetime.now().isoformat()
            }
            
            logger.info(f"  ✓ Categories found: {quality_metrics['found_categories']}")
            logger.info(f"  ✓ F1 Score: {quality_metrics['category_accuracy']['f1_score']:.2f}")
            logger.info(f"  ✓ Sources used: {quality_metrics['sources_used']}")
            
            return evaluation
            
        except Exception as e:
            logger.error(f"  ✗ Error evaluating query: {e}")
            
            return {
                'test_id': query['test_id'],
                'query': query,
                'response': None,
                'quality_metrics': None,
                'evaluation_time': time.time() - start_time,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def run_full_evaluation(self, test_queries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Run evaluation on all test queries"""
        logger.info(f"Starting evaluation of {len(test_queries)} test queries")
        self.start_time = time.time()
        
        self.evaluation_results = []
        
        for query in test_queries:
            result = self.evaluate_single_query(query)
            self.evaluation_results.append(result)
            
            # Brief pause between requests to avoid overwhelming the system
            time.sleep(0.5)
        
        logger.info(f"Evaluation completed in {time.time() - self.start_time:.2f} seconds")
        return self.evaluation_results
    
    def generate_summary_report(self) -> Dict[str, Any]:
        """Generate a summary report of all evaluations"""
        if not self.evaluation_results:
            return {"error": "No evaluation results available"}
        
        successful_evaluations = [r for r in self.evaluation_results if r.get('quality_metrics')]
        failed_evaluations = [r for r in self.evaluation_results if not r.get('quality_metrics')]
        
        if not successful_evaluations:
            return {"error": "No successful evaluations"}
        
        # Calculate aggregate metrics
        f1_scores = [r['quality_metrics']['category_accuracy']['f1_score'] for r in successful_evaluations]
        precision_scores = [r['quality_metrics']['category_accuracy']['precision'] for r in successful_evaluations]
        recall_scores = [r['quality_metrics']['category_accuracy']['recall'] for r in successful_evaluations]
        actionable_scores = [r['quality_metrics']['actionable_score'] for r in successful_evaluations]
        processing_times = [r['quality_metrics']['processing_time_ms'] for r in successful_evaluations]
        sources_used = [r['quality_metrics']['sources_used'] for r in successful_evaluations]
        
        # Waste type performance
        waste_type_performance = {}
        for result in successful_evaluations:
            waste_type = result['query']['waste_type']
            if waste_type not in waste_type_performance:
                waste_type_performance[waste_type] = []
            waste_type_performance[waste_type].append(result['quality_metrics']['category_accuracy']['f1_score'])
        
        waste_type_avg_f1 = {
            waste_type: statistics.mean(scores) 
            for waste_type, scores in waste_type_performance.items()
        }
        
        return {
            'evaluation_summary': {
                'total_queries': len(self.evaluation_results),
                'successful_evaluations': len(successful_evaluations),
                'failed_evaluations': len(failed_evaluations),
                'success_rate': len(successful_evaluations) / len(self.evaluation_results),
                'total_evaluation_time': time.time() - self.start_time if self.start_time else 0
            },
            'category_accuracy_metrics': {
                'avg_f1_score': statistics.mean(f1_scores),
                'avg_precision': statistics.mean(precision_scores),
                'avg_recall': statistics.mean(recall_scores),
                'f1_score_stdev': statistics.stdev(f1_scores) if len(f1_scores) > 1 else 0,
                'min_f1_score': min(f1_scores),
                'max_f1_score': max(f1_scores)
            },
            'response_quality_metrics': {
                'avg_actionable_score': statistics.mean(actionable_scores),
                'actionable_score_stdev': statistics.stdev(actionable_scores) if len(actionable_scores) > 1 else 0,
                'responses_with_safety': sum(1 for r in successful_evaluations 
                                           if r['quality_metrics']['safety_mentioned']),
                'waste_type_mention_rate': sum(1 for r in successful_evaluations 
                                             if r['quality_metrics']['waste_type_mentioned']) / len(successful_evaluations),
                'region_mention_rate': sum(1 for r in successful_evaluations 
                                         if r['quality_metrics']['region_mentioned']) / len(successful_evaluations)
            },
            'performance_metrics': {
                'avg_processing_time_ms': statistics.mean(processing_times),
                'max_processing_time_ms': max(processing_times),
                'min_processing_time_ms': min(processing_times),
                'avg_sources_used': statistics.mean(sources_used),
                'max_sources_used': max(sources_used),
                'min_sources_used': min(sources_used)
            },
            'waste_type_performance': waste_type_avg_f1,
            'failed_evaluations': [
                {'test_id': r['test_id'], 'error': r.get('error', 'Unknown error')}
                for r in failed_evaluations
            ]
        }
    
    def interactive_review(self):
        """Interactive manual review of evaluation results"""
        if not self.evaluation_results:
            print("No evaluation results available for review")
            return
        
        print("\n" + "="*60)
        print("INTERACTIVE RAG EVALUATION REVIEW")
        print("="*60)
        
        for i, result in enumerate(self.evaluation_results):
            if not result.get('quality_metrics'):
                continue
            
            query = result['query']
            response = result['response']
            metrics = result['quality_metrics']
            
            print(f"\n--- Test {result['test_id']}: {query['description']} ---")
            print(f"Query: {query['waste_type']} ({query['total_kg']}kg) in {query['region']}")
            print(f"Expected categories: {query['expected_categories']}")
            print(f"Found categories: {metrics['found_categories']}")
            print(f"F1 Score: {metrics['category_accuracy']['f1_score']:.2f}")
            print(f"Sources used: {metrics['sources_used']}")
            
            print(f"\nRAG Response ({len(response['opportunities_text'])} chars):")
            print("-" * 40)
            print(response['opportunities_text'][:500] + ("..." if len(response['opportunities_text']) > 500 else ""))
            print("-" * 40)
            
            user_input = input("\nPress Enter to continue, 'q' to quit, 's' to save this result: ")
            if user_input.lower() == 'q':
                break
            elif user_input.lower() == 's':
                filename = f"rag_eval_test_{result['test_id']}.json"
                with open(filename, 'w') as f:
                    json.dump(result, f, indent=2)
                print(f"Saved result to {filename}")


def initialize_rag_service() -> Optional[RAGService]:
    """Initialize RAG service for evaluation"""
    try:
        # Initialize ChromaDB
        chroma_client = chromadb.PersistentClient(path="chroma_db")
        collection = chroma_client.get_collection("agri_waste_knowledge")
        
        # Initialize embedding model
        embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Initialize RAG service (without Gemini for evaluation)
        rag_service = RAGService(
            chroma_collection=collection,
            embedding_model=embedding_model,
            gemini_api_key=None  # Use None for evaluation to test grounding only
        )
        
        logger.info("RAG service initialized successfully for evaluation")
        return rag_service
        
    except Exception as e:
        logger.error(f"Failed to initialize RAG service: {e}")
        return None


def main():
    """Main evaluation function"""
    parser = argparse.ArgumentParser(description="Evaluate RAG system with golden set")
    parser.add_argument('--output-file', '-o', default='rag_evaluation_results.json',
                       help='Output file for evaluation results')
    parser.add_argument('--test-file', '-t', default='test_queries.csv',
                       help='Input CSV file with test queries')
    parser.add_argument('--interactive', '-i', action='store_true',
                       help='Run interactive review after evaluation')
    parser.add_argument('--summary-only', '-s', action='store_true',
                       help='Only generate summary report')
    
    args = parser.parse_args()
    
    print("Agricultural Waste RAG Evaluation System")
    print("="*50)
    
    # Initialize RAG service
    rag_service = initialize_rag_service()
    if not rag_service:
        print("❌ Failed to initialize RAG service")
        return 1
    
    print("✅ RAG service initialized")
    
    # Initialize evaluator
    evaluator = RAGEvaluator(rag_service)
    
    # Load test queries
    test_queries = evaluator.load_test_queries(args.test_file)
    if not test_queries:
        print("❌ Failed to load test queries")
        return 1
    
    print(f"✅ Loaded {len(test_queries)} test queries")
    
    # Run evaluation
    if not args.summary_only:
        print("\n🔄 Running RAG evaluation...")
        results = evaluator.run_full_evaluation(test_queries)
        
        # Save detailed results
        with open(args.output_file, 'w') as f:
            json.dump({
                'evaluation_metadata': {
                    'timestamp': datetime.now().isoformat(),
                    'total_queries': len(test_queries),
                    'evaluator_config': {
                        'rag_service': 'no_gemini',  # Using without Gemini for pure evaluation
                        'test_file': args.test_file
                    }
                },
                'detailed_results': results
            }, f, indent=2)
        
        print(f"✅ Detailed results saved to {args.output_file}")
    
    # Generate summary report
    summary = evaluator.generate_summary_report()
    
    # Print summary
    print("\n📊 EVALUATION SUMMARY REPORT")
    print("="*50)
    
    if 'error' in summary:
        print(f"❌ Error: {summary['error']}")
        return 1
    
    eval_summary = summary['evaluation_summary']
    print(f"Total Queries: {eval_summary['total_queries']}")
    print(f"Successful: {eval_summary['successful_evaluations']}")
    print(f"Failed: {eval_summary['failed_evaluations']}")
    print(f"Success Rate: {eval_summary['success_rate']:.1%}")
    print(f"Total Time: {eval_summary['total_evaluation_time']:.2f}s")
    
    accuracy = summary['category_accuracy_metrics']
    print(f"\n📈 CATEGORY ACCURACY")
    print(f"Average F1 Score: {accuracy['avg_f1_score']:.3f}")
    print(f"Average Precision: {accuracy['avg_precision']:.3f}")
    print(f"Average Recall: {accuracy['avg_recall']:.3f}")
    print(f"F1 Score Range: {accuracy['min_f1_score']:.3f} - {accuracy['max_f1_score']:.3f}")
    
    quality = summary['response_quality_metrics']
    print(f"\n✅ RESPONSE QUALITY")
    print(f"Actionable Score: {quality['avg_actionable_score']:.3f}")
    print(f"Waste Type Mentioned: {quality['waste_type_mention_rate']:.1%}")
    print(f"Region Mentioned: {quality['region_mention_rate']:.1%}")
    print(f"Safety Considerations: {quality['responses_with_safety']} responses")
    
    performance = summary['performance_metrics']
    print(f"\n⚡ PERFORMANCE")
    print(f"Avg Processing Time: {performance['avg_processing_time_ms']:.0f}ms")
    print(f"Avg Sources Used: {performance['avg_sources_used']:.1f}")
    
    if summary['waste_type_performance']:
        print(f"\n🌾 PERFORMANCE BY WASTE TYPE")
        for waste_type, f1_score in summary['waste_type_performance'].items():
            print(f"{waste_type}: {f1_score:.3f}")
    
    # Save summary
    summary_file = args.output_file.replace('.json', '_summary.json')
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f"\n✅ Summary saved to {summary_file}")
    
    # Interactive review
    if args.interactive:
        evaluator.interactive_review()
    
    return 0


if __name__ == "__main__":
    exit(main())