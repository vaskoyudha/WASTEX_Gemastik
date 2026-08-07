import type { ChatMessage, SkillCompletionsSummary, SkillIdea, SkillProposal, SkillVerifyResponse } from './types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://localhost:54321';

export type VisualKind = 'storyboard' | 'materials' | 'before_after' | 'mockup';

export interface GeneratedVisual {
  skill_id: string;
  kind: VisualKind;
  step: number | null;
  image_path: string;
  cached: boolean;
}

/** URL publik gambar visual di bucket storage `visuals`. */
export function visualUrl(imagePath: string): string {
  return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/visuals/${imagePath}`;
}

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

  if (response.status === 204) {
    return undefined as unknown as T;
  }
  return response.json();
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { auth } = require('./auth');
    const token = await auth.getValidAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
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

  async getSkills(params?: { status?: string; material?: string; mine?: boolean }) {
    const parts: string[] = [];
    if (params?.status) parts.push(`status=${params.status}`);
    if (params?.material) parts.push(`material=${params.material}`);
    if (params?.mine) parts.push('mine=true');
    const query = parts.length ? `?${parts.join('&')}` : '';
    return request(`/skills${query}`, { headers: await authHeaders() });
  },

  async getSkill(id: string) {
    return request(`/skills/${id}`);
  },

  async completeSkill(skillId: string, imageUri: string, rating: number, comment?: string) {
    const formData = new FormData();
    const response = await fetch(imageUri);
    const blob = await response.blob();
    formData.append('file', blob, 'completion.jpg');
    formData.append('rating', String(rating));
    if (comment) formData.append('comment', comment);
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/skills/${skillId}/complete`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Submit gagal' }));
      const err = new Error(error.detail || `API error: ${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return res.json();
  },

  async getSkillCompletions(skillId: string): Promise<SkillCompletionsSummary> {
    return request(`/skills/${skillId}/completions`);
  },

  async getVisual(skillId: string, kind: VisualKind, step?: number): Promise<GeneratedVisual> {
    const query = step !== undefined ? `?step=${step}` : '';
    return request(`/visuals/${skillId}/${kind}${query}`);
  },

  async createSkill(data: SkillProposal & { reference_scan_id?: string; ai_verdict?: string | null }) {
    return request('/skills', { method: 'POST', body: data, headers: await authHeaders() });
  },

  async updateSkillStatus(id: string, data: { status: string; reviewed_by?: string }) {
    return request(`/skills/${id}/status`, {
      method: 'PATCH',
      body: data,
      headers: await authHeaders(),
    });
  },

  async getSkillIdeas(data: { material: string; condition: string }): Promise<SkillIdea[]> {
    return request('/skills/proposals', { method: 'POST', body: data, headers: await authHeaders() });
  },

  async expandSkillProposal(data: {
    material: string;
    condition: string;
    idea: SkillIdea;
  }): Promise<SkillProposal> {
    return request('/skills/proposals/expand', {
      method: 'POST',
      body: data,
      headers: await authHeaders(),
    });
  },

  async verifySkill(data: { draft: SkillProposal; chat_history: ChatMessage[] }): Promise<SkillVerifyResponse> {
    return request('/skills/verify', { method: 'POST', body: data, headers: await authHeaders() });
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

  async getSellingKit(skillId: string) {
    return request(`/selling/${skillId}`);
  },

  async logImpact(data: { skill_id?: string; material: string; waste_kg: number; est_value_idr: number }) {
    return request('/impact', { method: 'POST', body: data });
  },

  async register(data: {
    email: string;
    password: string;
    display_name: string;
    first_name?: string | null;
    last_name?: string | null;
    bio?: string | null;
    phone?: string | null;
  }) {
    return request('/auth/register', { method: 'POST', body: data });
  },

  async login(data: { email: string; password: string }) {
    return request('/auth/login', { method: 'POST', body: data });
  },

  async updateProfile(userId: string, data: {
    display_name?: string;
    first_name?: string | null;
    last_name?: string | null;
    bio?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  }) {
    return request(`/auth/profile/${userId}`, { method: 'PATCH', body: data });
  },

  async healthCheck() {
    return request('/health');
  },

  async deleteScan(scanId: string, token: string) {
    return request(`/scan/${scanId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
