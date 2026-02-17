/**
 * Olympus - Hermes (The Messenger)
 * 
 * Main export file for Hermes module
 * 
 * Hermes is the messenger agent that bridges Olympus with Gemini 3 Pro.
 * He uses browser automation to communicate with Gemini's web interface,
 * treating each Gemini tab as a "living database" with 1M context each.
 */

// Main classes
export { GeminiMessenger } from './gemini-messenger.js';
export { GeminiTabManager } from './gemini-tab-manager.js';
export { GeminiResponseParser } from './gemini-response-parser.js';
export { SessionManager } from './session-manager.js';

// Utilities
export * from './selectors.js';

// Types
export * from './types.js';

// Configuration
export * from './config.js';

/**
 * Hermes Module Version
 */
export const HERMES_VERSION = '0.1.0';

/**
 * Hermes Module Info
 */
export const HERMES_INFO = {
  name: 'Hermes',
  version: HERMES_VERSION,
  description: 'The Messenger - Browser agent for Gemini 3 Pro integration',
  mythology: 'Hermes, messenger of the gods, swift and cunning',
  capabilities: [
    'Send messages to Gemini 3 Pro',
    'Manage 20 categorized tabs (1M context each)',
    'Create and manage Gems (persistent memory)',
    'Snapshot-based browser automation (OpenClaw pattern)',
    'Ref-based actions for reliability',
    'Context preservation across conversations',
  ],
};

/**
 * Log Hermes initialization
 */
export function logHermesInit(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    🏛️  HERMES  🏛️                        ║
║              The Messenger of Olympus                     ║
║                                                           ║
║  Version: ${HERMES_VERSION}                                        ║
║  Status: Initializing...                                  ║
║                                                           ║
║  "Swift as the wind, cunning as the fox,                 ║
║   I carry messages between gods and mortals."            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
}
