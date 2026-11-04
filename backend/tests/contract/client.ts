/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance } from 'fastify';
import { assertRequestMatches, assertResponseMatches } from './helper.js';

// Máy khách kiểm thử gọi API qua `inject` và tự đối chiếu request/response với openapi.yaml (T023):
// mã trạng thái PHẢI được hợp đồng khai báo và thân phản hồi PHẢI khớp schema.

export interface CallOptions {
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  /** Đặt false để bỏ qua đối chiếu request (gửi cố ý dữ liệu sai). */
  validateRequest?: boolean;
  /** Đặt false để bỏ qua đối chiếu response (mã/thân ngoài hợp đồng, ví dụ 401 thiếu token ở route chỉ khai báo 204). */
  validateResponse?: boolean;
}

export interface CallResult<T = any> {
  status: number;
  body: T;
  headers: Record<string, unknown>;
}

export class ContractClient {
  constructor(private readonly app: FastifyInstance) {}

  async call<T = any>(
    method: string,
    url: string,
    options: CallOptions = {},
  ): Promise<CallResult<T>> {
    if (options.body !== undefined && options.validateRequest !== false) {
      assertRequestMatches(method, url, options.body);
    }
    const headers: Record<string, string> = { ...options.headers };
    if (options.token) headers.authorization = `Bearer ${options.token}`;

    const response = await this.app.inject({
      method: method.toUpperCase() as 'GET',
      url: `/api/v1${url}`,
      headers,
      ...(options.body !== undefined ? { payload: options.body as object } : {}),
    });
    const body = response.body ? JSON.parse(response.body) : undefined;
    if (options.validateResponse !== false) {
      assertResponseMatches(method, url, response.statusCode, body);
    }
    return { status: response.statusCode, body: body as T, headers: response.headers };
  }

  get<T = any>(url: string, options?: CallOptions) {
    return this.call<T>('get', url, options);
  }
  post<T = any>(url: string, options?: CallOptions) {
    return this.call<T>('post', url, options);
  }
  put<T = any>(url: string, options?: CallOptions) {
    return this.call<T>('put', url, options);
  }
  patch<T = any>(url: string, options?: CallOptions) {
    return this.call<T>('patch', url, options);
  }
}

export interface RegisteredUser {
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

let counter = 0;

/** Đăng ký một tài khoản mới (email duy nhất) và trả token. */
export async function registerUser(
  client: ContractClient,
  overrides: Record<string, unknown> = {},
): Promise<RegisteredUser> {
  counter += 1;
  const email = `learner${counter}-${Date.now()}@example.com`;
  const password = 'Matkhau-Tot-123';
  const { status, body } = await client.post('/auth/register', {
    body: { email, password, displayName: `Người học ${counter}`, ...overrides },
  });
  if (status !== 201) throw new Error(`Đăng ký thất bại: ${status} ${JSON.stringify(body)}`);
  return { email, password, accessToken: body.accessToken, refreshToken: body.refreshToken };
}

/** Bản nháp onboarding đầy đủ cho người mới 10 phút/ngày (bỏ qua placement). */
export function newcomerOnboarding(overrides: Record<string, unknown> = {}) {
  return {
    currentLevel: 'none',
    goalType: 'daily_conversation',
    dailyMinutes: 10,
    skills: ['vocabulary', 'grammar'],
    ...overrides,
  };
}
