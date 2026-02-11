# Prometheus API Documentation

## Getting Started

### Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`

### Test the API

```bash
# In another terminal
npx tsx examples/test-api.ts
```

## API Endpoints

### Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### Code Quality Analysis

**POST** `/api/analyze/quality`

Analyze code quality and detect issues.

**Request Body:**
```json
{
  "filePath": "src/example.ts",
  "sourceCode": "function test() { return 42; }"
}
```

**Response:**
```json
{
  "filePath": "src/example.ts",
  "issues": [
    {
      "id": "uuid",
      "type": "magic_number",
      "severity": "low",
      "description": "Magic number 42 should be a named constant",
      "startLine": 1,
      "endLine": 1,
      "suggestion": "Extract 42 to a named constant",
      "effortHours": 0.5,
      "impactScore": 20
    }
  ],
  "complexity": {
    "cyclomaticComplexity": 1,
    "cognitiveComplexity": 1,
    "linesOfCode": 1,
    "parameterCount": 0,
    "nestingDepth": 1
  },
  "duplications": [],
  "qualityScore": 95,
  "analyzedAt": 1234567890
}
```

---

### Technical Debt Detection

**POST** `/api/analyze/debt`

Detect technical debt in a codebase.

**Request Body:**
```json
{
  "codebasePath": "./src",
  "options": {
    "includeOutdatedDeps": true,
    "includeTodoComments": true,
    "includeMissingTests": true,
    "includeArchitecturalViolations": true,
    "minPriority": 2,
    "maxItems": 50
  }
}
```

**Response:**
```json
{
  "summary": {
    "totalItems": 15,
    "totalHours": 32.5,
    "byType": {
      "todo_comment": 8,
      "missing_test": 5,
      "architectural_violation": 2
    },
    "byPriority": {
      "2": 8,
      "3": 5,
      "4": 2
    },
    "criticalItems": []
  },
  "thresholds": {
    "exceedsCritical": false,
    "exceedsWarning": true,
    "exceedsMaximum": false,
    "requiresConsultation": false
  }
}
```

---

### Get Refactoring Suggestions

**POST** `/api/suggestions`

Generate refactoring suggestions for quality issues.

**Request Body:**
```json
{
  "issues": [
    {
      "id": "uuid",
      "type": "complexity",
      "severity": "high",
      "description": "Function has high complexity",
      "effortHours": 3,
      "impactScore": 80
    }
  ]
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "issue": { /* issue object */ },
      "suggestion": "High Complexity Refactoring:\n1. Identify logical blocks...\n2. Extract each block...\nEstimated effort: 3 hours"
    }
  ]
}
```

---

## Example Usage

### Using cURL

```bash
# Health check
curl http://localhost:3001/health

# Analyze code quality
curl -X POST http://localhost:3001/api/analyze/quality \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "test.ts",
    "sourceCode": "function test() { return 42; }"
  }'

# Detect technical debt
curl -X POST http://localhost:3001/api/analyze/debt \
  -H "Content-Type: application/json" \
  -d '{
    "codebasePath": "./src",
    "options": {
      "includeTodoComments": true
    }
  }'
```

### Using JavaScript/TypeScript

```typescript
// Analyze code quality
const response = await fetch('http://localhost:3001/api/analyze/quality', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filePath: 'example.ts',
    sourceCode: 'function test() { return 42; }'
  })
});

const result = await response.json();
console.log('Quality Score:', result.qualityScore);
console.log('Issues:', result.issues.length);
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (missing or invalid parameters)
- `500` - Internal Server Error

Error responses include:
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

## Development

### Run in Development Mode

```bash
npm run dev
```

This uses `tsx watch` to automatically restart on file changes.

### Run Tests

```bash
npm test
```

### Build for Production

```bash
npm run build
npm start
```
