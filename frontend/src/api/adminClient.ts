import { clearAdminToken, readAdminToken } from './auth';
import { requestJson, toApiError } from './client';

interface AdminRequestOptions<TBody> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function redirectToAdminLogin() {
  if (typeof window === 'undefined') {
    return;
  }
  const loginPath = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
  window.location.assign(loginPath);
}

export async function requestAdminJson<TResponse, TBody = unknown>(
  path: string,
  options: AdminRequestOptions<TBody> = {},
): Promise<TResponse> {
  const token = readAdminToken();

  try {
    return await requestJson<TResponse, TBody>(path, {
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 401 || apiError.status === 403) {
      clearAdminToken();
      redirectToAdminLogin();
    }
    throw apiError;
  }
}
