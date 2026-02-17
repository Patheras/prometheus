/**
 * Circuit Breaker
 * 
 * Implements circuit breaker pattern to prevent cascading failures.
 * When a tool fails repeatedly, the circuit breaker opens and rejects
 * subsequent calls until a cooldown period expires.
 */

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;  // Number of failures before opening
  cooldownPeriod: number;    // Milliseconds to wait before trying again
  successThreshold: number;  // Successes needed in half-open to close
}

export interface CircuitBreakerStatus {
  toolName: string;
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: number;
  nextRetryTime: number;
  successCount: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  cooldownPeriod: 60000, // 1 minute
  successThreshold: 2,
};

export class CircuitBreaker {
  private states: Map<string, CircuitBreakerStatus> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a tool call should be allowed
   * 
   * @param toolName Tool name
   * @returns True if call is allowed, false if circuit is open
   */
  allowCall(toolName: string): boolean {
    const status = this.getStatus(toolName);

    if (status.state === 'closed') {
      return true;
    }

    if (status.state === 'open') {
      // Check if cooldown period has expired
      if (Date.now() >= status.nextRetryTime) {
        // Transition to half-open
        this.transitionToHalfOpen(toolName);
        return true;
      }
      return false;
    }

    // half-open state - allow call to test if service recovered
    return true;
  }

  /**
   * Record a successful call
   * 
   * @param toolName Tool name
   */
  recordSuccess(toolName: string): void {
    const status = this.getStatus(toolName);

    if (status.state === 'half-open') {
      status.successCount++;
      
      // If enough successes, close the circuit
      if (status.successCount >= this.config.successThreshold) {
        this.transitionToClosed(toolName);
      }
    } else if (status.state === 'closed') {
      // Reset failure count on success
      status.failureCount = 0;
    }

    this.states.set(toolName, status);
  }

  /**
   * Record a failed call
   * 
   * @param toolName Tool name
   */
  recordFailure(toolName: string): void {
    const status = this.getStatus(toolName);
    
    status.failureCount++;
    status.lastFailureTime = Date.now();

    if (status.state === 'half-open') {
      // Failure in half-open state - reopen circuit
      this.transitionToOpen(toolName);
    } else if (status.state === 'closed') {
      // Check if threshold exceeded
      if (status.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen(toolName);
      }
    }

    this.states.set(toolName, status);
  }

  /**
   * Get circuit breaker status for a tool
   * 
   * @param toolName Tool name
   * @returns Circuit breaker status
   */
  getStatus(toolName: string): CircuitBreakerStatus {
    if (!this.states.has(toolName)) {
      this.states.set(toolName, {
        toolName,
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        nextRetryTime: 0,
        successCount: 0,
      });
    }
    return this.states.get(toolName)!;
  }

  /**
   * Get all circuit breaker statuses
   * 
   * @returns Map of tool names to statuses
   */
  getAllStatuses(): Map<string, CircuitBreakerStatus> {
    return new Map(this.states);
  }

  /**
   * Reset circuit breaker for a tool
   * 
   * @param toolName Tool name
   */
  reset(toolName: string): void {
    this.states.delete(toolName);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.states.clear();
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(toolName: string): void {
    const status = this.getStatus(toolName);
    status.state = 'closed';
    status.failureCount = 0;
    status.successCount = 0;
    status.lastFailureTime = 0;
    status.nextRetryTime = 0;
    this.states.set(toolName, status);
    
    console.log(`[CircuitBreaker] ${toolName}: CLOSED (recovered)`);
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(toolName: string): void {
    const status = this.getStatus(toolName);
    status.state = 'open';
    status.nextRetryTime = Date.now() + this.config.cooldownPeriod;
    status.successCount = 0;
    this.states.set(toolName, status);
    
    console.warn(
      `[CircuitBreaker] ${toolName}: OPEN (${status.failureCount} failures, retry at ${new Date(status.nextRetryTime).toISOString()})`
    );
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(toolName: string): void {
    const status = this.getStatus(toolName);
    status.state = 'half-open';
    status.successCount = 0;
    this.states.set(toolName, status);
    
    console.log(`[CircuitBreaker] ${toolName}: HALF-OPEN (testing recovery)`);
  }
}
