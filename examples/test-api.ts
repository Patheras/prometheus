/**
 * Example API Client
 * 
 * Test the Prometheus API endpoints
 */

const API_URL = 'http://localhost:3001';

// Test code for quality analysis
const testCode = `
function complexFunction(a: number, b: string, c: boolean, d: object, e: any, f: number) {
  // TODO: Refactor this
  if (a > 10) {
    if (b.length > 5) {
      if (c) {
        if (d) {
          if (e) {
            return a * 3.14159 + 42;
          }
        }
      }
    }
  }
  return 0;
}

class LargeClass {
  method1() { console.log(1); }
  method2() { console.log(2); }
  method3() { console.log(3); }
  method4() { console.log(4); }
  method5() { console.log(5); }
  method6() { console.log(6); }
  method7() { console.log(7); }
  method8() { console.log(8); }
  method9() { console.log(9); }
  method10() { console.log(10); }
}
`;

async function testHealthCheck() {
  console.log('🔍 Testing health check...');
  const response = await fetch(`${API_URL}/health`);
  const data = await response.json();
  console.log('✅ Health:', data);
  console.log('');
}

async function testQualityAnalysis() {
  console.log('🔍 Testing code quality analysis...');
  const response = await fetch(`${API_URL}/api/analyze/quality`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filePath: 'test.ts',
      sourceCode: testCode,
    }),
  });

  const data = await response.json();
  console.log('✅ Quality Analysis Results:');
  console.log(`   Quality Score: ${data.qualityScore}/100`);
  console.log(`   Issues Found: ${data.issues.length}`);
  console.log(`   Complexity: ${data.complexity.cyclomaticComplexity}`);
  console.log('');

  if (data.issues.length > 0) {
    console.log('   Top Issues:');
    data.issues.slice(0, 3).forEach((issue: any, i: number) => {
      console.log(`   ${i + 1}. [${issue.severity}] ${issue.description}`);
    });
    console.log('');
  }

  return data.issues;
}

async function testSuggestions(issues: any[]) {
  console.log('🔍 Testing suggestion generation...');
  const response = await fetch(`${API_URL}/api/suggestions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issues: issues.slice(0, 2) }),
  });

  const data = await response.json();
  console.log('✅ Suggestions:');
  data.suggestions.forEach((item: any, i: number) => {
    console.log(`   ${i + 1}. ${item.issue.description}`);
    console.log(`      ${item.suggestion.split('\n')[0]}`);
  });
  console.log('');
}

async function testDebtDetection() {
  console.log('🔍 Testing technical debt detection...');
  const response = await fetch(`${API_URL}/api/analyze/debt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codebasePath: './src',
      options: {
        includeOutdatedDeps: false,
        includeMissingTests: true,
        includeTodoComments: true,
        includeArchitecturalViolations: true,
      },
    }),
  });

  const data = await response.json();
  console.log('✅ Technical Debt Summary:');
  console.log(`   Total Items: ${data.summary.totalItems}`);
  console.log(`   Total Hours: ${data.summary.totalHours}`);
  console.log(`   Requires Consultation: ${data.thresholds.requiresConsultation}`);
  console.log('');

  if (Object.keys(data.summary.byType).length > 0) {
    console.log('   Debt by Type:');
    Object.entries(data.summary.byType).forEach(([type, count]) => {
      console.log(`   • ${type}: ${count}`);
    });
    console.log('');
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Prometheus API Test Client                          ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    await testHealthCheck();
    const issues = await testQualityAnalysis();
    if (issues.length > 0) {
      await testSuggestions(issues);
    }
    await testDebtDetection();

    console.log('✨ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
