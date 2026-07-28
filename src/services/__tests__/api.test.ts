import { apiClient } from '../api';

describe('apiClient', () => {
  it('should have scan method', () => {
    expect(typeof apiClient.scan).toBe('function');
  });

  it('should have recommend method', () => {
    expect(typeof apiClient.recommend).toBe('function');
  });

  it('should have getSkills method', () => {
    expect(typeof apiClient.getSkills).toBe('function');
  });

  it('should have healthCheck method', () => {
    expect(typeof apiClient.healthCheck).toBe('function');
  });
});
