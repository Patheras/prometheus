/**
 * Activity Feed API
 * 
 * Aggregates system events from various sources:
 * - Code analysis
 * - Promotions
 * - Repository changes
 * - Chat interactions
 */

import { Request, Response } from 'express';

export interface Activity {
  type: 'success' | 'warning' | 'info' | 'error';
  message: string;
  time: string; // Human-readable (e.g., "2 minutes ago")
  timestamp: number; // Unix timestamp
  entityType?: 'repository' | 'promotion' | 'analysis' | 'chat';
  entityId?: string;
}

export interface ActivityResponse {
  activities: Activity[];
}

// In-memory activity store (last 100 events)
// In production, this could be stored in database or Redis
const activityStore: Activity[] = [];
const MAX_ACTIVITIES = 100;

/**
 * Add an activity event to the store
 */
export function addActivity(activity: Omit<Activity, 'time'>): void {
  const timeAgo = formatTimeAgo(activity.timestamp);
  
  activityStore.unshift({
    ...activity,
    time: timeAgo,
  });
  
  // Keep only last MAX_ACTIVITIES
  if (activityStore.length > MAX_ACTIVITIES) {
    activityStore.splice(MAX_ACTIVITIES);
  }
}

/**
 * Format timestamp as "time ago" string
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Handle GET /api/activity
 * 
 * Returns recent activity events sorted by timestamp (newest first)
 */
export async function handleGetActivity(_req: Request, res: Response): Promise<void> {
  try {
    // Update time strings for all activities
    const activities = activityStore.map(activity => ({
      ...activity,
      time: formatTimeAgo(activity.timestamp),
    }));
    
    const response: ActivityResponse = {
      activities,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Failed to get activity:', error);
    res.status(500).json({
      error: 'Failed to fetch activity',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Initialize activity feed with some sample events
 * This would be replaced with real event tracking in production
 */
export function initializeActivityFeed(): void {
  // Add some initial activities
  addActivity({
    type: 'success',
    message: 'Prometheus system initialized successfully',
    timestamp: Date.now() - 5000,
    entityType: 'repository',
  });
  
  addActivity({
    type: 'info',
    message: 'Backend API server started on port 4242',
    timestamp: Date.now() - 3000,
  });
  
  console.log('[Activity] Activity feed initialized with', activityStore.length, 'events');
}
