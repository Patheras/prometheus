/**
 * Geolocation Override Demo
 * 
 * Demonstrates setting and clearing geolocation override using StateManager.
 * This example shows how to override the browser's geolocation to test
 * location-based features.
 */

import { CDPClient } from '../cdp-client.js';
import { StateManager } from '../state-manager.js';
import chromeLauncher from 'chrome-launcher';

async function demo() {
  console.log('=== Geolocation Override Demo ===\n');

  // Launch Chrome with remote debugging
  console.log('Launching Chrome...');
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
  });

  const cdpEndpoint = `http://localhost:${chrome.port}`;
  console.log(`Chrome launched on port ${chrome.port}\n`);

  // Create CDP client and StateManager
  const cdpClient = new CDPClient();
  const stateManager = new StateManager(cdpClient);

  try {
    // Connect to Chrome
    console.log('Connecting to Chrome via CDP...');
    await cdpClient.connect(cdpEndpoint);
    console.log('Connected!\n');

    // Set geolocation to San Francisco
    console.log('Setting geolocation to San Francisco (37.7749, -122.4194)...');
    await stateManager.setGeolocation({
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 50,
    });
    console.log('Geolocation set successfully!\n');

    // Navigate to a page that uses geolocation
    console.log('Navigating to a test page...');
    const targets = await cdpClient.sendCommand('Target.getTargets');
    const pageTarget = targets.targetInfos.find((t: any) => t.type === 'page');
    
    if (pageTarget) {
      await cdpClient.sendCommand('Target.activateTarget', {
        targetId: pageTarget.targetId,
      });
      
      // Navigate to a simple HTML page that displays geolocation
      await cdpClient.sendCommand('Page.navigate', {
        url: 'data:text/html,<html><body><h1>Geolocation Test</h1><div id="location"></div><script>navigator.geolocation.getCurrentPosition(pos => { document.getElementById("location").innerText = `Lat: ${pos.coords.latitude}, Lon: ${pos.coords.longitude}, Accuracy: ${pos.coords.accuracy}m`; });</script></body></html>',
      });
      
      console.log('Page loaded with geolocation override active\n');
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Clear geolocation override
    console.log('Clearing geolocation override...');
    await stateManager.clearGeolocation();
    console.log('Geolocation override cleared!\n');

    // Set geolocation to London
    console.log('Setting geolocation to London (51.5074, -0.1278)...');
    await stateManager.setGeolocation({
      latitude: 51.5074,
      longitude: -0.1278,
    });
    console.log('Geolocation set to London (with default accuracy of 100m)\n');

    // Export state to verify geolocation is included
    console.log('Exporting browser state...');
    const state = await stateManager.exportState();
    console.log('Exported state:', JSON.stringify(state, null, 2));
    console.log('\nNote: Geolocation is included in the exported state\n');

    console.log('Demo completed successfully!');
  } catch (error) {
    console.error('Error during demo:', error);
  } finally {
    // Cleanup
    console.log('\nCleaning up...');
    await cdpClient.disconnect();
    await chrome.kill();
    console.log('Cleanup complete');
  }
}

// Run the demo
demo().catch(console.error);
