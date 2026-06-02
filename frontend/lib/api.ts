import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// Inject token on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ===== AUTH =====
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),
  register: (data: { email: string; password: string; full_name?: string; company_name?: string }) =>
    api.post("/auth/register", data).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
};

// ===== CAMPAIGNS =====
export const campaignApi = {
  list: () => api.get("/campaigns").then((r) => r.data),
  get: (id: number) => api.get(`/campaigns/${id}`).then((r) => r.data),
  create: (data: any) => api.post("/campaigns", data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/campaigns/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/campaigns/${id}`).then((r) => r.data),
  uploadAvatar: (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/campaigns/${id}/upload-avatar`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
  generateAvatar: (id: number, avatar_id: string, voice_id: string) =>
    api.post(`/campaigns/${id}/generate-avatar`, { avatar_id, voice_id }).then((r) => r.data),
  avatarStatus: (id: number) =>
    api.get(`/campaigns/${id}/avatar-status`).then((r) => r.data),
  heygenAvatars: () => api.get("/campaigns/heygen/avatars").then((r) => r.data),
  heygenVoices: () => api.get("/campaigns/heygen/voices").then((r) => r.data),
};

// ===== AI =====
export const aiApi = {
  generateScript: (data: {
    product_name: string;
    product_price?: string;
    product_highlights?: string;
    promotion?: string;
    language?: string;
    tone?: string;
    business_type?: string;
  }) => api.post("/ai/generate-script", data).then((r) => r.data),

  tts: (text: string, voice?: string) =>
    api.post("/ai/tts", { text, voice: voice || "nova" }).then((r) => r.data),

  replyComment: (comment: string, product_name?: string, language?: string) =>
    api.post("/ai/reply-comment", { comment, product_name, language: language || "th" }).then((r) => r.data),

  voices: () => api.get("/ai/voices").then((r) => r.data),
};

// ===== STREAM =====
export const streamApi = {
  accounts: () => api.get("/stream/accounts").then((r) => r.data),
  createAccount: (data: any) => api.post("/stream/accounts", data).then((r) => r.data),
  deleteAccount: (id: number) => api.delete(`/stream/accounts/${id}`).then((r) => r.data),
  startStream: (campaignId: number, platform: string) =>
    api.post(`/stream/start/${campaignId}?platform=${platform}`).then((r) => r.data),
  stopStream: (sessionId: number) => api.post(`/stream/stop/${sessionId}`).then((r) => r.data),
  getStatus: (sessionId: number) => api.get(`/stream/status/${sessionId}`).then((r) => r.data),
  getSessions: (campaignId: number) => api.get(`/stream/sessions/${campaignId}`).then((r) => r.data),
};

// ===== LEADS =====
export const leadsApi = {
  list: (campaignId?: number) =>
    api.get("/leads", { params: campaignId ? { campaign_id: campaignId } : {} }).then((r) => r.data),
  create: (data: any) => api.post("/leads", data).then((r) => r.data),
  delete: (id: number) => api.delete(`/leads/${id}`).then((r) => r.data),
};

// ===== ANALYTICS =====
export const analyticsApi = {
  overview: () => api.get("/analytics/overview").then((r) => r.data),
  campaign: (id: number) => api.get(`/analytics/campaigns/${id}`).then((r) => r.data),
};

export default api;
