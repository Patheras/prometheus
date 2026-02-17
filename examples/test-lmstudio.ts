/**
 * Test LM Studio Connection
 * 
 * Quick test to verify LM Studio is running and accessible
 */

async function testLMStudio() {
  console.log('🧪 Testing LM Studio connection...');
  console.log('='.repeat(60));
  
  const lmstudioUrl = 'http://localhost:1234';
  
  try {
    console.log(`📡 Connecting to ${lmstudioUrl}...`);
    
    const response = await fetch(`${lmstudioUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-r1-0528-qwen3-8b',
        messages: [
          {
            role: 'user',
            content: 'Hello! Just reply with "OK" to confirm you are working.'
          }
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status}`);
      console.error(await response.text());
      return;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';
    
    console.log('✅ LM Studio is working!');
    console.log('📝 Response:', reply);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
    console.log('\n💡 Make sure:');
    console.log('   1. LM Studio is running');
    console.log('   2. DeepSeek-R1 model is loaded');
    console.log('   3. Local server is enabled on port 1234');
  }
}

testLMStudio();
