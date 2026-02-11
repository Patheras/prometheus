/**
 * Self-Modification Workflow Example
 * 
 * This example demonstrates how Prometheus analyzes its own code,
 * proposes improvements, requests user consultation, and applies
 * approved changes to the ANOTS development repository.
 * 
 * Workflow:
 * 1. Analyze Prometheus's own codebase
 * 2. Prioritize self-improvements
 * 3. Build consultation request
 * 4. Get user approval
 * 5. Create branch in ANOTS repo
 * 6. Apply changes
 * 7. Run tests
 * 8. Create PR
 * 9. Report back to user
 */

import {
  SelfAnalyzer,
  SelfImprovementPrioritizer,
  SelfModificationConsultant,
  createSelfModificationConsultant,
} from '../src/evolution';
import { ConsultationManager, createConsultationManager } from '../src/decision/consultation-manager';
import { AnotsWorkflow } from '../src/integrations/anots-workflow';
import { CodeQualityAnalyzer } from '../src/analysis/code-quality-analyzer';
import { DebtDetector } from '../src/analysis/debt-detector';

async function runSelfModificationWorkflow() {
  console.log('=== Prometheus Self-Modification Workflow ===\n');

  // Step 1: Initialize components
  console.log('1. Initializing components...');

  const config = {
    prometheusRepoPath: '/path/to/prometheus',
    anotsRepoPath: '/path/to/anots-dev',
    minROI: 2.0,
    maxSelfImprovementRatio: 0.2,
    runTestsBeforePR: true,
  };

  // Create analyzer components
  const qualityAnalyzer = new CodeQualityAnalyzer();
  const debtDetector = new DebtDetector();

  const selfAnalyzer = new SelfAnalyzer(
    {
      prometheusRepoPath: config.prometheusRepoPath,
      analysisInterval: 24 * 60 * 60 * 1000, // Daily
      triggerOnModification: true,
    },
    qualityAnalyzer,
    debtDetector
  );

  const prioritizer = new SelfImprovementPrioritizer({
    maxSelfImprovementRatio: config.maxSelfImprovementRatio,
    minROI: config.minROI,
    highImpactBoost: 1.5,
  });

  const consultationManager = createConsultationManager();

  const anotsWorkflow = new AnotsWorkflow({
    repoPath: config.anotsRepoPath,
    baseBranch: 'main',
    branchPrefix: 'prometheus/',
    runTestsBeforePR: config.runTestsBeforePR,
    testCommand: 'npm test',
  });

  const consultant = createSelfModificationConsultant(
    config,
    selfAnalyzer,
    prioritizer,
    consultationManager,
    anotsWorkflow
  );

  console.log('✓ Components initialized\n');

  // Step 2: Analyze self-code and propose improvements
  console.log('2. Analyzing Prometheus codebase...');

  const proposal = await consultant.analyzeSelfAndPropose();

  if (!proposal) {
    console.log('✓ No self-improvements needed at this time\n');
    return;
  }

  console.log(`✓ Identified ${proposal.improvements.length} improvements\n`);

  // Step 3: Display proposal details
  console.log('3. Proposal Details:');
  console.log(`   ID: ${proposal.id}`);
  console.log(`   Files: ${proposal.files.length}`);
  console.log(`   Effort: ${proposal.estimatedEffort} hours`);
  console.log(`   ROI: ${proposal.prioritizedWork.roiMetrics.averageROI.toFixed(2)}`);
  console.log(`   High-ROI improvements: ${proposal.prioritizedWork.roiMetrics.highROICount}`);
  console.log('\n   Improvements:');
  proposal.improvements.forEach((improvement, index) => {
    console.log(`   ${index + 1}. [${improvement.priority}] ${improvement.description}`);
    console.log(`      Location: ${improvement.location}`);
    console.log(`      Suggestion: ${improvement.suggestion}`);
  });
  console.log();

  // Step 4: Request consultation
  console.log('4. Requesting user consultation...');

  const consultationResult = await consultant.requestConsultation(proposal.id);

  if (!consultationResult.required) {
    console.log('✓ Consultation not required (low impact)\n');
    // Could auto-apply here if desired
    return;
  }

  console.log(`✓ Consultation request created: ${consultationResult.requestId}\n`);

  // Step 5: Simulate user approval
  // In a real system, this would come from the admin portal UI
  console.log('5. Waiting for user approval...');
  console.log('   (In production, user would review via admin.anots.com)\n');

  const userFeedback = {
    approved: true,
    comments: 'Looks good, proceed with improvements',
    confidence: 85,
    guidance: 'Focus on high-ROI improvements first',
  };

  console.log(`✓ User approved: ${userFeedback.comments}\n`);

  // Step 6: Apply approved modification
  console.log('6. Applying approved self-modification...');

  const result = await consultant.applyApprovedModification(proposal.id, userFeedback);

  if (!result.approved) {
    console.log('✗ Modification was rejected\n');
    return;
  }

  console.log('✓ Modification applied successfully\n');

  // Step 7: Display results
  console.log('7. Results:');
  console.log(`   Branch: ${result.pullRequest?.branch}`);
  console.log(`   PR Title: ${result.pullRequest?.title}`);
  console.log(`   Files Changed: ${result.pullRequest?.filesChanged.length}`);
  console.log(`   Tests Run: ${result.testResults?.passed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log();

  if (result.pullRequest) {
    console.log('   Pull Request Details:');
    console.log(`   - Base Branch: ${result.pullRequest.baseBranch}`);
    console.log(`   - Files Changed:`);
    result.pullRequest.filesChanged.forEach((file) => {
      console.log(`     • ${file}`);
    });
    console.log();
  }

  // Step 8: Next steps
  console.log('8. Next Steps:');
  console.log('   ✓ PR created and ready for review');
  console.log('   ✓ User can review and merge via GitHub');
  console.log('   ✓ Prometheus will track outcome for learning');
  console.log();

  console.log('=== Workflow Complete ===');
}

// Example: Periodic self-improvement check
async function periodicSelfImprovement() {
  console.log('=== Periodic Self-Improvement Check ===\n');

  // This would run on a schedule (e.g., daily)
  // and automatically propose improvements when found

  const config = {
    prometheusRepoPath: '/path/to/prometheus',
    anotsRepoPath: '/path/to/anots-dev',
    minROI: 2.0,
    maxSelfImprovementRatio: 0.2,
    runTestsBeforePR: true,
  };

  // Initialize components (same as above)
  // ...

  console.log('Checking for self-improvement opportunities...');

  // Run analysis
  // const proposal = await consultant.analyzeSelfAndPropose();

  // if (proposal) {
  //   console.log(`Found ${proposal.improvements.length} improvements`);
  //   console.log('Sending notification to admin portal...');
  //   // Send notification to admin portal
  //   // User can review and approve via UI
  // } else {
  //   console.log('No improvements needed at this time');
  // }
}

// Example: Self-improvement after deployment
async function postDeploymentSelfImprovement() {
  console.log('=== Post-Deployment Self-Improvement ===\n');

  // After Prometheus is deployed with new features,
  // analyze if those features could be improved

  console.log('Analyzing recently deployed code...');

  // Get list of recently modified files
  const recentlyModified = [
    'src/evolution/self-analyzer.ts',
    'src/evolution/self-improvement-prioritizer.ts',
  ];

  console.log(`Analyzing ${recentlyModified.length} recently modified files...`);

  // Run targeted analysis on those files
  // const proposal = await consultant.analyzeSelfAndPropose();

  // if (proposal) {
  //   const relevantImprovements = proposal.improvements.filter((i) =>
  //     recentlyModified.some((file) => i.location.startsWith(file))
  //   );
  //
  //   if (relevantImprovements.length > 0) {
  //     console.log(`Found ${relevantImprovements.length} improvements in recent code`);
  //     // Request consultation
  //   }
  // }
}

// Run the example
if (require.main === module) {
  runSelfModificationWorkflow()
    .then(() => {
      console.log('\nExample completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nExample failed:', error);
      process.exit(1);
    });
}

export {
  runSelfModificationWorkflow,
  periodicSelfImprovement,
  postDeploymentSelfImprovement,
};
