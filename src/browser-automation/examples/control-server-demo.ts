/**
 * Control Server Demo
 * 
 * Demonstrates how to start and use the ControlServer with loopback-only binding.
 */

import { ControlServer } from '../control-server.js';

async function main() {
  console.log('=== Control Server Demo ===\n');

  // Create a new control server instance
  const server = new ControlServer();

  try {
    // Start the server on default port (18791)
    console.log('Starting control server on loopback address...');
    await server.start(18791);
    
    console.log(`✓ Server started successfully`);
    console.log(`  Address: ${server.getAddress()}`);
    console.log(`  Port: ${server.getPort()}`);
    console.log(`  Running: ${server.isRunning()}`);
    console.log();

    // Test the health check endpoint
    console.log('Testing health check endpoint...');
    const response = await fetch('http://127.0.0.1:18791/health');
    const health = await response.json();
    
    console.log('✓ Health check response:');
    console.log(`  Status: ${health.status}`);
    console.log(`  Uptime: ${health.uptime.toFixed(2)}s`);
    console.log(`  Server: ${health.server.host}:${health.server.port}`);
    console.log();

    // Test 404 handling
    console.log('Testing 404 handling...');
    const notFoundResponse = await fetch('http://127.0.0.1:18791/nonexistent');
    const notFoundData = await notFoundResponse.json();
    
    console.log('✓ 404 response:');
    console.log(`  Status: ${notFoundResponse.status}`);
    console.log(`  Error code: ${notFoundData.error.code}`);
    console.log(`  Message: ${notFoundData.error.message}`);
    console.log();

    // Wait a bit before stopping
    console.log('Server will run for 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Stop the server
    console.log('Stopping server...');
    await server.stop();
    console.log(`✓ Server stopped`);
    console.log(`  Running: ${server.isRunning()}`);

  } catch (error) {
    console.error('Error:', error);
    
    // Ensure cleanup
    if (server.isRunning()) {
      await server.stop();
    }
    
    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);
