import axios from "axios";

export const apiClient = axios.create({ baseURL: "" });

export function setAuthToken(token: string | null): void {
  if (token) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common["Authorization"];
  }
}

let refreshFn: (() => Promise<string | null>) | null = null;

export function setRefreshFunction(fn: () => Promise<string | null>): void {
  refreshFn = fn;
}

let logoutFn: (() => void) | null = null;

export function setLogoutFunction(fn: () => void): void {
  logoutFn = fn;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (original.url?.startsWith("/api/auth/")) return Promise.reject(error);
    if (error.response?.status === 401 && !original._retry && refreshFn) {
      original._retry = true;
      const newToken = await refreshFn();
      if (newToken) {
        original.headers["Authorization"] = `Bearer ${newToken}`;
        return apiClient(original);
      }
      logoutFn?.();
    }
    return Promise.reject(error);
  },
);

// ─── Auth API ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  email: string;
  username?: string;
  is_superuser: boolean;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/api/auth/login", { email, password });
  return data;
}

export async function refreshToken(token: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/api/auth/refresh", {
    refresh_token: token,
  });
  return data;
}

// ─── Chat Types ────────────────────────────────────────────────────────────

export interface ChatAction {
  button_text: string;
  button_action: string;
  button_type: "primary" | "secondary" | "destructive";
  button_icon?: string;
  completion_message?: string;
}

export interface ChatActionContext {
  command_name: string;
  context: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "status";
  content: string;
  timestamp: number;
  actions?: ChatAction[];
  actionContext?: ChatActionContext;
  actionPreview?: string;
}

export interface ChatStreamEvent {
  type: "status" | "delta" | "done" | "error";
  text?: string;
  message?: string;
  conversation_id?: string;
  full_text?: string;
  stop_reason?: string;
  actions?: ChatAction[];
  action_context?: ChatActionContext;
  action_preview?: string;
}

export interface NodeToolsResponse {
  client_tools: Record<string, unknown>[];
  available_commands: Record<string, unknown>[];
  cached: boolean;
}

// ─── Chat API ──────────────────────────────────────────────────────────────

function parseSSEChunk(text: string): ChatStreamEvent[] {
  const events: ChatStreamEvent[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("data: ")) continue;
    try {
      events.push(JSON.parse(trimmed.slice(6)) as ChatStreamEvent);
    } catch {
      // Incomplete JSON — skip
    }
  }
  return events;
}

export async function sendChatMessage(
  payload: {
    message: string;
    node_id: string;
    household_id: string;
    conversation_id?: string;
    timezone?: string;
    client_tools?: Record<string, unknown>[];
    available_commands?: Record<string, unknown>[];
  },
  accessToken: string,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/cc/mobile/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (res.status === 401) throw new Error("Session expired — please log in again.");
  if (!res.ok) throw new Error(`Chat failed (${res.status})`);
  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const event of parseSSEChunk(chunk)) {
      onEvent(event);
    }
  }
}

export async function warmupChat(
  nodeId: string,
  householdId: string,
  _accessToken: string,
  clientTools?: Record<string, unknown>[],
  availableCommands?: Record<string, unknown>[],
  timezone?: string,
): Promise<{ conversation_id: string; tools_loaded: number }> {
  const { data } = await apiClient.post<{ conversation_id: string; tools_loaded: number }>(
    "/api/cc/mobile/chat/warmup",
    {
      node_id: nodeId,
      household_id: householdId,
      timezone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(clientTools ? { client_tools: clientTools } : {}),
      ...(availableCommands ? { available_commands: availableCommands } : {}),
    },
  );
  return data;
}

export async function fetchNodeTools(nodeId: string): Promise<NodeToolsResponse> {
  const { data } = await apiClient.get<NodeToolsResponse>(
    `/api/cc/mobile/nodes/${nodeId}/tools`,
  );
  return data;
}

export interface NodeInfo {
  node_id: string;
  room: string | null;
  user: string | null;
  voice_mode: string;
}

export async function fetchNodes(): Promise<NodeInfo[]> {
  const res = await fetch("/api/cc/admin/nodes");
  if (!res.ok) return [];
  return res.json();
}

export interface Household {
  id: string;
  name: string;
  role: string;
}

export async function fetchHouseholds(accessToken: string): Promise<Household[]> {
  const res = await fetch("/api/households", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  return res.json();
}
