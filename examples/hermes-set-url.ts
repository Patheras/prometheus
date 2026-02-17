/**
 * Set Hermes Beta URL
 */

import Database from 'better-sqlite3';

const db = new Database('./data/prometheus.db');

// Set the hermes-beta URL for General category
db.prepare(`
  UPDATE gemini_tabs 
  SET url = ? 
  WHERE category = ?
`).run('https://gemini.google.com/app/e42a7b4ccc3cb9cf', 'General');

console.log('✅ URL set for General category!');
console.log('🏛️  Hermes will now use the hermes-beta tab!');

db.close();
