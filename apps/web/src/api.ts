import type {
  AdminPlayer,
  LeaderboardResponse,
  SessionResponse,
  InventoryResponse,
  AchievementResponse,
  Skin,
  PublicProfile,
  ProfileEdit,
  RankingResponse,
  RankingPeriod,
  GameMode,
  ModerationAction,
  ModerationResult,
  CommandSuggestion,
  ControlPreferencesEdit,
  ControlPreferencesResponse,
} from '@supadub/protocol';
import type { EquipRequest } from '@supadub/cosmetics';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function request<T>(path: string, body?: unknown): Promise<T> {
  try {
    const response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const data: unknown = await response.json();
    if (!response.ok) {
      const details = data && typeof data === 'object' ? data : {};
      const message = 'message' in details ? details.message : 'error' in details ? details.error : null;
      throw new ApiError(
        typeof message === 'string' ? message : 'The pool is unavailable. Try again.',
        response.status,
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
      throw new ApiError('The pool took too long to reply. Try again.', 408);
    throw new ApiError('The pool could not reply. Check the connection and try again.', 0);
  }
}

export const api = {
  features: () =>
    request<{ protocolVersion: number; features: { id: string; enabled: boolean; active: boolean }[] }>(
      '/features',
    ),
  commands: () => request<{ suggestions: CommandSuggestion[] }>('/commands'),
  profile: (id: string) => request<PublicProfile>(`/profiles/${encodeURIComponent(id)}`),
  editProfile: (edit: ProfileEdit) => request<PublicProfile>('/profile', edit),
  rankings: (mode: GameMode, period: RankingPeriod) =>
    request<RankingResponse>(`/rankings?mode=${mode}&period=${period}`),
  staffPlayers: () => request<{ players: AdminPlayer[]; audit: unknown[] }>('/moderation/players'),
  moderate: (action: Omit<ModerationAction, 'requestId'> & { requestId?: string }) =>
    request<ModerationResult>('/moderation/actions', {
      ...action,
      requestId: action.requestId ?? crypto.randomUUID(),
    }),
  session: () => request<SessionResponse>('/auth/me'),
  controlPreferences: () => request<ControlPreferencesResponse>('/preferences/controls'),
  saveControlPreferences: (edit: ControlPreferencesEdit) =>
    request<ControlPreferencesResponse>('/preferences/controls', edit),
  signIn: (username: string, password: string) =>
    request<SessionResponse>('/auth/login', { username, password }),
  register: (username: string, password: string, name: string) =>
    request<SessionResponse>('/auth/register', { username, password, name }),
  signOut: () => request<SessionResponse>('/auth/logout', {}),
  players: () => request<{ players: AdminPlayer[]; audit: unknown[] }>('/admin/players'),
  ban: (id: string, reason: string) => request('/admin/ban', { id, reason }),
  unban: (id: string) => request('/admin/unban', { id }),
  scores: () => request<LeaderboardResponse>('/leaderboard'),
  inventory: () => request<InventoryResponse>('/inventory'),
  achievements: () => request<AchievementResponse>('/achievements'),
  equip: (itemId: Skin, revision: number) =>
    request<InventoryResponse>('/inventory/equip', { itemId, revision }),
  equipItem: (requestData: EquipRequest) => request<InventoryResponse>('/inventory/equip', requestData),
  mute: (id: string, reason: string, durationMinutes = 15) =>
    request('/admin/mute', { id, reason, durationMinutes }),
  unmute: (id: string) => request('/admin/unmute', { id }),
  deleteMessage: (id: string) => request('/admin/chat-delete', { id }),
};
