import type { RouteShorthandOptions } from 'fastify';

/** Tùy chọn route cho `/admin/*`: xác thực rồi yêu cầu vai trò admin (FR-004); bảo vệ thực sự ở server. */
export type AdminGuard = Required<Pick<RouteShorthandOptions, 'preHandler'>>;
