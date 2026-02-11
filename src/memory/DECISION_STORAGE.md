# Decision Storage (Task 9.1)

## Overview

The Decision Storage system provides a structured way to record, track, and learn from technical and architectural decisions. It implements Requirements 2.1, 2.2, and 2.5 from the Prometheus specification.

## Features

### 1. Store Decisions with Complete Context (Requirement 2.1)

Every decision is stored with:
- **Context**: The situation that required a decision
- **Reasoning**: Why the decision was made
- **Alternatives**: All options that were considered, with pros/cons
- **Chosen Option**: The selected alternative
- **Timestamp**: When the decision was made

### 2. Link to Affected Components (Requirement 2.5)

Decisions can be linked to the code components they affect:
- Source files
- Database migrations
- Configuration files
- Test files
- Infrastructure files

This creates traceability between decisions and their implementation.

### 3. Update with Outcomes (Requirement 2.2)

After implementation, decisions can be updated with:
- **Outcome**: What actually happened (success, failure, mixed results)
- **Lessons Learned**: Key insights for future decisions

This creates a learning loop where past decisions inform future ones.

## Usage

### Storing a Decision

```typescript
import { initializeDatabase, createMemoryEngine } from './memory';

const db = await initializeDatabase({ path: './prometheus.db' });
const engine = createMemoryEngine(db);

const decisionId = await engine.storeDecision({
  timestamp: Date.now(),
  context: 'Need to choose a caching strategy for API responses',
  reasoning: 'API response times are too slow, affecting user experience',
  alternatives: JSON.stringify([
    {
      option: 'Redis',
      pros: ['Fast', 'Distributed', 'Rich data structures'],
      cons: ['Additional infrastructure', 'Cost'],
      estimated_effort: '1 week'
    },
    {
      option: 'In-memory cache',
      pros: ['Simple', 'No infrastructure', 'Fast'],
      cons: ['Not distributed', 'Memory limits'],
      estimated_effort: '2 days'
    }
  ]),
  chosen_option: 'Redis',
  outcome: null,
  lessons_learned: null,
  affected_components: JSON.stringify([
    'src/cache/redis.ts',
    'src/api/middleware/cache.ts',
    'infrastructure/redis.yml'
  ])
});

console.log(`Decision stored: ${decisionId}`);
```

### Updating with Outcome

```typescript
await engine.updateDecisionOutcome(
  decisionId,
  'Successfully implemented Redis caching. Response times improved by 70%.',
  'Redis setup was straightforward. Key learning: connection pooling is essential for performance.'
);
```

## Data Model

### Decision Type

```typescript
interface Decision {
  id: string;                      // Auto-generated
  timestamp: number;               // Unix timestamp
  context: string;                 // Required: situation description
  reasoning: string;               // Required: why this decision
  alternatives: string;            // Required: JSON array of alternatives
  chosen_option: string;           // Required: selected option
  outcome: string | null;          // Optional: what happened
  lessons_learned: string | null;  // Optional: key insights
  affected_components: string | null; // Optional: JSON array of file paths
}
```

### Alternative Structure

```typescript
interface DecisionAlternative {
  option: string;           // Name of the alternative
  pros: string[];          // Advantages
  cons: string[];          // Disadvantages
  estimated_effort: string; // Time estimate
}
```

## Validation

The system validates all required fields:

1. **Context**: Must be non-empty string
2. **Reasoning**: Must be non-empty string
3. **Alternatives**: Must be non-empty string and valid JSON
4. **Chosen Option**: Must be non-empty string
5. **Affected Components**: If provided, must be valid JSON

Invalid data will throw descriptive errors:
- `Decision context is required`
- `Decision reasoning is required`
- `Decision alternatives are required`
- `Decision alternatives must be valid JSON array`
- `Decision affected_components must be valid JSON array`

## Database Schema

```sql
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  context TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  alternatives TEXT NOT NULL,
  chosen_option TEXT NOT NULL,
  outcome TEXT,
  lessons_learned TEXT,
  affected_components TEXT
);

CREATE INDEX idx_decisions_timestamp ON decisions(timestamp);
```

## Examples

### Example 1: Technical Decision

```typescript
const decision = {
  timestamp: Date.now(),
  context: 'Need to implement real-time notifications',
  reasoning: 'Users need instant updates for critical events',
  alternatives: JSON.stringify([
    {
      option: 'WebSockets',
      pros: ['Real-time', 'Bidirectional', 'Low latency'],
      cons: ['Complex setup', 'Scaling challenges'],
      estimated_effort: '2 weeks'
    },
    {
      option: 'Server-Sent Events',
      pros: ['Simple', 'HTTP-based'],
      cons: ['One-way only'],
      estimated_effort: '1 week'
    }
  ]),
  chosen_option: 'WebSockets',
  outcome: null,
  lessons_learned: null,
  affected_components: JSON.stringify([
    'src/websocket/server.ts',
    'src/websocket/client.ts',
    'src/notifications/handler.ts'
  ])
};

const id = await engine.storeDecision(decision);
```

### Example 2: Architectural Decision

```typescript
const decision = {
  timestamp: Date.now(),
  context: 'System is becoming difficult to maintain as monolith',
  reasoning: 'Need independent deployment and team autonomy',
  alternatives: JSON.stringify([
    {
      option: 'Microservices',
      pros: ['Independent deployment', 'Team autonomy'],
      cons: ['Operational complexity', 'Higher costs'],
      estimated_effort: '6 months'
    },
    {
      option: 'Modular Monolith',
      pros: ['Simpler operations', 'Lower costs'],
      cons: ['Coupled deployment'],
      estimated_effort: '3 months'
    }
  ]),
  chosen_option: 'Modular Monolith',
  outcome: null,
  lessons_learned: null,
  affected_components: null // System-wide decision
};

const id = await engine.storeDecision(decision);
```

### Example 3: Recording Negative Outcome

```typescript
await engine.updateDecisionOutcome(
  decisionId,
  `
    FAILED: Approach abandoned after 3 weeks.
    - Data consistency issues
    - Synchronization complexity
    - Rolled back to simpler solution
  `,
  `
    Key lessons:
    1. Start with simplest solution first
    2. Build proof of concept before full implementation
    3. Consider team experience in decision
    4. Validate assumptions with experiments
  `
);
```

## Best Practices

### 1. Be Specific in Context

❌ Bad: "Need to improve performance"
✅ Good: "Dashboard loading takes 5-10 seconds. Users are complaining. Analysis shows complex JOIN queries are the bottleneck."

### 2. Document All Alternatives

Include all options considered, even if quickly dismissed. This helps future decision-makers understand what was evaluated.

### 3. Link to Affected Components

Always specify which files/components are affected. This creates traceability and helps with impact analysis.

### 4. Update with Outcomes

Don't forget to update decisions with outcomes! This is where the learning happens.

### 5. Be Honest About Failures

Negative outcomes are valuable learning opportunities. Document what went wrong and why.

### 6. Include Metrics

When updating outcomes, include concrete metrics:
- Performance improvements
- Time taken vs. estimated
- User satisfaction
- Cost impact

## Integration with Other Systems

### Future Enhancements (Task 9.2)

Decision search will enable:
- Finding similar past decisions
- Filtering by outcome (success/failure)
- Querying by time period
- Analyzing decision patterns

### Analysis Engine Integration

Decisions will be used by the Analysis Engine to:
- Assess impact of proposed changes
- Identify patterns in successful decisions
- Recommend alternatives based on past outcomes
- Trigger consultations for high-risk decisions

### Evolution Engine Integration

The Evolution Engine will use decision history to:
- Learn which patterns work in which contexts
- Improve decision-making over time
- Suggest optimizations based on past lessons
- Identify areas for self-improvement

## Testing

Comprehensive tests are provided in `__tests__/decision-storage.test.ts`:

- ✅ Store decisions with all required fields
- ✅ Validate required fields
- ✅ Link to affected components
- ✅ Update with outcomes
- ✅ Handle edge cases (empty alternatives, long text, special characters)
- ✅ Complete decision lifecycle

Run tests:
```bash
npm test -- decision-storage.test.ts
```

## Example Usage

See `examples/decision-storage-example.ts` for a complete working example demonstrating:
- Technical decisions
- Architectural decisions
- Successful outcomes
- Failed outcomes with lessons learned

Run example:
```bash
npx tsx src/memory/examples/decision-storage-example.ts
```

## Requirements Satisfied

✅ **Requirement 2.1**: Store decision with context, reasoning, alternatives, chosen option
✅ **Requirement 2.2**: Update decision record with results and lessons learned
✅ **Requirement 2.5**: Link decisions to affected code components

## Related Documentation

- [Memory Engine Overview](./README.md)
- [Database Schema](./database.ts)
- [Type Definitions](./types.ts)
- [Requirements Document](../../.kiro/specs/prometheus/requirements.md)
