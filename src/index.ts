/**
 * Prometheus Meta-Agent System
 *
 * A self-improving meta-agent system that acts as a Technical Product Owner,
 * Architect, Developer, and Analyst. It manages, analyzes, and evolves software
 * projects through data-driven decision-making and continuous self-improvement.
 *
 * @module prometheus
 */

import 'dotenv/config';
import express from 'express';
import * as path from 'path';
import { EnvValidator } from './config/env-validator.js';
import { StartupValidator } from './startup/validator.js';
import { createCodeQualityAnalyzer } from './analysis/code-quality-analyzer.js';
import { createIssueRanker } from './analysis/issue-ranker.js';
import { createDebtDetector } from './analysis/debt-detector.js';
import {
  getAllRepositories,
  getRepositoryById,
  createRepository,
  updateRepository,
  deleteRepository,
} from './api/repositories.js';
import {
  getConversationHistory,
  getAllConversations,
  deleteConversation,
} from './api/chat.js';
import { handleChatRequestWithTools } from './api/chat-with-tools.js';
import {
  handleMemoryStatsRequest,
  handleRuntimeStatsRequest,
  handleQueueStatsRequest,
  handleToolStatsRequest,
  handleAllStatsRequest,
} from './api/stats.js';
import {
  handleGetFiles,
  handleGetFileContent,
} from './api/workspace.js';
import {
  handleGetEvolutionStats,
  handleGetPendingPromotions,
  handleGetRecentImprovements,
  handleApprovePromotion,
  handleRejectPromotion,
  handleRunSelfAnalysis,
  initializeEvolutionSystem,
} from './api/evolution.js';
import {
  handleGetActivity,
  initializeActivityFeed,
} from './api/activity.js';
import { DevProdManager } from './evolution/dev-prod-manager.js';
import { SelfAnalyzer } from './evolution/self-analyzer.js';
import { RepositoryManager } from './integrations/repository-manager.js';
import { MemoryEngine } from './memory/engine.js';
import { PrometheusDatabase } from './memory/database.js';

const app = express();
const PORT = process.env['PORT'] || 4242;

// ============================================================================
// Startup Validation
// ============================================================================

console.log('🔍 Validating startup configuration...');

// Validate environment variables
const envValidator = new EnvValidator();
const envResult = envValidator.validate();

if (!envResult.valid) {
  console.error('');
  console.error('❌ Environment Configuration Errors:');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  
  for (const error of envResult.errors) {
    console.error(`  Component: Environment Configuration`);
    console.error(`  Variable: ${error.variable}`);
    console.error(`  Error: ${error.message}`);
    console.error(`  Required: ${error.required ? 'Yes' : 'No'}`);
    console.error('');
    console.error(`  Recovery Steps:`);
    console.error(`    1. Check your .env file in the project root`);
    console.error(`    2. Ensure ${error.variable} is set correctly`);
    console.error(`    3. Refer to .env.example for the correct format`);
    console.error(`    4. Refer to ENVIRONMENT.md for detailed documentation`);
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
  }
  
  console.error('❌ Startup aborted due to configuration errors.');
  console.error('   Please fix the errors above and try again.');
  console.error('');
  process.exit(1);
}

console.log('✅ Environment configuration validated successfully');

// Validate system readiness
console.log('🔍 Validating system readiness...');

const startupValidator = new StartupValidator();
const checks = await startupValidator.validateAll();

const failedChecks: string[] = [];
if (!checks.environment) failedChecks.push('Environment Configuration');
if (!checks.database) failedChecks.push('Database Connectivity');
if (!checks.ports) failedChecks.push('Port Availability');
if (!checks.dependencies) failedChecks.push('Dependencies');

if (failedChecks.length > 0) {
  console.error('');
  console.error('❌ System Readiness Check Failed:');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  
  for (const check of failedChecks) {
    console.error(`  Component: ${check}`);
    console.error(`  Status: Failed`);
    console.error('');
    
    // Provide specific recovery steps based on the failed check
    if (check === 'Environment Configuration') {
      console.error(`  Recovery Steps:`);
      console.error(`    1. Review your .env file configuration`);
      console.error(`    2. Ensure all required variables are set`);
      console.error(`    3. Check variable formats (URLs, ports, paths)`);
      console.error(`    4. Refer to ENVIRONMENT.md for details`);
    } else if (check === 'Database Connectivity') {
      console.error(`  Recovery Steps:`);
      console.error(`    1. Run: npm run init-db`);
      console.error(`    2. Check DATABASE_PATH in .env is correct`);
      console.error(`    3. Ensure the data directory exists and is writable`);
      console.error(`    4. Verify file permissions on the database file`);
    } else if (check === 'Port Availability') {
      console.error(`  Recovery Steps:`);
      console.error(`    1. Check if ports 4242 (backend) or 3042 (frontend) are in use`);
      console.error(`    2. Stop any processes using these ports`);
      console.error(`    3. On Windows: netstat -ano | findstr "4242"`);
      console.error(`    4. On Unix: lsof -i :4242`);
      console.error(`    5. Change PORT in .env if needed`);
    } else if (check === 'Dependencies') {
      console.error(`  Recovery Steps:`);
      console.error(`    1. Run: npm install`);
      console.error(`    2. Ensure all dependencies are installed correctly`);
      console.error(`    3. Check for native module build errors`);
      console.error(`    4. Try: npm rebuild better-sqlite3`);
    }
    
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
  }
  
  console.error('❌ Startup aborted due to failed system checks.');
  console.error('   Please fix the issues above and try again.');
  console.error('');
  process.exit(1);
}

console.log('✅ System readiness validated successfully');
console.log('');

// ============================================================================
// Initialize Evolution System (DevProdManager + SelfAnalyzer)
// ============================================================================

console.log('🔧 Initializing Prometheus Evolution System...');

// Initialize database
const dbPath = path.join(process.cwd() || '.', 'data', 'prometheus.db');
console.log('[Init] Database path:', dbPath);
const db = new PrometheusDatabase({ path: dbPath });
const memoryEngine = new MemoryEngine(db, dbPath);

// Initialize repository manager
const repoManager = new RepositoryManager(memoryEngine, {
  prometheusRepoPath: process.cwd(),
});

// Configure dev/prod repositories
const devProdConfig = {
  devRepoPath: path.join(process.cwd(), '..', 'prometheus-dev'),
  devRepoUrl: process.env['DEV_REPO_URL'] || 'https://github.com/Patheras/prometheus-dev',
  prodRepoPath: path.join(process.cwd()),
  prodRepoUrl: process.env['PROD_REPO_URL'] || 'https://github.com/Patheras/prometheus',
  gitProvider: 'github' as const,
  auth: {
    type: 'token' as const,
    token: process.env['GITHUB_TOKEN'],
  },
};

// Initialize DevProdManager
const devProdManager = new DevProdManager(repoManager, memoryEngine, devProdConfig);

// Initialize SelfAnalyzer
const qualityAnalyzer = createCodeQualityAnalyzer();
const debtDetector = createDebtDetector();
const selfAnalyzer = new SelfAnalyzer(
  {
    prometheusRepoPath: process.cwd(),
    analysisInterval: 3600000, // 1 hour
    triggerOnModification: true,
    excludePaths: ['node_modules', 'dist', '.git', 'data'],
  },
  qualityAnalyzer,
  debtDetector,
  memoryEngine
);

// Initialize evolution system
initializeEvolutionSystem(devProdManager, selfAnalyzer);

// Initialize activity feed
initializeActivityFeed();

// Load existing promotion requests and tasks
devProdManager.loadPromotionRequests().catch(err => {
  console.warn('Could not load promotion requests:', err);
});

console.log('✅ Evolution System initialized successfully');
console.log('   - DevProdManager: Ready');
console.log('   - SelfAnalyzer: Ready');
console.log('   - Dev Repository:', devProdConfig.devRepoPath);
console.log('   - Prod Repository:', devProdConfig.prodRepoPath);

// Middleware
app.use(express.json());

// CORS for development
app.use((req, res, next): void => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Health check endpoint
app.get('/health', async (_req, res): Promise<void> => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const version = '0.1.0';
  const uptime = process.uptime();

  // Check database connectivity
  const dbCheckStart = Date.now();
  let databaseHealth: { status: 'up' | 'down'; message?: string; latency?: number };
  try {
    // Try to check if database is open
    const isOpen = db.isOpen();
    if (!isOpen) {
      databaseHealth = {
        status: 'down',
        message: 'Database is not open',
        latency: Date.now() - dbCheckStart,
      };
    } else {
      // Try a simple query to verify connectivity
      db.getDb().prepare('SELECT 1').get();
      databaseHealth = {
        status: 'up',
        latency: Date.now() - dbCheckStart,
      };
    }
  } catch (error) {
    databaseHealth = {
      status: 'down',
      message: error instanceof Error ? error.message : 'Database connectivity check failed',
      latency: Date.now() - dbCheckStart,
    };
  }

  // Check evolution system status
  const evolutionCheckStart = Date.now();
  let evolutionSystemHealth: { status: 'up' | 'down'; message?: string; latency?: number };
  try {
    // Check if DevProdManager and SelfAnalyzer are initialized
    if (!devProdManager || !selfAnalyzer) {
      evolutionSystemHealth = {
        status: 'down',
        message: 'Evolution system components not initialized',
        latency: Date.now() - evolutionCheckStart,
      };
    } else {
      // Verify components are functional by checking their state
      devProdManager.getStatistics();
      selfAnalyzer.getLastAnalysis();
      
      evolutionSystemHealth = {
        status: 'up',
        latency: Date.now() - evolutionCheckStart,
      };
    }
  } catch (error) {
    evolutionSystemHealth = {
      status: 'down',
      message: error instanceof Error ? error.message : 'Evolution system check failed',
      latency: Date.now() - evolutionCheckStart,
    };
  }

  // Determine overall status
  const allComponentsUp = databaseHealth.status === 'up' && evolutionSystemHealth.status === 'up';
  const overallStatus = allComponentsUp ? 'healthy' : 'unhealthy';
  const httpStatus = allComponentsUp ? 200 : 503;

  const healthResponse = {
    status: overallStatus,
    version,
    timestamp,
    uptime,
    components: {
      database: databaseHealth,
      evolutionSystem: evolutionSystemHealth,
      apiServer: {
        status: 'up' as const,
        latency: Date.now() - startTime,
      },
    },
  };

  res.status(httpStatus).json(healthResponse);
});

// Repository Management Endpoints
app.get('/api/repositories', (_req, res): void => {
  try {
    const repositories = getAllRepositories();
    res.json({ repositories });
  } catch (error) {
    console.error('Get repositories error:', error);
    res.status(500).json({
      error: 'Failed to fetch repositories',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/repositories/:id', (req, res): void => {
  try {
    const { id } = req.params;
    const repository = getRepositoryById(id);

    if (!repository) {
      res.status(404).json({
        error: 'Repository not found',
      });
    }

    res.json({ repository });
  } catch (error) {
    console.error('Get repository error:', error);
    res.status(500).json({
      error: 'Failed to fetch repository',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/api/repositories', (req, res): void => {
  try {
    const { name, url, branch, status, lastActivity, issuesCount } = req.body;

    if (!name || !url || !branch) {
      res.status(400).json({
        error: 'Missing required fields: name, url, branch',
      });
    }

    const repository = createRepository({
      name,
      url,
      branch,
      status: status || 'healthy',
      lastActivity: lastActivity || Date.now(),
      issuesCount: issuesCount || 0,
    });

    res.status(201).json({ repository });
  } catch (error) {
    console.error('Create repository error:', error);
    res.status(500).json({
      error: 'Failed to create repository',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.patch('/api/repositories/:id', (req, res): void => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const repository = updateRepository(id, updates);

    if (!repository) {
      res.status(404).json({
        error: 'Repository not found',
      });
    }

    res.json({ repository });
  } catch (error) {
    console.error('Update repository error:', error);
    res.status(500).json({
      error: 'Failed to update repository',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.delete('/api/repositories/:id', (req, res): void => {
  try {
    const { id } = req.params;
    const success = deleteRepository(id);

    if (!success) {
      res.status(404).json({
        error: 'Repository not found',
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete repository error:', error);
    res.status(500).json({
      error: 'Failed to delete repository',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Code quality analysis endpoint
app.post('/api/analyze/quality', async (req, res): Promise<void> => {
  try {
    const { filePath, sourceCode } = req.body;

    if (!filePath || !sourceCode) {
      res.status(400).json({
        error: 'Missing required fields: filePath and sourceCode',
      });
    }

    const analyzer = createCodeQualityAnalyzer();
    const result = await analyzer.analyze(filePath, sourceCode);

    // Rank issues
    const ranker = createIssueRanker();
    const rankedIssues = ranker.rankIssues(result.issues);

    res.json({
      ...result,
      issues: rankedIssues,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Technical debt detection endpoint
app.post('/api/analyze/debt', async (req, res): Promise<void> => {
  try {
    const { codebasePath, options } = req.body;

    if (!codebasePath) {
      res.status(400).json({
        error: 'Missing required field: codebasePath',
      });
    }

    const detector = createDebtDetector();
    const summary = await detector.detectDebt(codebasePath, options);
    const thresholds = detector.checkThresholds(summary);

    res.json({
      summary,
      thresholds,
    });
  } catch (error) {
    console.error('Debt detection error:', error);
    res.status(500).json({
      error: 'Debt detection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get issue suggestions endpoint
app.post('/api/suggestions', async (req, res): Promise<void> => {
  try {
    const { issues } = req.body;

    if (!issues || !Array.isArray(issues)) {
      res.status(400).json({
        error: 'Missing required field: issues (array)',
      });
    }

    const ranker = createIssueRanker();
    const suggestions = issues.map((issue: any) => ({
      issue,
      suggestion: ranker.generateSuggestion(issue),
    }));

    res.json({ suggestions });
  } catch (error) {
    console.error('Suggestion generation error:', error);
    res.status(500).json({
      error: 'Suggestion generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Chat Endpoints
app.post('/api/chat', handleChatRequestWithTools);
app.get('/api/chat/conversations', getAllConversations);
app.get('/api/chat/:conversationId', getConversationHistory);
app.delete('/api/chat/:conversationId', deleteConversation);

// Stats Endpoints
app.get('/api/stats', handleAllStatsRequest);
app.get('/api/stats/memory', handleMemoryStatsRequest);
app.get('/api/stats/runtime', handleRuntimeStatsRequest);
app.get('/api/stats/queue', handleQueueStatsRequest);
app.get('/api/stats/tools', handleToolStatsRequest);

// Activity Feed Endpoint
app.get('/api/activity', handleGetActivity);

// Workspace Endpoints
app.get('/api/workspace/:repoId/files', handleGetFiles);
app.get('/api/workspace/:repoId/files/*', handleGetFileContent);

// Evolution Endpoints
app.get('/api/evolution/stats', handleGetEvolutionStats);
app.get('/api/evolution/promotions/pending', handleGetPendingPromotions);
app.get('/api/evolution/improvements/recent', handleGetRecentImprovements);
app.post('/api/evolution/promotions/:promotionId/approve', handleApprovePromotion);
app.post('/api/evolution/promotions/:promotionId/reject', handleRejectPromotion);
app.post('/api/evolution/analysis/run', handleRunSelfAnalysis);

// API info endpoint
app.get('/api', (_req, res): void => {
  res.json({
    name: 'Prometheus Meta-Agent API',
    version: '0.1.0',
    endpoints: {
      health: 'GET /health',
      repositories: 'GET /api/repositories',
      repository: 'GET /api/repositories/:id',
      createRepository: 'POST /api/repositories',
      updateRepository: 'PATCH /api/repositories/:id',
      deleteRepository: 'DELETE /api/repositories/:id',
      analyzeQuality: 'POST /api/analyze/quality',
      analyzeDebt: 'POST /api/analyze/debt',
      suggestions: 'POST /api/suggestions',
      chat: 'POST /api/chat',
      conversations: 'GET /api/chat/conversations',
      conversationHistory: 'GET /api/chat/:conversationId',
      deleteConversation: 'DELETE /api/chat/:conversationId',
      stats: 'GET /api/stats',
      memoryStats: 'GET /api/stats/memory',
      runtimeStats: 'GET /api/stats/runtime',
      queueStats: 'GET /api/stats/queue',
      toolStats: 'GET /api/stats/tools',
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Prometheus Meta-Agent System v0.1.0                 ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('📊 Available Endpoints:');
  console.log(`   • GET  /health                      - Health check`);
  console.log(`   • GET  /api                         - API info`);
  console.log(`   • GET  /api/repositories            - List repositories`);
  console.log(`   • POST /api/repositories            - Create repository`);
  console.log(`   • GET  /api/repositories/:id        - Get repository`);
  console.log(`   • PATCH /api/repositories/:id       - Update repository`);
  console.log(`   • DELETE /api/repositories/:id      - Delete repository`);
  console.log(`   • POST /api/analyze/quality         - Code quality analysis`);
  console.log(`   • POST /api/analyze/debt            - Technical debt detection`);
  console.log(`   • POST /api/suggestions             - Get refactoring suggestions`);
  console.log(`   • POST /api/chat                    - Send chat message`);
  console.log(`   • GET  /api/chat/conversations      - List conversations`);
  console.log(`   • GET  /api/chat/:conversationId    - Get conversation`);
  console.log(`   • DELETE /api/chat/:conversationId  - Delete conversation`);
  console.log(`   • GET  /api/stats                   - All system stats`);
  console.log(`   • GET  /api/stats/memory            - Memory engine stats`);
  console.log(`   • GET  /api/stats/runtime           - Runtime executor stats`);
  console.log(`   • GET  /api/stats/queue             - Queue system stats`);
  console.log(`   • GET  /api/stats/tools             - Tool execution stats`);
  console.log('');
  console.log('✨ Ready to analyze and improve your code!');
  console.log('');
});

export { app };
