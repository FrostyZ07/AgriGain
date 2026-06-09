#!/usr/bin/env node
/**
 * Integration Test Script for Agricultural Waste Management
 * 
 * This script tests the complete integration between frontend and backend
 * by simulating the user journey through API calls.
 */

const { spawn } = require('child_process');
const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';

class IntegrationTester {
  constructor() {
    this.results = [];
  }

  async log(message, status = 'info') {
    const timestamp = new Date().toISOString();
    const statusIcon = {
      'info': '💫',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️'
    }[status] || 'ℹ️';
    
    const logMessage = `${statusIcon} [${timestamp}] ${message}`;
    console.log(logMessage);
    
    this.results.push({ timestamp, status, message });
  }

  async testApiEndpoint(endpoint, method = 'GET', body = null) {
    try {
      const url = `${BACKEND_URL}${endpoint}`;
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const data = await response.json();

      if (response.ok) {
        await this.log(`${method} ${endpoint} - SUCCESS (${response.status})`, 'success');
        return { success: true, data, status: response.status };
      } else {
        await this.log(`${method} ${endpoint} - FAILED (${response.status}): ${data.detail || 'Unknown error'}`, 'error');
        return { success: false, error: data, status: response.status };
      }
    } catch (error) {
      await this.log(`${method} ${endpoint} - NETWORK ERROR: ${error.message}`, 'error');
      return { success: false, error: error.message, networkError: true };
    }
  }

  async checkBackendHealth() {
    await this.log('Testing backend health...', 'info');
    const result = await this.testApiEndpoint('/health');
    
    if (result.success) {
      const { services, status } = result.data;
      await this.log(`Backend status: ${status}`, status === 'healthy' ? 'success' : 'warning');
      
      for (const [service, serviceStatus] of Object.entries(services)) {
        const isHealthy = serviceStatus.includes('connected') || serviceStatus.includes('loaded') || serviceStatus.includes('initialized');
        await this.log(`  ${service}: ${serviceStatus}`, isHealthy ? 'success' : 'warning');
      }
    }
    
    return result.success;
  }

  async testQuantificationEndpoint() {
    await this.log('Testing quantification info endpoint...', 'info');
    const result = await this.testApiEndpoint('/quantification/info');
    
    if (result.success) {
      const { total_models, available_waste_types, available_units } = result.data;
      await this.log(`Found ${total_models} quantification models`, 'success');
      await this.log(`Waste types: ${available_waste_types.length} types`, 'success');
      await this.log(`Units: ${available_units.length} units`, 'success');
    }
    
    return result;
  }

  async testWasteLogging() {
    await this.log('Testing waste logging endpoint...', 'info');
    
    const testWasteData = {
      userId: `test_user_${Date.now()}`,
      waste_type: 'rice_husks',
      unit_name: 'sacks',
      quantity: 10,
      notes: 'Integration test data'
    };

    const result = await this.testApiEndpoint('/log_waste', 'POST', testWasteData);
    
    if (result.success) {
      const { waste_log_id, estimated_kg, success } = result.data;
      await this.log(`Waste logged successfully: ${waste_log_id}`, 'success');
      await this.log(`Estimated weight: ${estimated_kg} kg`, 'success');
      return { ...result, waste_log_id, userId: testWasteData.userId };
    }
    
    return result;
  }

  async testOpportunities(userId, wasteLogId) {
    if (!userId || !wasteLogId) {
      await this.log('Skipping opportunities test - no valid waste log', 'warning');
      return { success: false, skipped: true };
    }

    await this.log('Testing opportunities generation...', 'info');
    
    const opportunitiesData = {
      userId,
      waste_log_id: wasteLogId
    };

    const result = await this.testApiEndpoint('/get_opportunities', 'POST', opportunitiesData);
    
    if (result.success) {
      const { sources_used, processing_time_ms, queries_generated } = result.data;
      await this.log(`Opportunities generated successfully`, 'success');
      await this.log(`  Sources used: ${sources_used}`, 'info');
      await this.log(`  Processing time: ${processing_time_ms}ms`, 'info');
      await this.log(`  Queries generated: ${queries_generated}`, 'info');
    }
    
    return result;
  }

  async testGuides() {
    await this.log('Testing guides endpoints...', 'info');
    
    // Test guides list
    const guidesResult = await this.testApiEndpoint('/guides');
    if (guidesResult.success) {
      const { total_guides, guides } = guidesResult.data;
      await this.log(`Found ${total_guides} guides`, 'success');
      
      // Test individual guide
      if (guides && guides.length > 0) {
        const firstGuideId = guides[0].guide_id;
        if (firstGuideId) {
          const guideResult = await this.testApiEndpoint(`/get_how_to_guide/${firstGuideId}`);
          if (guideResult.success) {
            await this.log(`Guide "${guideResult.data.title}" retrieved successfully`, 'success');
          }
        }
      }
    }
    
    return guidesResult;
  }

  async checkFrontendAvailability() {
    try {
      await this.log('Checking frontend availability...', 'info');
      const response = await fetch(FRONTEND_URL);
      
      if (response.ok) {
        await this.log(`Frontend accessible at ${FRONTEND_URL}`, 'success');
        return true;
      } else {
        await this.log(`Frontend returned ${response.status}`, 'warning');
        return false;
      }
    } catch (error) {
      await this.log(`Frontend not accessible: ${error.message}`, 'warning');
      await this.log('Make sure to run: npm run dev', 'info');
      return false;
    }
  }

  async runFullIntegrationTest() {
    console.log('🚀 Starting Agricultural Waste Management Integration Test');
    console.log('=' .repeat(60));

    // Test backend endpoints
    const backendHealthy = await this.checkBackendHealth();
    
    if (!backendHealthy) {
      await this.log('Backend is not healthy - stopping tests', 'error');
      return this.generateReport();
    }

    // Test all endpoints
    await this.testQuantificationEndpoint();
    await this.testGuides();
    
    // Test the complete user flow
    const wasteLogResult = await this.testWasteLogging();
    
    if (wasteLogResult.success) {
      await this.testOpportunities(wasteLogResult.userId, wasteLogResult.waste_log_id);
    }

    // Check frontend
    await this.checkFrontendAvailability();

    return this.generateReport();
  }

  generateReport() {
    console.log('\n📊 INTEGRATION TEST REPORT');
    console.log('=' .repeat(60));

    const summary = {
      total: this.results.length,
      success: this.results.filter(r => r.status === 'success').length,
      errors: this.results.filter(r => r.status === 'error').length,
      warnings: this.results.filter(r => r.status === 'warning').length,
    };

    console.log(`Total tests: ${summary.total}`);
    console.log(`✅ Successful: ${summary.success}`);
    console.log(`❌ Errors: ${summary.errors}`);
    console.log(`⚠️  Warnings: ${summary.warnings}`);

    const successRate = ((summary.success / summary.total) * 100).toFixed(1);
    console.log(`\nSuccess Rate: ${successRate}%`);

    if (summary.errors === 0) {
      console.log('\n🎉 All integration tests passed!');
      console.log('✅ Backend is working correctly');
      console.log('✅ API endpoints are functional');
      console.log('✅ End-to-end flow is operational');
    } else {
      console.log('\n⚠️  Some tests failed. Check the logs above for details.');
    }

    console.log('\n🚀 To start the application:');
    console.log('Backend:  cd backend && uvicorn main:app --reload');
    console.log('Frontend: cd agri-gain && npm run dev');
    
    return {
      success: summary.errors === 0,
      summary,
      results: this.results
    };
  }
}

// Main execution
async function main() {
  // Check if node-fetch is available
  try {
    require('node-fetch');
  } catch (error) {
    console.log('❌ node-fetch is required for this test script');
    console.log('Install with: npm install -g node-fetch');
    console.log('Or run: node -e "console.log(\'Using built-in fetch\')"');
    process.exit(1);
  }

  const tester = new IntegrationTester();
  const report = await tester.runFullIntegrationTest();

  // Exit with proper code
  process.exit(report.success ? 0 : 1);
}

// Handle script execution
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  });
}

module.exports = { IntegrationTester };