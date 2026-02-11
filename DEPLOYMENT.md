# Prometheus Deployment Guide

Complete guide for deploying Prometheus Meta-Agent System to production.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Deployment Options](#deployment-options)
6. [Monitoring Setup](#monitoring-setup)
7. [Security](#security)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

---

## Prerequisites

### System Requirements

**Minimum Requirements**:
- CPU: 2 cores
- RAM: 4 GB
- Disk: 10 GB free space
- OS: Linux, macOS, or Windows

**Recommended Requirements** (Production):
- CPU: 4+ cores
- RAM: 8+ GB
- Disk: 50+ GB SSD
- OS: Linux (Ubuntu 20.04+ or similar)

**Optimal Requirements** (High Load):
- CPU: 8+ cores
- RAM: 16+ GB
- Disk: 100+ GB NVMe SSD
- OS: Linux with kernel 5.4+

### Software Requirements

1. **Node.js** >= 18.0.0
   ```bash
   # Check version
   node --version
   
   # Install via nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

2. **npm** or **yarn**
   ```bash
   # npm comes with Node.js
   npm --version
   
   # Or install yarn
   npm install -g yarn
   ```

3. **Git**
   ```bash
   git --version
   ```

4. **SQLite** with **sqlite-vec** extension
   ```bash
   # Install SQLite
   # Ubuntu/Debian
   sudo apt-get install sqlite3 libsqlite3-dev
   
   # macOS
   brew install sqlite
   
   # Windows
   # Download from https://www.sqlite.org/download.html
   ```

5. **sqlite-vec Extension** (for vector search)
   ```bash
   # Download from https://github.com/asg017/sqlite-vec
   # Follow installation instructions for your platform
   ```

6. **LLM Provider API Keys** (at least one required)
   - OpenAI API key
   - Anthropic API key
   - Or other supported providers

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-org/prometheus.git
cd prometheus
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Build Project

```bash
npm run build
# or
yarn build
```

### 4. Verify Installation

```bash
npm test
# Should show all tests passing
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_PATH=./data/prometheus.db

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Runtime Configuration
DEFAULT_MODEL=gpt-4
FALLBACK_MODEL=claude-3-sonnet
MAX_CONCURRENT_REQUESTS=10

# Memory Configuration
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
VECTOR_DIMENSIONS=1536

# Queue Configuration
MAIN_LANE_CONCURRENCY=1
ANALYSIS_LANE_CONCURRENCY=3
DECISION_LANE_CONCURRENCY=2

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
METRICS_PORT=9090

# Security
ENABLE_AUTH=true
JWT_SECRET=your-secret-key-here
ALLOWED_ORIGINS=https://admin.anots.com

# Self-Analysis
SELF_ANALYSIS_INTERVAL=86400000  # 24 hours
TRIGGER_ON_MODIFICATION=true
```

### Configuration File

Create `config/production.json`:

```json
{
  "database": {
    "path": "./data/prometheus.db",
    "enableWAL": true,
    "busyTimeout": 5000
  },
  "runtime": {
    "defaultModel": "gpt-4",
    "fallbackChain": ["claude-3-sonnet", "gpt-3.5-turbo"],
    "maxRetries": 3,
    "timeout": 30000
  },
  "memory": {
    "embeddingProvider": "openai",
    "embeddingModel": "text-embedding-3-small",
    "cacheSize": 10000,
    "indexBatchSize": 100
  },
  "queue": {
    "lanes": {
      "main": { "concurrency": 1 },
      "analysis": { "concurrency": 3 },
      "decision": { "concurrency": 2 },
      "evolution": { "concurrency": 1 }
    },
    "maxWaitTime": 60000
  },
  "analysis": {
    "minQualityScore": 70,
    "maxComplexity": 15,
    "enableCodeSmells": true
  },
  "decision": {
    "priorityWeights": {
      "impact": 0.4,
      "urgency": 0.3,
      "effort": 0.2,
      "alignment": 0.1
    }
  },
  "evolution": {
    "selfAnalysisInterval": 86400000,
    "requireConsultation": true,
    "autoApplyThreshold": 80
  }
}
```

---

## Database Setup

### 1. Initialize Database

```bash
npm run db:init
```

This creates:
- Database file at configured path
- All required tables
- Indexes for performance
- FTS5 tables for search
- Vector tables for similarity search

### 2. Seed Patterns (Optional)

```bash
npm run db:seed-patterns
```

Loads OpenClaw patterns from `openclaw-learning/patterns/`.

### 3. Verify Database

```bash
sqlite3 data/prometheus.db ".tables"
# Should show all tables
```

### 4. Database Backup

Set up automated backups:

```bash
# Create backup script
cat > scripts/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
sqlite3 data/prometheus.db ".backup $BACKUP_DIR/prometheus_$TIMESTAMP.db"
# Keep only last 7 days
find $BACKUP_DIR -name "prometheus_*.db" -mtime +7 -delete
EOF

chmod +x scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /path/to/prometheus/scripts/backup-db.sh
```

---

## Deployment Options

### Option 1: Standalone Server

**Best for**: Development, testing, small teams

```bash
# Start server
npm start

# Or with PM2 for production
npm install -g pm2
pm2 start npm --name prometheus -- start
pm2 save
pm2 startup
```

**PM2 Configuration** (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [{
    name: 'prometheus',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '2G',
    autorestart: true,
    watch: false
  }]
};
```

### Option 2: Docker Container

**Best for**: Consistent environments, cloud deployment

**Dockerfile**:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY dist ./dist
COPY config ./config

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/index.js"]
```

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  prometheus:
    build: .
    ports:
      - "3000:3000"
      - "9090:9090"  # Metrics
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/prometheus.db
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./config:/app/config:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health')"]
      interval: 30s
      timeout: 3s
      retries: 3
```

**Deploy**:

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Option 3: Kubernetes

**Best for**: Large scale, high availability

**deployment.yaml**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  labels:
    app: prometheus
spec:
  replicas: 2
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: your-registry/prometheus:latest
        ports:
        - containerPort: 3000
        - containerPort: 9090
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_PATH
          value: "/data/prometheus.db"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: prometheus-secrets
              key: openai-api-key
        volumeMounts:
        - name: data
          mountPath: /data
        - name: config
          mountPath: /app/config
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: prometheus-data
      - name: config
        configMap:
          name: prometheus-config
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
spec:
  selector:
    app: prometheus
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: metrics
    port: 9090
    targetPort: 9090
  type: LoadBalancer
```

**Deploy**:

```bash
# Create secrets
kubectl create secret generic prometheus-secrets \
  --from-literal=openai-api-key=$OPENAI_API_KEY \
  --from-literal=anthropic-api-key=$ANTHROPIC_API_KEY

# Create config
kubectl create configmap prometheus-config \
  --from-file=config/production.json

# Deploy
kubectl apply -f deployment.yaml

# Check status
kubectl get pods -l app=prometheus
kubectl logs -f deployment/prometheus
```

---

## Monitoring Setup

### 1. Prometheus Metrics

Prometheus exposes metrics at `/metrics` endpoint.

**prometheus.yml** (for Prometheus server):

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'prometheus-meta-agent'
    static_configs:
      - targets: ['localhost:9090']
```

**Key Metrics**:
- `prometheus_llm_requests_total` - Total LLM requests
- `prometheus_llm_request_duration_seconds` - LLM request latency
- `prometheus_queue_depth` - Queue depth by lane
- `prometheus_memory_operations_total` - Memory operations
- `prometheus_analysis_duration_seconds` - Analysis duration
- `prometheus_decision_score` - Decision scores

### 2. Logging

Configure structured logging:

```javascript
// config/logging.js
export default {
  level: process.env.LOG_LEVEL || 'info',
  format: 'json',
  transports: [
    {
      type: 'console',
      colorize: true
    },
    {
      type: 'file',
      filename: 'logs/prometheus.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    },
    {
      type: 'file',
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    }
  ]
};
```

### 3. Health Checks

Implement health check endpoints:

```typescript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Readiness check
app.get('/ready', async (req, res) => {
  try {
    // Check database
    await memoryEngine.ping();
    
    // Check LLM providers
    await runtimeEngine.ping();
    
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

### 4. Alerting

Set up alerts for critical issues:

```yaml
# alerts.yml
groups:
  - name: prometheus_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(prometheus_llm_errors_total[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High LLM error rate"
          
      - alert: QueueBacklog
        expr: prometheus_queue_depth > 100
        for: 10m
        annotations:
          summary: "Queue backlog detected"
          
      - alert: LowQualityScore
        expr: prometheus_quality_score < 70
        for: 1h
        annotations:
          summary: "Code quality score below threshold"
```

---

## Security

### 1. API Authentication

Enable JWT authentication:

```typescript
// middleware/auth.ts
import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

### 2. Rate Limiting

Implement rate limiting:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### 3. Input Validation

Validate all inputs:

```typescript
import { z } from 'zod';

const analysisSchema = z.object({
  repoPath: z.string().min(1),
  maxIssues: z.number().int().positive().optional(),
  autoApply: z.boolean().optional(),
});

app.post('/api/analyze', async (req, res) => {
  try {
    const validated = analysisSchema.parse(req.body);
    // Process request
  } catch (error) {
    return res.status(400).json({ error: 'Invalid input' });
  }
});
```

### 4. Secrets Management

Use environment variables or secret managers:

```bash
# Never commit secrets to git
echo ".env" >> .gitignore

# Use secret manager in production
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id prometheus/api-keys

# Kubernetes Secrets
kubectl create secret generic prometheus-secrets \
  --from-literal=openai-key=$OPENAI_API_KEY
```

---

## Troubleshooting

### Common Issues

#### 1. Database Locked

**Symptom**: `SQLITE_BUSY: database is locked`

**Solution**:
```bash
# Enable WAL mode
sqlite3 data/prometheus.db "PRAGMA journal_mode=WAL;"

# Increase busy timeout in config
{
  "database": {
    "busyTimeout": 10000
  }
}
```

#### 2. Out of Memory

**Symptom**: Process crashes with OOM error

**Solution**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Or in PM2
pm2 start npm --name prometheus --node-args="--max-old-space-size=4096" -- start
```

#### 3. LLM Timeout

**Symptom**: Requests timeout waiting for LLM

**Solution**:
```json
{
  "runtime": {
    "timeout": 60000,
    "maxRetries": 3,
    "fallbackChain": ["gpt-4", "claude-3-sonnet", "gpt-3.5-turbo"]
  }
}
```

#### 4. High Queue Depth

**Symptom**: Tasks pile up in queue

**Solution**:
```json
{
  "queue": {
    "lanes": {
      "analysis": { "concurrency": 5 },
      "decision": { "concurrency": 3 }
    }
  }
}
```

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

### Performance Profiling

Profile performance:

```bash
# CPU profiling
node --prof dist/index.js

# Memory profiling
node --inspect dist/index.js
# Open chrome://inspect in Chrome
```

---

## Maintenance

### Regular Tasks

#### Daily
- Check logs for errors
- Monitor queue depths
- Review LLM usage

#### Weekly
- Backup database
- Review quality metrics
- Check disk space

#### Monthly
- Update dependencies
- Review and optimize patterns
- Analyze self-improvement trends

### Updates

```bash
# Update dependencies
npm update

# Run tests
npm test

# Rebuild
npm run build

# Restart service
pm2 restart prometheus
# or
docker-compose restart
# or
kubectl rollout restart deployment/prometheus
```

### Database Maintenance

```bash
# Vacuum database (reclaim space)
sqlite3 data/prometheus.db "VACUUM;"

# Analyze for query optimization
sqlite3 data/prometheus.db "ANALYZE;"

# Check integrity
sqlite3 data/prometheus.db "PRAGMA integrity_check;"
```

---

## Production Checklist

Before deploying to production:

- [ ] Environment variables configured
- [ ] Database initialized and backed up
- [ ] LLM API keys tested
- [ ] Health checks working
- [ ] Monitoring configured
- [ ] Logging configured
- [ ] Authentication enabled
- [ ] Rate limiting enabled
- [ ] SSL/TLS configured
- [ ] Firewall rules set
- [ ] Backup strategy in place
- [ ] Rollback plan documented
- [ ] Team trained on operations
- [ ] Documentation reviewed

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/prometheus/issues
- Documentation: https://docs.prometheus.dev
- Email: support@prometheus.dev

---

**Last Updated**: 2026-02-09
**Version**: 1.0.0
