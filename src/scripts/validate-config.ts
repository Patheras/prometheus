#!/usr/bin/env node
/**
 * Configuration Validation Script
 * 
 * Runs EnvValidator and StartupValidator to check system configuration.
 * Exits with code 0 if all checks pass, code 1 if any fail.
 * 
 * Requirements: 4.1, 4.2, 4.3, 10.4
 */

import { config } from 'dotenv';
import { EnvValidator } from '../config/env-validator';
import { StartupValidator } from '../startup/validator';

// Load environment variables
config();

async function main() {
  console.log('🔍 Validating Prometheus Configuration...\n');

  let hasErrors = false;

  // Run Environment Validation
  console.log('📋 Environment Variables:');
  const envValidator = new EnvValidator();
  const envResult = envValidator.validate();

  if (envResult.valid) {
    console.log('  ✅ All required environment variables are present and valid\n');
  } else {
    console.log('  ❌ Environment validation failed:\n');
    for (const error of envResult.errors) {
      console.log(`     • ${error.message}`);
    }
    console.log();
    hasErrors = true;
  }

  if (envResult.warnings.length > 0) {
    console.log('  ⚠️  Warnings:');
    for (const warning of envResult.warnings) {
      console.log(`     • ${warning.message}`);
    }
    console.log();
  }

  // Run Startup Validation
  console.log('🚀 Startup Checks:');
  const startupValidator = new StartupValidator();
  const startupChecks = await startupValidator.validateAll();

  // Display results
  console.log(`  ${startupChecks.environment ? '✅' : '❌'} Environment Configuration`);
  console.log(`  ${startupChecks.database ? '✅' : '❌'} Database Connectivity`);
  console.log(`  ${startupChecks.ports ? '✅' : '❌'} Port Availability (4242, 3042)`);
  console.log(`  ${startupChecks.dependencies ? '✅' : '❌'} Dependencies`);
  console.log();

  // Check for failures
  if (!startupChecks.environment || !startupChecks.database || !startupChecks.ports || !startupChecks.dependencies) {
    hasErrors = true;
  }

  // Display summary
  if (hasErrors) {
    console.log('❌ Configuration validation failed. Please fix the issues above.\n');
    process.exit(1);
  } else {
    console.log('✅ All configuration checks passed! System is ready to start.\n');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('❌ Validation script error:', error.message);
  process.exit(1);
});
