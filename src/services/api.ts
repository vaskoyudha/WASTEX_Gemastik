const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

export const apiClient = {
  async scan(imageUri: string) {
    // Convert URI to FormData for file upload
    const formData = new FormData();
    const response = await fetch(imageUri);
    const blob = await response.blob();
    formData.append('file', blob, 'scan.jpg');

    const res = await fetch(`${API_BASE}/scan`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Scan failed' }));
      throw new Error(error.detail);
    }

    return res.json();
  },

  async recommend(data: { scan_id?: string; material?: string; condition?: string; user_intent: string }) {
    return request('/recommend', {
      method: 'POST',
      body: data,
    });
  },

  async getSkills(params?: { status?: string; material?: string }) {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return request(`/skills${query}`);
  },

  async getSkill(id: string) {
    return request(`/skills/${id}`);
  },

  async createSkill(data: any) {
    return request('/skills', { method: 'POST', body: data });
  },

  async updateSkillStatus(id: string, data: { status: string; reviewed_by?: string }) {
    return request(`/skills/${id}/status`, { method: 'PATCH', body: data });
  },

  async getProducts(params?: { limit?: number; offset?: number }) {
    const query = params
      ? `?${new URLSearchParams(
          Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
        )}`
      : '';
    return request(`/products${query}`);
  },

  async getProduct(id: string) {
    return request(`/products/${id}`);
  },

  async getTutorial(skillId: string) {
    return request(`/tutorial/${skillId}`);
  },

  async getPricing(skillId: string) {
    return request(`/pricing/${skillId}`);
  },

  async getMarketplace() {
    return request('/selling');
  },

  async healthCheck() {
    return request('/health');
  },
};
