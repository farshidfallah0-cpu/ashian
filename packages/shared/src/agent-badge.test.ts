import { describe, expect, it } from 'vitest';
import { AGENT_BADGE, isTopAgent, topAgentGaps, type AgentBadgeInput } from './agent-badge.js';

const good: AgentBadgeInput = {
  verified: true,
  rating: 4.8,
  reviewCount: 25,
  avgResponseMinutes: 20,
  avgQuality: 70,
  activeListings: 8,
  violations: 0,
};

describe('isTopAgent', () => {
  it('مشاور خوب نشان می‌گیرد', () => {
    expect(isTopAgent(good)).toBe(true);
  });
  it('هر معیار به‌تنهایی می‌تواند مانع شود', () => {
    expect(isTopAgent({ ...good, verified: false })).toBe(false);
    expect(isTopAgent({ ...good, rating: 4.2 })).toBe(false);
    expect(isTopAgent({ ...good, reviewCount: 3 })).toBe(false);
    expect(isTopAgent({ ...good, avgResponseMinutes: 240 })).toBe(false);
    expect(isTopAgent({ ...good, avgQuality: 30 })).toBe(false);
    expect(isTopAgent({ ...good, activeListings: 1 })).toBe(false);
    expect(isTopAgent({ ...good, violations: 1 })).toBe(false);
  });
  it('نبودن داده‌ی زمان پاسخ مانع نیست (جریمه‌ی «بدون داده» نداریم)', () => {
    expect(isTopAgent({ ...good, avgResponseMinutes: null })).toBe(true);
  });
  it('معیارها قابل تنظیم‌اند', () => {
    const strict = { ...AGENT_BADGE, minRating: 4.9 };
    expect(isTopAgent(good, strict)).toBe(false);
    expect(topAgentGaps(good, strict)).toHaveLength(1);
  });
  it('بدون امتیاز → دلیل می‌دهد', () => {
    expect(topAgentGaps({ ...good, rating: null }).length).toBeGreaterThan(0);
  });
});
