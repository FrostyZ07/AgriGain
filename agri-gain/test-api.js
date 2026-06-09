// Simple API test script to debug the AI Insight issue
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function testAPI() {
  console.log('Testing API at:', API_BASE_URL);
  
  // Test 1: Health check
  try {
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    console.log('Health status:', healthResponse.status);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('Health data:', JSON.stringify(healthData, null, 2));
    } else {
      console.log('Health check failed:', await healthResponse.text());
    }
  } catch (error) {
    console.error('Health check error:', error.message);
  }

  // Test 2: AI Insight endpoint
  try {
    console.log('\n2. Testing AI Insight endpoint...');
    const aiRequest = {
      question: "How do I compost vegetable waste?",
      language: "english",
      waste_type: "vegetable_trimmings"
    };
    
    const aiResponse = await fetch(`${API_BASE_URL}/ai_insight`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aiRequest)
    });
    
    console.log('AI Insight status:', aiResponse.status);
    
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      console.log('AI Insight response:');
      console.log('- Question:', aiData.question);
      console.log('- Answer:', aiData.answer?.substring(0, 200) + '...');
      console.log('- Sources used:', aiData.sources_used);
      console.log('- Confidence:', aiData.confidence_score);
      console.log('- Fallback used:', aiData.fallback_used);
    } else {
      console.log('AI Insight failed:', await aiResponse.text());
    }
  } catch (error) {
    console.error('AI Insight error:', error.message);
  }

  // Test 3: Try different ports
  const portsToTry = [8000, 8001, 8002];
  console.log('\n3. Testing different ports...');
  
  for (const port of portsToTry) {
    try {
      const testUrl = `http://localhost:${port}/health`;
      const response = await fetch(testUrl, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        console.log(`✅ Backend found on port ${port}!`);
        const data = await response.json();
        console.log(`Services: ${Object.keys(data.services || {}).join(', ')}`);
      }
    } catch (error) {
      console.log(`❌ Port ${port}: ${error.message}`);
    }
  }
}

// Run the test
testAPI().catch(console.error);