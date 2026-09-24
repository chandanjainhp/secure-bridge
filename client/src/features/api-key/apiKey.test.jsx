import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

describe('Feature imports', () => {
  it('should import api key module', async () => {
    const mod = await import('@/features/api-key');
    expect(mod).toBeDefined();
  });

  it('should import usage module', async () => {
    const mod = await import('@/features/usage');
    expect(mod).toBeDefined();
  });
});
