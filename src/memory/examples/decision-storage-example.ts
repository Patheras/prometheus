/**
 * Example: Decision Storage (Task 9.1)
 * 
 * This example demonstrates:
 * - Storing decisions with context, reasoning, alternatives, and chosen option (Requirement 2.1)
 * - Linking decisions to affected code components (Requirement 2.5)
 * - Updating decisions with outcomes and lessons learned (Requirement 2.2)
 * 
 * Requirements: 2.1, 2.2, 2.5
 */

import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { initializeDatabase, createMemoryEngine } from '../index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('=== Decision Storage Example ===\n');

  // Initialize database
  const dbPath = join(__dirname, 'decision-storage-example.db');
  const db = await initializeDatabase({ path: dbPath });
  const engine = createMemoryEngine(db);

  try {
    // ========================================================================
    // Example 1: Storing a technical decision with multiple alternatives
    // ========================================================================
    console.log('Example 1: Storing a technical decision\n');

    const decision1 = {
      timestamp: Date.now(),
      context: `
        The ANOTS marketing automation system needs to implement real-time 
        notifications for campaign events. Users need to be notified immediately 
        when campaigns are triggered, emails are sent, or leads respond.
      `.trim(),
      reasoning: `
        Real-time notifications are critical for user engagement and timely 
        responses to campaign events. After analyzing our requirements:
        - Need bidirectional communication for future features
        - Must support 10,000+ concurrent connections
        - Should integrate with existing Node.js infrastructure
        - Need to work with our load balancer setup
      `.trim(),
      alternatives: JSON.stringify([
        {
          option: 'WebSockets',
          pros: [
            'True real-time bidirectional communication',
            'Low latency (< 100ms)',
            'Efficient for high-frequency updates',
            'Good library support (Socket.io, ws)',
          ],
          cons: [
            'Complex connection management',
            'Requires sticky sessions with load balancer',
            'More infrastructure complexity',
          ],
          estimated_effort: '2 weeks',
        },
        {
          option: 'Server-Sent Events (SSE)',
          pros: [
            'Simple HTTP-based protocol',
            'Automatic reconnection',
            'Works with standard HTTP infrastructure',
          ],
          cons: [
            'One-way communication only',
            'Limited browser support for older clients',
            'Connection limits in some browsers',
          ],
          estimated_effort: '1 week',
        },
        {
          option: 'Long Polling',
          pros: [
            'Works everywhere',
            'Simple to implement',
            'No special infrastructure needed',
          ],
          cons: [
            'Not truly real-time',
            'Higher server load',
            'Inefficient for frequent updates',
          ],
          estimated_effort: '3 days',
        },
      ]),
      chosen_option: 'WebSockets',
      outcome: null,
      lessons_learned: null,
      affected_components: JSON.stringify([
        'src/websocket/server.ts',
        'src/websocket/client.ts',
        'src/websocket/connection-manager.ts',
        'src/notifications/handler.ts',
        'src/notifications/events.ts',
        'src/api/notifications.ts',
        'infrastructure/nginx.conf',
        'tests/websocket/connection.test.ts',
      ]),
    };

    const decisionId1 = await engine.storeDecision(decision1);
    console.log(`✓ Stored decision: ${decisionId1}`);
    console.log(`  Context: ${decision1.context.substring(0, 80)}...`);
    console.log(`  Chosen: ${decision1.chosen_option}`);
    console.log(`  Affected components: ${JSON.parse(decision1.affected_components!).length} files\n`);

    // ========================================================================
    // Example 2: Storing an architectural decision
    // ========================================================================
    console.log('Example 2: Storing an architectural decision\n');

    const decision2 = {
      timestamp: Date.now(),
      context: `
        ANOTS is growing rapidly and the monolithic architecture is becoming 
        difficult to maintain. Different teams are stepping on each other's toes, 
        deployments are risky, and scaling is becoming problematic.
      `.trim(),
      reasoning: `
        After analyzing our growth trajectory and team structure:
        - We have 3 distinct teams (Marketing, Analytics, Infrastructure)
        - Each team needs to deploy independently
        - Different components have different scaling needs
        - Current deployment takes 30 minutes and requires full system downtime
      `.trim(),
      alternatives: JSON.stringify([
        {
          option: 'Microservices Architecture',
          pros: [
            'Independent deployment per service',
            'Team autonomy',
            'Technology flexibility',
            'Better scalability',
          ],
          cons: [
            'Increased operational complexity',
            'Distributed system challenges',
            'Higher infrastructure costs',
            'Learning curve for team',
          ],
          estimated_effort: '6 months',
        },
        {
          option: 'Modular Monolith',
          pros: [
            'Simpler operations',
            'Easier to reason about',
            'Lower infrastructure costs',
            'Can migrate to microservices later',
          ],
          cons: [
            'Still coupled deployment',
            'Shared database challenges',
            'Requires strong discipline',
          ],
          estimated_effort: '3 months',
        },
        {
          option: 'Keep Current Monolith',
          pros: [
            'No migration effort',
            'Team knows the system',
            'Proven and stable',
          ],
          cons: [
            'Scaling limitations',
            'Deployment risks',
            'Team coordination overhead',
          ],
          estimated_effort: '0',
        },
      ]),
      chosen_option: 'Modular Monolith',
      outcome: null,
      lessons_learned: null,
      affected_components: null, // Architectural decision affects entire system
    };

    const decisionId2 = await engine.storeDecision(decision2);
    console.log(`✓ Stored decision: ${decisionId2}`);
    console.log(`  Context: ${decision2.context.substring(0, 80)}...`);
    console.log(`  Chosen: ${decision2.chosen_option}`);
    console.log(`  Scope: System-wide architectural decision\n`);

    // ========================================================================
    // Example 3: Updating decision with successful outcome
    // ========================================================================
    console.log('Example 3: Updating decision with successful outcome\n');

    await engine.updateDecisionOutcome(
      decisionId1,
      `
        Successfully implemented WebSocket notifications. Key metrics:
        - Average latency: 85ms
        - Connection stability: 99.9% uptime
        - Concurrent connections: 12,000+ during peak
        - User satisfaction: 95% positive feedback
        
        Implementation took 2.5 weeks (slightly over estimate).
      `.trim(),
      `
        Key lessons learned:
        
        1. Reconnection Logic: Implementing robust reconnection with exponential 
           backoff was critical. Initial implementation had issues with thundering 
           herd during server restarts.
        
        2. Heartbeat Mechanism: Essential for detecting dead connections. Set to 
           30-second intervals with 3 missed heartbeats before disconnect.
        
        3. Load Balancer Configuration: Sticky sessions are mandatory. Spent 2 days 
           debugging connection issues before realizing load balancer was routing 
           to different servers.
        
        4. Message Queuing: Added Redis pub/sub for message distribution across 
           server instances. This wasn't in original plan but became necessary.
        
        5. Testing: Load testing revealed memory leaks in connection cleanup. 
           Always test with realistic connection counts.
        
        Would choose WebSockets again for this use case. The complexity was worth 
        the performance and user experience benefits.
      `.trim()
    );

    console.log(`✓ Updated decision ${decisionId1} with outcome`);
    console.log('  Status: Successful implementation');
    console.log('  Key metrics: 85ms latency, 99.9% uptime\n');

    // ========================================================================
    // Example 4: Updating decision with lessons from challenges
    // ========================================================================
    console.log('Example 4: Updating decision with lessons from challenges\n');

    await engine.updateDecisionOutcome(
      decisionId2,
      `
        Modular Monolith implementation completed after 4 months (1 month over 
        estimate). Results are mixed:
        
        Positive outcomes:
        - Deployment time reduced from 30 minutes to 5 minutes
        - Module boundaries are clear and enforced
        - Team coordination improved
        
        Challenges:
        - Database migrations still require coordination
        - Some modules are more coupled than expected
        - Shared infrastructure still causes occasional conflicts
      `.trim(),
      `
        Important lessons learned:
        
        1. Module Boundaries: Defining clear boundaries upfront is critical. We had 
           to refactor twice because initial boundaries were wrong. Invest time in 
           design phase.
        
        2. Database Strategy: Shared database is still a bottleneck. Should have 
           planned for schema per module from the start. Considering migration to 
           separate databases.
        
        3. Testing: Integration tests became more complex. Need better tooling for 
           testing module interactions.
        
        4. Team Discipline: Requires strong code review to prevent cross-module 
           coupling. Added automated checks in CI.
        
        5. Migration Path: Good decision to start with modular monolith. Now have 
           clear path to microservices if needed. Several modules are ready to be 
           extracted.
        
        Overall: Right decision for our stage. Would recommend for similar situations. 
        The key is strong architectural governance and clear module contracts.
      `.trim()
    );

    console.log(`✓ Updated decision ${decisionId2} with outcome`);
    console.log('  Status: Completed with mixed results');
    console.log('  Key learning: Module boundaries are critical\n');

    // ========================================================================
    // Example 5: Decision with negative outcome
    // ========================================================================
    console.log('Example 5: Storing a decision that didn\'t work out\n');

    const decision3 = {
      timestamp: Date.now(),
      context: `
        Database queries are slow for campaign analytics. Need to improve 
        performance for dashboard loading.
      `.trim(),
      reasoning: `
        Dashboard loads are taking 5-10 seconds. Users are complaining. 
        Quick analysis shows complex JOIN queries are the bottleneck.
      `.trim(),
      alternatives: JSON.stringify([
        {
          option: 'Add database indexes',
          pros: ['Quick to implement', 'Low risk', 'Proven solution'],
          cons: ['May not be enough', 'Write performance impact'],
          estimated_effort: '2 days',
        },
        {
          option: 'Implement caching layer',
          pros: ['Significant speedup', 'Reduces DB load'],
          cons: ['Cache invalidation complexity', 'More infrastructure'],
          estimated_effort: '1 week',
        },
        {
          option: 'Denormalize data',
          pros: ['Fastest queries', 'Simple to query'],
          cons: ['Data consistency challenges', 'Storage overhead'],
          estimated_effort: '2 weeks',
        },
      ]),
      chosen_option: 'Denormalize data',
      outcome: null,
      lessons_learned: null,
      affected_components: JSON.stringify([
        'src/analytics/aggregator.ts',
        'src/analytics/denormalized-tables.ts',
        'database/migrations/create_analytics_tables.sql',
      ]),
    };

    const decisionId3 = await engine.storeDecision(decision3);

    // Update with negative outcome
    await engine.updateDecisionOutcome(
      decisionId3,
      `
        FAILED: Denormalization approach abandoned after 3 weeks.
        
        Problems encountered:
        - Data consistency issues were worse than expected
        - Synchronization logic became very complex
        - Found bugs in production where denormalized data was stale
        - Team spent more time debugging sync issues than original problem
        
        Rolled back to original schema. Implemented caching layer instead, 
        which solved the problem in 4 days.
      `.trim(),
      `
        Critical lessons learned:
        
        1. Start Simple: Should have tried indexes first. Jumped to complex 
           solution too quickly. Always try simplest solution first.
        
        2. Proof of Concept: Should have built small POC before full implementation. 
           Would have discovered sync complexity earlier.
        
        3. Data Consistency: Underestimated the importance of data consistency for 
           analytics. Users need accurate data more than fast data.
        
        4. Team Experience: Team had no experience with denormalization patterns. 
           Should have factored this into decision.
        
        5. Incremental Approach: Caching layer was the right middle ground. Could 
           have saved 2 weeks by choosing this first.
        
        This was an expensive lesson. In retrospect, the warning signs were there:
        - No one on team had done this before
        - Complexity seemed high for the problem
        - Simpler alternatives weren't fully explored
        
        Always validate assumptions with small experiments before committing to 
        complex solutions.
      `.trim()
    );

    console.log(`✓ Stored and updated decision: ${decisionId3}`);
    console.log('  Status: Failed - rolled back');
    console.log('  Key learning: Start with simplest solution first\n');

    // ========================================================================
    // Summary
    // ========================================================================
    console.log('=== Summary ===\n');
    console.log('Demonstrated decision storage capabilities:');
    console.log('✓ Store decisions with context, reasoning, alternatives, chosen option');
    console.log('✓ Link decisions to affected code components');
    console.log('✓ Update decisions with outcomes (both positive and negative)');
    console.log('✓ Capture detailed lessons learned for future reference');
    console.log('\nAll requirements (2.1, 2.2, 2.5) satisfied.');

  } finally {
    // Clean up
    engine.close();
  }
}

// Run the example
main().catch(console.error);
