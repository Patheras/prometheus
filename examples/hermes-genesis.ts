/**
 * Hermes Genesis - Initialize All 20 Specialized Gemini Rooms
 * 
 * This script runs the Genesis initialization process to create and configure
 * all 20 specialized Gemini rooms (Gems) in the Olympus Arsenal.
 * 
 * USAGE:
 *   npm run genesis                    # Run with default settings
 *   tsx examples/hermes-genesis.ts     # Run directly with tsx
 * 
 * COMMAND-LINE OPTIONS:
 *   --headless              Run browser in headless mode (no visible window)
 *   --db <path>             Custom database path (default: ./data/prometheus.db)
 *   --profile <path>        Custom browser profile path (default: ./browser-data/olympus-hermes)
 * 
 * EXAMPLES:
 *   tsx examples/hermes-genesis.ts --headless
 *   tsx examples/hermes-genesis.ts --db ./custom/path.db
 *   tsx examples/hermes-genesis.ts --profile ./custom-profile --headless
 * 
 * WHAT IT DOES:
 *   1. Opens browser with persistent profile (maintains login session)
 *   2. Navigates to Gemini and verifies authentication
 *   3. Initializes all 20 rooms sequentially:
 *      - 6 Forge rooms (Image, Video, Deep Search, Canvas)
 *      - 14 Mind rooms (Marketing, Coding, DevOps, etc.)
 *   4. Sends soul-defining prompts to each room
 *   5. Captures and stores room URLs in database
 *   6. Generates summary report with success/failure counts
 * 
 * REQUIREMENTS:
 *   - Browser profile must have valid Gemini login session
 *   - Database must exist with proper schema (run migrations first)
 *   - Stable internet connection for Gemini API access
 * 
 * NOTE:
 *   The browser remains open after completion for manual inspection.
 *   Press Ctrl+C to exit when done.
 */

import { runGenesis, GenesisConfig } from '../src/olympus/hermes/hermes-genesis.js';

/**
 * Parse command-line arguments
 */
function parseArgs(): GenesisConfig {
  const args = process.argv.slice(2);
  
  const config: GenesisConfig = {
    databasePath: './data/prometheus.db',
    browserProfilePath: './browser-data/olympus-hermes',
    headless: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--headless':
        config.headless = true;
        break;
        
      case '--db':
        if (i + 1 < args.length) {
          config.databasePath = args[i + 1];
          i++;
        } else {
          console.error('Error: --db requires a path argument');
          process.exit(1);
        }
        break;
        
      case '--profile':
        if (i + 1 < args.length) {
          config.browserProfilePath = args[i + 1];
          i++;
        } else {
          console.error('Error: --profile requires a path argument');
          process.exit(1);
        }
        break;
        
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
        
      default:
        console.error(`Error: Unknown argument '${arg}'`);
        printUsage();
        process.exit(1);
    }
  }
  
  return config;
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Hermes Genesis - Initialize All 20 Specialized Gemini Rooms

USAGE:
  npm run genesis                    # Run with default settings
  tsx examples/hermes-genesis.ts     # Run directly with tsx

COMMAND-LINE OPTIONS:
  --headless              Run browser in headless mode (no visible window)
  --db <path>             Custom database path (default: ./data/prometheus.db)
  --profile <path>        Custom browser profile path (default: ./browser-data/olympus-hermes)
  --help, -h              Show this help message

EXAMPLES:
  tsx examples/hermes-genesis.ts --headless
  tsx examples/hermes-genesis.ts --db ./custom/path.db
  tsx examples/hermes-genesis.ts --profile ./custom-profile --headless

WHAT IT DOES:
  1. Opens browser with persistent profile (maintains login session)
  2. Navigates to Gemini and verifies authentication
  3. Initializes all 20 rooms sequentially:
     - 6 Forge rooms (Image, Video, Deep Search, Canvas)
     - 14 Mind rooms (Marketing, Coding, DevOps, etc.)
  4. Sends soul-defining prompts to each room
  5. Captures and stores room URLs in database
  6. Generates summary report with success/failure counts

REQUIREMENTS:
  - Browser profile must have valid Gemini login session
  - Database must exist with proper schema (run migrations first)
  - Stable internet connection for Gemini API access

NOTE:
  The browser remains open after completion for manual inspection.
  Press Ctrl+C to exit when done.
  `);
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Parse command-line arguments
    const config = parseArgs();
    
    // Display configuration
    console.log('Configuration:');
    console.log(`  Database:       ${config.databasePath}`);
    console.log(`  Browser Profile: ${config.browserProfilePath}`);
    console.log(`  Headless:       ${config.headless}`);
    console.log();
    
    // Run Genesis
    const summary = await runGenesis(config);
    
    // Keep process alive for browser inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error();
    console.error('❌ Genesis failed:', error);
    process.exit(1);
  }
}

main();
