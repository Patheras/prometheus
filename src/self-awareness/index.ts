/**
 * Self-Awareness Module
 * 
 * Provides Prometheus with knowledge of its own capabilities,
 * allowing it to explain what it can do and discover new features.
 */

export {
  CapabilityRegistry,
  getCapabilityRegistry,
  resetCapabilityRegistry,
  type Capability,
} from './capability-registry.js';
