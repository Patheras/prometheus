/**
 * Evolution API - Self-improvement and promotion management
 */

import { Request, Response } from 'express'
import { DevProdManager } from '../evolution/dev-prod-manager.js'
import { SelfAnalyzer } from '../evolution/self-analyzer.js'

// Global instances (will be initialized in index.ts)
let devProdManager: DevProdManager | null = null
let selfAnalyzer: SelfAnalyzer | null = null

/**
 * Initialize evolution system with DevProdManager and SelfAnalyzer
 */
export function initializeEvolutionSystem(
  manager: DevProdManager,
  analyzer: SelfAnalyzer
): void {
  devProdManager = manager
  selfAnalyzer = analyzer
  console.log('[Evolution] System initialized')
}

/**
 * Get DevProdManager instance
 */
function getDevProdManager(): DevProdManager {
  if (!devProdManager) {
    throw new Error('DevProdManager not initialized. Call initializeEvolutionSystem first.')
  }
  return devProdManager
}

/**
 * Get SelfAnalyzer instance
 */
function getSelfAnalyzer(): SelfAnalyzer {
  if (!selfAnalyzer) {
    throw new Error('SelfAnalyzer not initialized. Call initializeEvolutionSystem first.')
  }
  return selfAnalyzer
}

/**
 * Get evolution statistics
 */
export function handleGetEvolutionStats(_req: Request, res: Response) {
  try {
    const manager = getDevProdManager()
    const analyzer = getSelfAnalyzer()
    
    // Get promotion statistics
    const promotionStats = manager.getStatistics()
    
    // Get self-analysis metrics
    let analysisMetrics
    let lastAnalysisTime = 0
    try {
      const lastAnalysis = analyzer.getLastAnalysis()
      analysisMetrics = lastAnalysis.metrics
      lastAnalysisTime = lastAnalysis.timestamp
    } catch (error) {
      // No analysis run yet, use defaults
      analysisMetrics = {
        totalFiles: 0,
        totalLines: 0,
        averageComplexity: 0,
        testCoverage: 0,
        qualityScore: 0,
      }
    }
    
    // Calculate success rate
    const totalPromotions = promotionStats.deployed + promotionStats.rolledBack
    const successRate = totalPromotions > 0
      ? Math.round((promotionStats.deployed / totalPromotions) * 100)
      : 0
    
    const stats = {
      improvements: promotionStats.deployed,
      pending: promotionStats.pending,
      successRate,
      lastAnalysis: lastAnalysisTime,
      metrics: {
        codeQuality: Math.round(analysisMetrics.qualityScore),
        codeQualityChange: 0, // TODO: Calculate from history
        performance: 92, // TODO: Get from real metrics
        performanceChange: 0,
        testCoverage: Math.round(analysisMetrics.testCoverage),
        testCoverageChange: 0,
      },
      patterns: [
        { name: 'Caching Strategy', uses: 8, success: 100 },
        { name: 'Error Handling', uses: 12, success: 92 },
        { name: 'Memory Optimization', uses: 5, success: 100 },
        { name: 'Query Optimization', uses: 7, success: 86 },
      ],
    }

    res.json(stats)
  } catch (error) {
    console.error('Get evolution stats error:', error)
    res.status(500).json({
      error: 'Failed to get evolution stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Get pending promotions
 */
export function handleGetPendingPromotions(_req: Request, res: Response) {
  try {
    const manager = getDevProdManager()
    const pending = manager.getPendingPromotions()
    res.json({ promotions: pending })
  } catch (error) {
    console.error('Get pending promotions error:', error)
    res.status(500).json({
      error: 'Failed to get pending promotions',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Get recent improvements
 */
export function handleGetRecentImprovements(_req: Request, res: Response) {
  try {
    const manager = getDevProdManager()
    
    // Get all promotions and filter deployed ones
    const allPromotions = Array.from((manager as any).promotionRequests.values())
    const deployed = allPromotions
      .filter((p: any) => p.status === 'deployed')
      .sort((a: any, b: any) => (b.deployedAt || 0) - (a.deployedAt || 0))
      .slice(0, 10)
    
    const recent = deployed.map((p: any) => ({
      title: p.title,
      impact: p.impactAssessment.risk,
      result: p.impactAssessment.benefits[0] || 'Improvement applied',
      time: p.deployedAt || p.createdAt,
    }))

    res.json({ improvements: recent })
  } catch (error) {
    console.error('Get recent improvements error:', error)
    res.status(500).json({
      error: 'Failed to get recent improvements',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Approve promotion
 */
export async function handleApprovePromotion(req: Request, res: Response): Promise<any> {
  try {
    const { promotionId } = req.params
    const { approvedBy } = req.body

    if (!approvedBy) {
      return res.status(400).json({
        error: 'Missing required field: approvedBy',
      })
    }

    const manager = getDevProdManager()
    await manager.approvePromotion(promotionId as string, approvedBy)

    res.json({
      success: true,
      message: 'Promotion approved successfully',
    })
  } catch (error) {
    console.error('Approve promotion error:', error)
    res.status(500).json({
      error: 'Failed to approve promotion',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Reject promotion
 */
export async function handleRejectPromotion(req: Request, res: Response): Promise<any> {
  try {
    const { promotionId } = req.params
    const { rejectedBy, reason } = req.body

    if (!rejectedBy || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: rejectedBy, reason',
      })
    }

    const manager = getDevProdManager()
    await manager.rejectPromotion(promotionId as string, rejectedBy, reason)

    res.json({
      success: true,
      message: 'Promotion rejected successfully',
    })
  } catch (error) {
    console.error('Reject promotion error:', error)
    res.status(500).json({
      error: 'Failed to reject promotion',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Run self-analysis
 */
export async function handleRunSelfAnalysis(_req: Request, res: Response): Promise<void> {
  try {
    const analyzer = getSelfAnalyzer()
    
    console.log('[Evolution] Starting self-analysis...')
    
    // Run analysis and wait for results
    const result = await analyzer.runAnalysis()
    
    console.log('[Evolution] Self-analysis complete:', {
      issues: result.issues.length,
      debt: result.debt.length,
      improvements: result.improvements.length,
      qualityScore: result.metrics.qualityScore,
    })

    res.json({
      success: true,
      message: 'Self-analysis completed',
      timestamp: result.timestamp,
      issues: result.issues,
      debt: result.debt,
      improvements: result.improvements,
      metrics: result.metrics,
    })
  } catch (error) {
    console.error('Run self-analysis error:', error)
    res.status(500).json({
      error: 'Failed to run self-analysis',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
