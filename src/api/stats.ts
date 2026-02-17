/**
 * Stats API - Memory, Runtime, Queue, and Tool Statistics
 */

import { getAllLanes, getLaneStatus } from '../queue/lane-queue.js';
import { Request, Response } from 'express';
import { getToolRegistry, getToolExecutionEngine } from '../tools/index.js';

/**
 * Get memory engine statistics
 */
export function getMemoryStats() {
  // TODO: Connect to actual memory engine when available
  // For now, return mock data
  return {
    totalChunks: 12450,
    indexedFiles: 342,
    conversations: 15,
    decisions: 28,
    patterns: 12,
    storageSize: '2.4 GB',
    lastIndexed: Date.now() - 120000, // 2 min ago
  };
}

/**
 * Get runtime executor statistics
 */
export function getRuntimeStats() {
  // TODO: Connect to actual runtime executor when available
  // For now, return mock data
  return {
    totalRequests: 1247,
    successfulRequests: 1198,
    failedRequests: 49,
    avgResponseTime: 2340, // ms
    totalTokens: 1847293,
    promptTokens: 892341,
    completionTokens: 954952,
    activeStreams: 0,
    lastRequest: Date.now() - 45000, // 45 sec ago
  };
}

/**
 * Get queue system statistics
 */
export function getQueueStats() {
  const lanes = getAllLanes();
  const laneStats = lanes.map(lane => getLaneStatus(lane));
  
  const totalQueued = laneStats.reduce((sum, lane) => sum + lane.queueDepth, 0);
  const totalActive = laneStats.reduce((sum, lane) => sum + lane.activeCount, 0);
  const avgWaitTime = laneStats.length > 0
    ? laneStats.reduce((sum, lane) => sum + lane.avgWaitTime, 0) / laneStats.length
    : 0;
  
  return {
    totalQueued,
    totalActive,
    avgWaitTime,
    lanes: laneStats,
  };
}

/**
 * Get tool execution statistics
 */
export function getToolStats() {
  try {
    const toolEngine = getToolExecutionEngine();
    const registry = getToolRegistry();
    const metrics = toolEngine.getMetrics();
    const circuitBreakerStatuses = toolEngine.getCircuitBreakerStatuses();

    // Calculate aggregate metrics
    const allMetrics = Object.values(metrics);
    const totalCalls = allMetrics.reduce((sum, m) => sum + m.totalCalls, 0);
    const totalSuccesses = allMetrics.reduce((sum, m) => sum + m.successfulCalls, 0);
    const totalFailures = allMetrics.reduce((sum, m) => sum + m.failedCalls, 0);
    const overallSuccessRate = totalCalls > 0 ? (totalSuccesses / totalCalls) * 100 : 0;

    // Calculate average latencies
    const avgLatencies = allMetrics
      .filter(m => m.totalCalls > 0)
      .map(m => m.avgLatency);
    const overallAvgLatency = avgLatencies.length > 0
      ? avgLatencies.reduce((sum, lat) => sum + lat, 0) / avgLatencies.length
      : 0;

    return {
      enabled: true,
      totalTools: registry.getAllSchemas().length,
      totalCalls,
      successfulCalls: totalSuccesses,
      failedCalls: totalFailures,
      successRate: Math.round(overallSuccessRate * 100) / 100,
      avgLatency: Math.round(overallAvgLatency),
      toolMetrics: metrics,
      circuitBreakers: circuitBreakerStatuses,
    };
  } catch (error) {
    console.error('Tool stats error:', error);
    return {
      enabled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all system statistics
 */
export function getAllStats() {
  const memory = getMemoryStats();
  const queue = getQueueStats();
  const tools = getToolStats();
  
  // Get repository count
  // TODO: Import from repositories API when circular dependency is resolved
  const repositories = 3; // Mock for now
  
  return {
    // Dashboard stats
    repositories,
    codeQuality: 87,
    activeTasks: queue.totalQueued + queue.totalActive,
    memoryUsage: memory.storageSize,
    chunksIndexed: memory.totalChunks,
    
    // Detailed stats
    memory,
    runtime: getRuntimeStats(),
    queue,
    tools,
    timestamp: Date.now(),
  };
}

/**
 * Express route handler for memory stats
 */
export function handleMemoryStatsRequest(_req: Request, res: Response) {
  try {
    const stats = getMemoryStats();
    res.json(stats);
  } catch (error) {
    console.error('Memory stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch memory stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Express route handler for runtime stats
 */
export function handleRuntimeStatsRequest(_req: Request, res: Response) {
  try {
    const stats = getRuntimeStats();
    res.json(stats);
  } catch (error) {
    console.error('Runtime stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch runtime stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Express route handler for queue stats
 */
export function handleQueueStatsRequest(_req: Request, res: Response) {
  try {
    const stats = getQueueStats();
    res.json(stats);
  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch queue stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Express route handler for tool stats
 */
export function handleToolStatsRequest(_req: Request, res: Response) {
  try {
    const stats = getToolStats();
    res.json(stats);
  } catch (error) {
    console.error('Tool stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch tool stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Express route handler for all stats
 */
export function handleAllStatsRequest(_req: Request, res: Response) {
  try {
    const stats = getAllStats();
    res.json(stats);
  } catch (error) {
    console.error('All stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
