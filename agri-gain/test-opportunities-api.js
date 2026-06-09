// Test script to identify which API endpoint is causing the 503 error
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function testOpportunitiesEndpoints() {
  console.log('Testing Opportunities Page API calls...\n');
  
  // Test 1: Health check
  try {
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    console.log(`Health status: ${healthResponse.status}`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log(`✅ Health check passed - Status: ${health.status}`);
    } else {
      console.log('❌ Health check failed');
    }
  } catch (error) {
    console.error('❌ Health check error:', error.message);
  }

  // Test 2: Guides endpoint
  try {
    console.log('\n2. Testing /guides endpoint...');
    const guidesResponse = await fetch(`${API_BASE_URL}/guides`);
    console.log(`Guides status: ${guidesResponse.status}`);
    
    if (guidesResponse.ok) {
      const guides = await guidesResponse.json();
      console.log(`✅ Guides loaded - Total: ${guides.total_guides || 'unknown'}`);
      console.log(`   Available guides: ${guides.guides?.length || 0}`);
    } else {
      console.log('❌ Guides endpoint failed');
      const errorText = await guidesResponse.text();
      console.log(`Error: ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Guides endpoint error:', error.message);
  }

  // Test 3: Individual guide endpoint
  try {
    console.log('\n3. Testing individual guide endpoint...');
    const guideResponse = await fetch(`${API_BASE_URL}/get_how_to_guide/guide_001`);
    console.log(`Individual guide status: ${guideResponse.status}`);
    
    if (guideResponse.ok) {
      const guide = await guideResponse.json();
      console.log(`✅ Individual guide loaded - ${guide.title || 'Unknown title'}`);
    } else {
      console.log('❌ Individual guide failed');
      const errorText = await guideResponse.text();
      console.log(`Error: ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Individual guide error:', error.message);
  }

  // Test 4: Opportunities endpoint (without params)
  try {
    console.log('\n4. Testing opportunities endpoint...');
    const opportunitiesRequest = {
      userId: "test_user",
      waste_log_id: "test_log_id"
    };
    
    const opportunitiesResponse = await fetch(`${API_BASE_URL}/get_opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(opportunitiesRequest)
    });
    
    console.log(`Opportunities status: ${opportunitiesResponse.status}`);
    
    if (opportunitiesResponse.ok) {
      const opportunities = await opportunitiesResponse.json();
      console.log(`✅ Opportunities endpoint works`);
      console.log(`   Sources used: ${opportunities.sources_used || 0}`);
    } else {
      console.log('❌ Opportunities endpoint failed');
      const errorText = await opportunitiesResponse.text();
      console.log(`Error: ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Opportunities endpoint error:', error.message);
  }

  // Test 5: Check all available endpoints
  try {
    console.log('\n5. Testing root endpoint for available endpoints...');
    const rootResponse = await fetch(`${API_BASE_URL}/`);
    console.log(`Root status: ${rootResponse.status}`);
    
    if (rootResponse.ok) {
      const root = await rootResponse.json();
      console.log('✅ Available endpoints:', Object.keys(root.endpoints || {}));
    }
  } catch (error) {
    console.error('❌ Root endpoint error:', error.message);
  }
}

// Run the tests
testOpportunitiesEndpoints().catch(console.error);