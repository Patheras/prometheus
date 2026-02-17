/**
 * Browser Automation System Integration Demo
 * 
 * Demonstrates how to initialize and use the complete Browser Automation System.
 * Shows the integration of all components and tool registration.
 * 
 * Requirements: 10.12, 12.1, 12.2, 1.1
 */

import {
  initializeBrowserAutomation,
  shutdownBrowserAutomation,
  getBrowserAutomationSystem,
  quickStart,
} from '../init.js';
import { getToolRegistry } from '../../tools/tool-registry.js';

/**
 * Demo 1: Basic initialization and shutdown
 */
async function demo1_BasicInitialization() {
  console.log('\n=== Demo 1: Basic Initialization ===\n');

  try {
    // Initialize the system with custom configuration
    console.log('Initializing Browser Automation System...');
    const system = await initializeBrowserAutomation({
      controlServer: {
        enabled: true,
        port: 18791,
        host: '127.0.0.1',
      },
      browser: {
        headless: false,
        defaultProfile: 'openclaw',
        defaultTimeout: 30000,
        idleTimeout: 300000,
      },
    });

    console.log('✓ System initialized successfully');
    console.log(`  - Browser Manager: ${system.getBrowserManager().isStarted() ? 'Started' : 'Not started'}`);
    console.log(`  - Control Server: ${system.getControlServer().isRunning() ? 'Running' : 'Not running'}`);
    console.log(`  - Control Server Address: ${system.getControlServer().getAddress()}`);

    // Check tool registration
    const registry = getToolRegistry();
    const browserTools = registry.getToolsByCategory('browser');
    console.log(`  - Registered ${browserTools.length} browser tools`);

    // List some registered tools
    console.log('\nRegistered browser tools:');
    browserTools.slice(0, 5).forEach(tool => {
      console.log(`  - ${tool.schema.name}: ${tool.schema.description}`);
    });

    // Shutdown
    console.log('\nShutting down...');
    await shutdownBrowserAutomation();
    console.log('✓ System shutdown complete');

  } catch (error: any) {
    console.error('✗ Error:', error.message);
  }
}

/**
 * Demo 2: Quick start for development
 */
async function demo2_QuickStart() {
  console.log('\n=== Demo 2: Quick Start ===\n');

  try {
    // Quick start with development defaults
    console.log('Quick starting Browser Automation System...');
    const system = await quickStart();

    console.log('✓ System quick started successfully');
    
    // Get system information
    const config = system.getConfig();
    console.log('\nConfiguration:');
    console.log(`  - Control Server Port: ${config.controlServer.port}`);
    console.log(`  - Headless Mode: ${config.browser.headless}`);
    console.log(`  - Default Profile: ${config.browser.defaultProfile}`);
    console.log(`  - Idle Timeout: ${config.browser.idleTimeout}ms`);

    // List available profiles
    const profileManager = system.getProfileManager();
    const profiles = profileManager.listProfiles();
    console.log(`\nAvailable profiles: ${profiles.length}`);
    profiles.forEach(profile => {
      console.log(`  - ${profile.name} (${profile.type})`);
    });

    // Shutdown
    console.log('\nShutting down...');
    await shutdownBrowserAutomation();
    console.log('✓ System shutdown complete');

  } catch (error: any) {
    console.error('✗ Error:', error.message);
  }
}

/**
 * Demo 3: Tool registry integration
 */
async function demo3_ToolRegistryIntegration() {
  console.log('\n=== Demo 3: Tool Registry Integration ===\n');

  try {
    // Initialize system
    console.log('Initializing system...');
    await initializeBrowserAutomation({
      controlServer: { enabled: false },
      browser: { defaultProfile: '' }, // Don't launch browser
    });

    // Get tool registry
    const registry = getToolRegistry();
    console.log('✓ System initialized');

    // List all browser tools
    const browserTools = registry.getToolsByCategory('browser');
    console.log(`\nRegistered ${browserTools.length} browser tools:\n`);

    // Group tools by type
    const toolsByType: Record<string, string[]> = {
      navigation: [],
      interaction: [],
      capture: [],
      state: [],
      utility: [],
    };

    browserTools.forEach(tool => {
      const name = tool.schema.name;
      if (name.includes('navigate') || name.includes('back') || name.includes('forward') || name.includes('reload')) {
        toolsByType.navigation.push(name);
      } else if (name.includes('click') || name.includes('type') || name.includes('fill') || name.includes('hover') || name.includes('select')) {
        toolsByType.interaction.push(name);
      } else if (name.includes('screenshot') || name.includes('snapshot') || name.includes('pdf')) {
        toolsByType.capture.push(name);
      } else if (name.includes('cookie') || name.includes('storage')) {
        toolsByType.state.push(name);
      } else {
        toolsByType.utility.push(name);
      }
    });

    console.log('Navigation Tools:');
    toolsByType.navigation.forEach(name => console.log(`  - ${name}`));

    console.log('\nInteraction Tools:');
    toolsByType.interaction.forEach(name => console.log(`  - ${name}`));

    console.log('\nCapture Tools:');
    toolsByType.capture.forEach(name => console.log(`  - ${name}`));

    console.log('\nState Management Tools:');
    toolsByType.state.forEach(name => console.log(`  - ${name}`));

    console.log('\nUtility Tools:');
    toolsByType.utility.forEach(name => console.log(`  - ${name}`));

    // Show a sample tool schema
    const navigateTool = registry.getTool('browser_navigate');
    if (navigateTool) {
      console.log('\nSample Tool Schema (browser_navigate):');
      console.log(JSON.stringify(navigateTool.schema, null, 2));
    }

    // Shutdown
    console.log('\nShutting down...');
    await shutdownBrowserAutomation();
    console.log('✓ System shutdown complete');

  } catch (error: any) {
    console.error('✗ Error:', error.message);
  }
}

/**
 * Demo 4: Component access
 */
async function demo4_ComponentAccess() {
  console.log('\n=== Demo 4: Component Access ===\n');

  try {
    // Initialize system
    console.log('Initializing system...');
    const system = await initializeBrowserAutomation({
      controlServer: { enabled: false },
      browser: { defaultProfile: '' },
    });

    console.log('✓ System initialized');

    // Access components
    const browserManager = system.getBrowserManager();
    const controlServer = system.getControlServer();
    const profileManager = system.getProfileManager();

    console.log('\nComponent Status:');
    console.log(`  - Browser Manager: ${browserManager.isStarted() ? 'Started' : 'Not started'}`);
    console.log(`  - Control Server: ${controlServer.isRunning() ? 'Running' : 'Not running'}`);
    console.log(`  - Profile Manager: ${profileManager.listProfiles().length} profiles available`);

    // List browsers
    const browsers = browserManager.listBrowsers();
    console.log(`  - Active Browsers: ${browsers.length}`);

    // Get current profile
    const currentProfile = browserManager.getCurrentProfile();
    if (currentProfile) {
      console.log(`  - Current Profile: ${currentProfile.name}`);
    } else {
      console.log('  - Current Profile: None');
    }

    // Shutdown
    console.log('\nShutting down...');
    await shutdownBrowserAutomation();
    console.log('✓ System shutdown complete');

  } catch (error: any) {
    console.error('✗ Error:', error.message);
  }
}

/**
 * Main function - run all demos
 */
async function main() {
  console.log('Browser Automation System Integration Demo');
  console.log('==========================================');

  // Run demos sequentially
  await demo1_BasicInitialization();
  await demo2_QuickStart();
  await demo3_ToolRegistryIntegration();
  await demo4_ComponentAccess();

  console.log('\n=== All demos complete ===\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export {
  demo1_BasicInitialization,
  demo2_QuickStart,
  demo3_ToolRegistryIntegration,
  demo4_ComponentAccess,
};

