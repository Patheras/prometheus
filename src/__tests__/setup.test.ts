/**
 * Basic setup test to verify testing infrastructure
 */

describe('Prometheus Setup', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should have correct Node version', () => {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] || '0', 10);
    expect(majorVersion).toBeGreaterThanOrEqual(18);
  });
});
