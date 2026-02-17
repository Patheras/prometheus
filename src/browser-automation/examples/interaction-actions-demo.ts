/**
 * Interaction Actions Demo
 * 
 * This example demonstrates all interaction actions in the PlaywrightAdapter:
 * - click (with button and clickCount options)
 * - type (with delay option)
 * - fill
 * - hover
 * - select
 * 
 * Run this demo:
 * tsx src/browser-automation/examples/interaction-actions-demo.ts
 */

import { PlaywrightAdapter } from '../playwright-adapter.js';
import { chromium } from 'playwright';

async function demo() {
  console.log('Interaction Actions Demo\n');

  // Launch a browser
  console.log('1. Launching browser...');
  const browser = await chromium.launch({
    headless: false, // Show the browser window
  });

  const cdpEndpoint = browser.wsEndpoint();
  console.log(`   CDP Endpoint: ${cdpEndpoint}\n`);

  // Create and initialize the adapter
  console.log('2. Initializing PlaywrightAdapter...');
  const adapter = new PlaywrightAdapter();
  await adapter.initialize(cdpEndpoint);
  console.log('   ✓ Adapter initialized\n');

  try {
    // Test Click Action
    console.log('3. Testing click action...');
    await adapter.navigate('data:text/html,<button id="test-btn">Click Me</button><div id="result"></div><script>document.getElementById("test-btn").onclick = () => document.getElementById("result").textContent = "clicked";</script>');
    await adapter.click('#test-btn');
    let result = await adapter.evaluate('document.getElementById("result").textContent');
    console.log(`   ✓ Click result: "${result}"`);

    // Test Double Click
    console.log('\n4. Testing double click...');
    await adapter.navigate('data:text/html,<button id="test-btn">Double Click Me</button><div id="result"></div><script>document.getElementById("test-btn").ondblclick = () => document.getElementById("result").textContent = "double-clicked";</script>');
    await adapter.click('#test-btn', { clickCount: 2 });
    result = await adapter.evaluate('document.getElementById("result").textContent');
    console.log(`   ✓ Double click result: "${result}"`);

    // Test Right Click
    console.log('\n5. Testing right click...');
    await adapter.navigate('data:text/html,<button id="test-btn">Right Click Me</button><div id="result"></div><script>document.getElementById("test-btn").oncontextmenu = (e) => { e.preventDefault(); document.getElementById("result").textContent = "right-clicked"; };</script>');
    await adapter.click('#test-btn', { button: 'right' });
    result = await adapter.evaluate('document.getElementById("result").textContent');
    console.log(`   ✓ Right click result: "${result}"`);

    // Test Click with Delay
    console.log('\n6. Testing click with delay...');
    await adapter.navigate('data:text/html,<button id="test-btn">Click Me</button><div id="result"></div><script>document.getElementById("test-btn").onclick = () => document.getElementById("result").textContent = "clicked";</script>');
    const startTime = Date.now();
    await adapter.click('#test-btn', { delay: 100 });
    const elapsed = Date.now() - startTime;
    result = await adapter.evaluate('document.getElementById("result").textContent');
    console.log(`   ✓ Click with 100ms delay completed in ${elapsed}ms`);
    console.log(`   ✓ Result: "${result}"`);

    // Test Type Action
    console.log('\n7. Testing type action...');
    await adapter.navigate('data:text/html,<input id="test-input" type="text" placeholder="Type here">');
    await adapter.type('#test-input', 'Hello World');
    result = await adapter.evaluate('document.getElementById("test-input").value');
    console.log(`   ✓ Type result: "${result}"`);

    // Test Type with Delay
    console.log('\n8. Testing type with delay...');
    await adapter.navigate('data:text/html,<input id="test-input" type="text" placeholder="Type here">');
    const typeStartTime = Date.now();
    await adapter.type('#test-input', 'ABC', { delay: 50 });
    const typeElapsed = Date.now() - typeStartTime;
    result = await adapter.evaluate('document.getElementById("test-input").value');
    console.log(`   ✓ Type with 50ms delay completed in ${typeElapsed}ms`);
    console.log(`   ✓ Result: "${result}"`);

    // Test Fill Action
    console.log('\n9. Testing fill action...');
    await adapter.navigate('data:text/html,<input id="test-input" type="text" value="old value">');
    await adapter.fill('#test-input', 'new value');
    result = await adapter.evaluate('document.getElementById("test-input").value');
    console.log(`   ✓ Fill result: "${result}"`);

    // Test Hover Action
    console.log('\n10. Testing hover action...');
    await adapter.navigate('data:text/html,<button id="test-btn">Hover Me</button><div id="result"></div><script>document.getElementById("test-btn").onmouseenter = () => document.getElementById("result").textContent = "hovered";</script>');
    await adapter.hover('#test-btn');
    result = await adapter.evaluate('document.getElementById("result").textContent');
    console.log(`   ✓ Hover result: "${result}"`);

    // Test Select Action (single)
    console.log('\n11. Testing select action (single)...');
    await adapter.navigate('data:text/html,<select id="test-select"><option value="1">One</option><option value="2">Two</option><option value="3">Three</option></select>');
    await adapter.select('#test-select', ['2']);
    result = await adapter.evaluate('document.getElementById("test-select").value');
    console.log(`   ✓ Select result: "${result}"`);

    // Test Select Action (multiple)
    console.log('\n12. Testing select action (multiple)...');
    await adapter.navigate('data:text/html,<select id="test-select" multiple><option value="1">One</option><option value="2">Two</option><option value="3">Three</option></select>');
    await adapter.select('#test-select', ['1', '3']);
    result = await adapter.evaluate('Array.from(document.getElementById("test-select").selectedOptions).map(o => o.value)');
    console.log(`   ✓ Select multiple result: ${JSON.stringify(result)}`);

    // Test Timeout Handling
    console.log('\n13. Testing timeout handling...');
    try {
      await adapter.navigate('data:text/html,<div>No button here</div>');
      await adapter.click('#non-existent', { timeout: 1000 });
      console.log('   ✗ Should have thrown timeout error');
    } catch (error: any) {
      console.log(`   ✓ Timeout error caught: ${error.message.substring(0, 50)}...`);
    }

    console.log('\n✓ All interaction actions tested successfully!');
  } catch (error) {
    console.error('\n✗ Error during demo:', error);
  } finally {
    // Clean up
    console.log('\n14. Cleaning up...');
    await adapter.close();
    await browser.close();
    console.log('   ✓ Cleanup complete');
  }
}

// Run the demo
demo().catch(console.error);
