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
  handleChatRequest,
  getConversationHistory,
  getAllConversations,
  deleteConversation,
} from './api/chat.js';
import {
  handleMemoryStatsRequest,
  handleRuntimeStatsRequest,
  handleQueueStatsRequest,
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
} from './api/evolution.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Repository Management Endpoints
app.get('/api/repositories', (req, res) => {
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

app.get('/api/repositories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const repository = getRepositoryById(id);

    if (!repository) {
      return res.status(404).json({
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

app.post('/api/repositories', (req, res) => {
  try {
    const { name, url, branch, status, lastActivity, issuesCount } = req.body;

    if (!name || !url || !branch) {
      return res.status(400).json({
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

app.patch('/api/repositories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const repository = updateRepository(id, updates);

    if (!repository) {
      return res.status(404).json({
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

app.delete('/api/repositories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const success = deleteRepository(id);

    if (!success) {
      return res.status(404).json({
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
app.post('/api/analyze/quality', async (req, res) => {
  try {
    const { filePath, sourceCode } = req.body;

    if (!filePath || !sourceCode) {
      return res.status(400).json({
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
app.post('/api/analyze/debt', async (req, res) => {
  try {
    const { codebasePath, options } = req.body;

    if (!codebasePath) {
      return res.status(400).json({
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
app.post('/api/suggestions', async (req, res) => {
  try {
    const { issues } = req.body;

    if (!issues || !Array.isArray(issues)) {
      return res.status(400).json({
        error: 'Missing required field: issues (array)',
      });
    }

    const ranker = createIssueRanker();
    const suggestions = issues.map((issue) => ({
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
app.post('/api/chat', handleChatRequest);
app.get('/api/chat/conversations', getAllConversations);
app.get('/api/chat/:conversationId', getConversationHistory);
app.delete('/api/chat/:conversationId', deleteConversation);

// Stats Endpoints
app.get('/api/stats', handleAllStatsRequest);
app.get('/api/stats/memory', handleMemoryStatsRequest);
app.get('/api/stats/runtime', handleRuntimeStatsRequest);
app.get('/api/stats/queue', handleQueueStatsRequest);

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
app.get('/api', (req, res) => {
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
  console.log('');
  console.log('✨ Ready to analyze and improve your code!');
  console.log('');
});

export { app };
