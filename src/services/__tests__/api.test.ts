import { apiClient } from '../api';
import type { SkillIdea, SkillProposal } from '../types';

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

jest.mock('../auth', () => ({
  auth: {
    getAccessToken: () => 'tok-123',
    getValidAccessToken: () => Promise.resolve('tok-123'),
  },
}));

describe('apiClient skill methods', () => {
  const fetchMock = jest.fn();
  const proposal: SkillProposal = {
    title: 'Pot Botol PET',
    description: 'Pot gantung dari botol bekas.',
    material: 'plastik_pet',
    difficulty: 'pemula',
    steps: [{ order: 1, instruction: 'Cuci botol', warning: 'Sarung tangan' }],
    tools: [{ name: 'gunting', optional: false }],
    additional_materials: [],
    est_cost_idr: 5000,
    est_price_idr: 25000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = fetchMock;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ proposals: [proposal] }),
    });
  });

  it('getSkillIdeas posts material and attaches bearer token', async () => {
    await apiClient.getSkillIdeas({ material: 'plastik_pet', condition: 'bersih' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/skills/proposals');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ material: 'plastik_pet', condition: 'bersih' });
    expect(init.headers.Authorization).toBe('Bearer tok-123');
  });

  it('expandSkillProposal posts idea to /skills/proposals/expand', async () => {
    const idea: SkillIdea = {
      title: 'Pot Botol PET',
      description: 'Pot gantung dari botol bekas.',
      material: 'plastik_pet',
      difficulty: 'pemula',
      est_cost_idr: 5000,
      est_price_idr: 25000,
    };
    await apiClient.expandSkillProposal({
      material: 'plastik_pet',
      condition: 'bersih',
      idea,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/skills/proposals/expand');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      material: 'plastik_pet',
      condition: 'bersih',
      idea,
    });
  });

  it('verifySkill posts draft and chat history', async () => {
    await apiClient.verifySkill({ draft: proposal, chat_history: [] });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).draft.title).toBe('Pot Botol PET');
  });

  it('createSkill posts to /skills', async () => {
    await apiClient.createSkill(proposal);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/skills');
    expect(init.method).toBe('POST');
  });

  it('createSkill sends ai_verdict in body', async () => {
    await apiClient.createSkill({ ...proposal, ai_verdict: 'layak' });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).ai_verdict).toBe('layak');
  });

  it('getSkills builds mine query param', async () => {
    await apiClient.getSkills({ status: 'pending', mine: true });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('status=pending');
    expect(url).toContain('mine=true');
  });

  it('getSkills with no params hits plain /skills', async () => {
    await apiClient.getSkills();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/skills');
    expect(url).not.toContain('?');
  });

  it('updateSkillStatus patches status with bearer token', async () => {
    await apiClient.updateSkillStatus('s1', { status: 'approved', reviewed_by: 'expert-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/skills/s1/status');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'approved', reviewed_by: 'expert-1' });
    expect(init.headers.Authorization).toBe('Bearer tok-123');
  });

  it('completeSkill posts multipart with auth to /skills/{id}/complete', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
      blob: async () => new Blob(['fake-image']),
    });
    await apiClient.completeSkill('s1', 'file:///tmp/x.jpg', 5, 'mantap');
    const [url, init] = (global.fetch as jest.Mock).mock.calls[1];
    expect(url).toContain('/skills/s1/complete');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('getSkillCompletions hits /skills/{id}/completions', async () => {
    await apiClient.getSkillCompletions('s1');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/skills/s1/completions');
  });
});
