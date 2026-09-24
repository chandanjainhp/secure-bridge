import { describe, it, expect } from 'vitest';

describe('Feature exports', () => {
  it('should have usage exports', async () => {
    const mod = await import('@/features/usage');
    expect(mod.useUsageStore).toBeDefined();
    expect(mod.UsageDashboard).toBeDefined();
  });
});
