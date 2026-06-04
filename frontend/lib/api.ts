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

// ===== TIKTOK =====
export const tiktokApi = {
  connect: (campaignId: number, uniqueId: string) =>
    api.post(`/tiktok/connect/${campaignId}`, null, { params: { unique_id: uniqueId } }).then((r) => r.data),
  disconnect: (sessionId: number) =>
    api.post(`/tiktok/disconnect/${sessionId}`).then((r) => r.data),
  active: () => api.get("/tiktok/active").then((r) => r.data),
  setAutoReply: (sessionId: number, enabled: boolean, voice?: string) =>
    api.post(`/tiktok/auto-reply/${sessionId}`, null, { params: { enabled, voice: voice || "nova" } }).then((r) => r.data),
};

// ===== TEAM =====
export const teamApi = {
  members: () => api.get("/auth/members").then((r) => r.data),
  invite: (email: string, role: string) =>
    api.post("/auth/invite", { email, role }).then((r) => r.data),
  updateRole: (userId: number, role: string) =>
    api.put(`/auth/members/${userId}/role`, { role }).then((r) => r.data),
  removeMember: (userId: number) =>
    api.delete(`/auth/members/${userId}`).then((r) => r.data),
};

// ===== HEYGEN =====
export const heygenApi = {
  token: () => api.get("/heygen/token").then((r) => r.data),
  avatars: () => api.get("/heygen/avatars").then((r) => r.data),
  startAvatar: (data: { session_id: number; avatar_id?: string; rtmp_url: string; stream_key?: string }) =>
    api.post("/heygen/avatar/start", data).then((r) => r.data),
  speak: (session_id: number, text: string) =>
    api.post("/heygen/avatar/speak", { session_id, text }).then((r) => r.data),
  stopAvatar: (session_id: number) =>
    api.post("/heygen/avatar/stop", null, { params: { session_id } }).then((r) => r.data),
  status: (session_id: number) =>
    api.get(`/heygen/avatar/status/${session_id}`).then((r) => r.data),
};

// ===== STREAM =====
export const streamApi = {
  accounts: () => api.get("/stream/accounts").then((r) => r.data),
  createAccount: (data: any) => api.post("/stream/accounts", data).then((r) => r.data),
  deleteAccount: (id: number) => api.delete(`/stream/accounts/${id}`).then((r) => r.data),
  startStream: (campaignId: number, platform: string, tiktokUniqueId?: string) => {
    const params: any = { platform };
    if (tiktokUniqueId) params.tiktok_unique_id = tiktokUniqueId;
    return api.post(`/stream/start/${campaignId}`, null, { params }).then((r) => r.data);
  },
  stopStream: (sessionId: number) => api.post(`/stream/stop/${sessionId}`).then((r) => r.data),
  getStatus: (sessionId: number) => api.get(`/stream/status/${sessionId}`).then((r) => r.data),
  getSessions: (campaignId: number) => api.get(`/stream/sessions/${campaignId}`).then((r) => r.data),
};

// ===== PLATFORM CONFIG (credentials via UI) =====
export const platformConfigApi = {
  getAll: () => api.get("/platform-config/").then((r) => r.data),
  get: (platform: string) => api.get(`/platform-config/${platform}`).then((r) => r.data),
  save: (platform: string, values: Record<string, string>) =>
    api.put(`/platform-config/${platform}`, { values }).then((r) => r.data),
  delete: (platform: string) => api.delete(`/platform-config/${platform}`).then((r) => r.data),
  importEnv: (platform: string) =>
    api.post(`/platform-config/${platform}/import-env`).then((r) => r.data),
  importEnvAll: () =>
    api.post("/platform-config/import-env-all").then((r) => r.data),
};

// ===== PLATFORMS (Facebook / YouTube auto-live) =====
export const platformApi = {
  list: () => api.get("/platforms/").then((r) => r.data),
  connectUrl: (platform: string) => api.get(`/platforms/${platform}/connect`).then((r) => r.data),
  disconnect: (platform: string) => api.delete(`/platforms/${platform}`).then((r) => r.data),
  startLive: (data: { platform: string; campaign_id: number; title: string; description?: string }) =>
    api.post("/platforms/live/start", data).then((r) => r.data),
  endLive: (platform: string, live_id: string) =>
    api.post("/platforms/live/end", { platform, live_id }).then((r) => r.data),
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
