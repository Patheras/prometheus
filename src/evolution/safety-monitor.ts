/**
 * Safety Monitor - Circuit Breakers for Self-Evolution
 * 
 * Prevents Prometheus from degrading itself through bad self-modifications.
 * Implements multiple safety mechanisms:
 * 1. Quality degradation detection
 * 2. Consecutive failure tracking
 * 3. Automatic rollback triggers
 * 4. Manual override controls
 * 5. Safety metrics dashboard
 */

import type { MemoryEngine } from '../memory';
import type { DevProdManager, PromotionRequest } from './dev-prod-manager';

export interface SafetyConfig {
  /** Maximum consecutive failures before circuit breaker trips */
  maxConsecutiveFailures: number;
  /** Minimum quality score (0-100) before triggering rollback */
  minQualityScore: number;
  /** Maximum quality degradation (percentage points) before alert */
  maxQualityDegradation: number;
  /** Enable automatic rollback on safety violations */
  autoRollback: boolean;
  /** Require manual approval for high-risk changes */
  requireManualApproval: boolean;
}

export interface SafetyMetrics {
  consecutiveFailures: number;
  currentQualityScore: number;
  previousQualityScore: number;
  qualityTrend: 'improving' | 'stable' | 'degrading';
  circuitBreakerStatus: 'closed' | 'open' | 'half-open';
  lastViolation?: SafetyViolation;
  totalViolations: number;
}

export interface SafetyViolation {
  type: 'quality_degradation' | 'consecutive_failures' | 'test_failures' | 'manual_override';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  promotionId?: string;
  autoRollback: boolean;
}

export interface SafetyCheckResult {
  safe: boolean;
  violations: SafetyViolation[];
  recommendations: string[];
}

/**
 * Safety Monitor
 * 
 * Monitors self-evolution process and prevents dangerous self-modifications.
 */
export class SafetyMonitor {
  private config: SafetyConfig;
  private consecutiveFailures = 0;
  private qualityHistory: number[] = [];
  private violations: SafetyViolation[] = [];
  private circuitBreakerStatus: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private memoryEngine: MemoryEngine,
    private devProdManager: DevProdManager,
    config?: Partial<SafetyConfig>
  ) {
    this.config = {
      maxConsecutiveFailures: 3,
      minQualityScore: 60,
      maxQualityDegradation: 10,
      autoRollback: true,
      requireManualApproval: true,
      ...config,
    };
  }

  /**
   * Check if a promotion is safe to deploy
   */
  async checkPromotionSafety(promotion: PromotionRequest): Promise<SafetyCheckResult> {
    const violations: SafetyViolation[] = [];
    const recommendations: string[] = [];

    // Check 1: Circuit breaker status
    if (this.circuitBreakerStatus === 'open') {
      violations.push({
        type: 'consecutive_failures',
        severity: 'critical',
        message: `Circuit breaker is OPEN. ${this.consecutiveFailures} consecutive failures detected.`,
        timestamp: Date.now(),
        promotionId: promotion.id,
        autoRollback: false,
      });
      recommendations.push('Fix underlying issues before attempting more promotions');
      recommendations.push('Review recent failure logs');
      recommendations.push('Consider manual intervention');
    }

    // Check 2: Test results
    if (!promotion.testResults.passed) {
      violations.push({
        type: 'test_failures',
        severity: 'critical',
        message: `${promotion.testResults.failedTests} test(s) failed`,
        timestamp: Date.now(),
        promotionId: promotion.id,
        autoRollback: false,
      });
      recommendations.push('All tests must pass before promotion');
    }

    // Check 3: Risk assessment
    if (promotion.impactAssessment.risk === 'high' && this.config.requireManualApproval) {
      violations.push({
        type: 'manual_override',
        severity: 'high',
        message: 'High-risk change requires manual approval',
        timestamp: Date.now(),
        promotionId: promotion.id,
        autoRollback: false,
      });
      recommendations.push('Carefully review impact assessment');
      recommendations.push('Ensure rollback plan is tested');
    }

    // Check 4: Recent failure rate
    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures - 1) {
      violations.push({
        type: 'consecutive_failures',
        severity: 'high',
        message: `${this.consecutiveFailures} consecutive failures. One more will trip circuit breaker.`,
        timestamp: Date.now(),
        promotionId: promotion.id,
        autoRollback: false,
      });
      recommendations.push('Investigate root cause of recent failures');
      recommendations.push('Consider pausing self-improvements');
    }

    const safe = violations.filter(v => v.severity === 'critical').length === 0;

    return {
      safe,
      violations,
      recommendations,
    };
  }

  /**
   * Record promotion success
   */
  async recordSuccess(_promotionId: string, qualityScore: number): Promise<void> {
    // Reset consecutive failures
    this.consecutiveFailures = 0;

    // Update quality history
    this.qualityHistory.push(qualityScore);
    if (this.qualityHistory.length > 10) {
      this.qualityHistory.shift();
    }

    // Update circuit breaker
    if (this.circuitBreakerStatus === 'half-open') {
      this.circuitBreakerStatus = 'closed';
      console.log('[Safety] Circuit breaker CLOSED after successful promotion');
    }

    // Store metrics
    await this.storeMetrics();
  }

  /**
   * Record promotion failure
   */
  async recordFailure(promotionId: string, reason: string, qualityScore?: number): Promise<void> {
    this.consecutiveFailures++;

    // Check if circuit breaker should trip
    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      await this.tripCircuitBreaker(promotionId, reason);
    }

    // Check quality degradation
    if (qualityScore !== undefined) {
      this.qualityHistory.push(qualityScore);
      if (this.qualityHistory.length > 10) {
        this.qualityHistory.shift();
      }

      await this.checkQualityDegradation(promotionId, qualityScore);
    }

    // Store metrics
    await this.storeMetrics();
  }

  /**
   * Trip circuit breaker
   */
  private async tripCircuitBreaker(promotionId: string, reason: string): Promise<void> {
    this.circuitBreakerStatus = 'open';

    const violation: SafetyViolation = {
      type: 'consecutive_failures',
      severity: 'critical',
      message: `Circuit breaker TRIPPED: ${this.consecutiveFailures} consecutive failures. Reason: ${reason}`,
      timestamp: Date.now(),
      promotionId,
      autoRollback: this.config.autoRollback,
    };

    this.violations.push(violation);

    console.error('[Safety] 🚨 CIRCUIT BREAKER TRIPPED 🚨');
    console.error(`[Safety] Consecutive failures: ${this.consecutiveFailures}`);
    console.error(`[Safety] Reason: ${reason}`);
    console.error(`[Safety] All self-improvements are now BLOCKED`);

    // Trigger automatic rollback if enabled
    if (this.config.autoRollback) {
      await this.triggerAutomaticRollback(promotionId, violation);
    }
  }

  /**
   * Check for quality degradation
   */
  private async checkQualityDegradation(promotionId: string, currentQuality: number): Promise<void> {
    if (this.qualityHistory.length < 2) return;

    const previousQuality = this.qualityHistory[this.qualityHistory.length - 2];
    const degradation = previousQuality ? previousQuality - currentQuality : 0;

    // Check if quality dropped below minimum
    if (currentQuality < this.config.minQualityScore) {
      const violation: SafetyViolation = {
        type: 'quality_degradation',
        severity: 'critical',
        message: `Quality score ${currentQuality} is below minimum ${this.config.minQualityScore}`,
        timestamp: Date.now(),
        promotionId,
        autoRollback: this.config.autoRollback,
      };

      this.violations.push(violation);

      console.error('[Safety] 🚨 QUALITY BELOW MINIMUM 🚨');
      console.error(`[Safety] Current: ${currentQuality}, Minimum: ${this.config.minQualityScore}`);

      if (this.config.autoRollback) {
        await this.triggerAutomaticRollback(promotionId, violation);
      }
    }

    // Check if quality degraded significantly
    if (degradation > this.config.maxQualityDegradation) {
      const violation: SafetyViolation = {
        type: 'quality_degradation',
        severity: 'high',
        message: `Quality degraded by ${degradation.toFixed(1)} points (${previousQuality} → ${currentQuality})`,
        timestamp: Date.now(),
        promotionId,
        autoRollback: this.config.autoRollback,
      };

      this.violations.push(violation);

      console.warn('[Safety] ⚠️  QUALITY DEGRADATION DETECTED ⚠️');
      console.warn(`[Safety] Degradation: ${degradation.toFixed(1)} points`);
      console.warn(`[Safety] Previous: ${previousQuality}, Current: ${currentQuality}`);

      if (this.config.autoRollback) {
        await this.triggerAutomaticRollback(promotionId, violation);
      }
    }
  }

  /**
   * Trigger automatic rollback
   */
  private async triggerAutomaticRollback(
    promotionId: string,
    violation: SafetyViolation
  ): Promise<void> {
    console.log('[Safety] 🔄 Triggering automatic rollback...');

    try {
      await this.devProdManager.rollbackPromotion(
        promotionId,
        'SafetyMonitor',
        `Automatic rollback: ${violation.message}`
      );

      console.log('[Safety] ✅ Automatic rollback completed');
    } catch (error) {
      console.error('[Safety] ❌ Automatic rollback failed:', error);
      console.error('[Safety] MANUAL INTERVENTION REQUIRED');
    }
  }

  /**
   * Reset circuit breaker (manual override)
   */
  async resetCircuitBreaker(reason: string): Promise<void> {
    console.log(`[Safety] Resetting circuit breaker: ${reason}`);

    this.circuitBreakerStatus = 'half-open';
    this.consecutiveFailures = 0;

    const violation: SafetyViolation = {
      type: 'manual_override',
      severity: 'low',
      message: `Circuit breaker manually reset: ${reason}`,
      timestamp: Date.now(),
      autoRollback: false,
    };

    this.violations.push(violation);

    await this.storeMetrics();
  }

  /**
   * Get current safety metrics
   */
  getMetrics(): SafetyMetrics {
    const currentQuality = this.qualityHistory[this.qualityHistory.length - 1] || 0;
    const previousQuality = this.qualityHistory[this.qualityHistory.length - 2] || 0;

    let qualityTrend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (currentQuality > previousQuality + 5) qualityTrend = 'improving';
    else if (currentQuality < previousQuality - 5) qualityTrend = 'degrading';

    return {
      consecutiveFailures: this.consecutiveFailures,
      currentQualityScore: currentQuality,
      previousQualityScore: previousQuality,
      qualityTrend,
      circuitBreakerStatus: this.circuitBreakerStatus,
      lastViolation: this.violations[this.violations.length - 1],
      totalViolations: this.violations.length,
    };
  }

  /**
   * Get violation history
   */
  getViolations(limit?: number): SafetyViolation[] {
    const violations = [...this.violations].reverse();
    return limit ? violations.slice(0, limit) : violations;
  }

  /**
   * Store metrics in memory engine
   */
  private async storeMetrics(): Promise<void> {
    try {
      const metrics = this.getMetrics();

      await this.memoryEngine.storeMetrics([
        {
          id: `safety-${Date.now()}`,
          timestamp: Date.now(),
          metric_type: 'safety',
          metric_name: 'consecutive_failures',
          value: metrics.consecutiveFailures,
          context: JSON.stringify({
            circuitBreakerStatus: metrics.circuitBreakerStatus,
            qualityScore: metrics.currentQualityScore,
          }),
        },
      ]);
    } catch (error) {
      console.warn('[Safety] Failed to store metrics:', error);
    }
  }
}
