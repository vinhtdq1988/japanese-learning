import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv, type ValidateFunction } from 'ajv';
import { default as addFormats } from 'ajv-formats';
import { parse } from 'yaml';

// Hạ tầng kiểm thử hợp đồng: đối chiếu request/response thực tế với `contracts/openapi.yaml`
// (T023). Tên route, trường JSON và mã lỗi PHẢI khớp hợp đồng.

const SPEC_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../specs/001-phase1-mvp/contracts/openapi.yaml',
);

type Json = Record<string, unknown>;

interface Operation {
  responses?: Record<string, Json>;
  requestBody?: Json;
  operationId?: string;
}

export interface MatchedOperation {
  /** Mẫu đường dẫn trong spec, ví dụ `/sessions/{sessionId}/answers`. */
  template: string;
  method: string;
  operation: Operation;
  operationId: string;
  pathParams: Record<string, string>;
}

let cached: { spec: Json; ajv: Ajv; validators: Map<string, ValidateFunction> } | null = null;

/**
 * OpenAPI 3.0.3 coi `null` chỉ hợp lệ nếu có trong `enum`; Ajv không tự thêm. Bổ sung `null` vào
 * `enum` của mọi schema `nullable: true` để phản hồi có giá trị null (ví dụ `scopeNotice`) hợp lệ.
 * Với thành ngữ `nullable: true` + `allOf: [$ref]` (ví dụ `ProfileUpdate.prioritizedSkill`) schema được
 * tham chiếu không cho `null`, nên `null` được thêm như một nhánh hợp lệ riêng.
 */
function allowNullInNullableEnums(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(allowNullInNullableEnums);
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  const obj = node as Json;
  if (obj.nullable === true && Array.isArray(obj.enum) && !obj.enum.includes(null)) {
    obj.enum = [...obj.enum, null];
  }
  if (obj.nullable === true && Array.isArray(obj.allOf)) {
    obj.anyOf = [{ type: 'null' }, { allOf: obj.allOf }];
    delete obj.allOf;
  }
  Object.values(obj).forEach(allowNullInNullableEnums);
}

function load() {
  if (cached) return cached;
  const spec = parse(readFileSync(SPEC_PATH, 'utf8')) as Json;
  allowNullInNullableEnums(spec);
  const ajv = new Ajv({ strict: false, allErrors: true });
  const applyFormats = (addFormats.default ?? addFormats) as unknown as (a: Ajv) => Ajv;
  applyFormats(ajv);
  // Đăng ký cả tài liệu để `$ref: '#/components/...'` bên trong phân giải được.
  ajv.addSchema({ $id: 'openapi', ...spec });
  cached = { spec, ajv, validators: new Map() };
  return cached;
}

/** Phiên bản hợp đồng (`info.version`) – dùng để kiểm tra nhật ký thay đổi khớp phiên bản. */
export function contractVersion(): string {
  return (load().spec.info as { version: string }).version;
}

/** Mọi `operationId` trong hợp đồng. */
export function allOperationIds(): string[] {
  const { spec } = load();
  const ids: string[] = [];
  for (const item of Object.values(spec.paths as Record<string, Json>)) {
    for (const [method, op] of Object.entries(item)) {
      if (['get', 'put', 'post', 'patch', 'delete'].includes(method)) {
        ids.push((op as Operation).operationId ?? '');
      }
    }
  }
  return ids;
}

function templateToRegex(template: string): { re: RegExp; names: string[] } {
  const names: string[] = [];
  const source = template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{([^}]+)\}/g, (_m, n) => {
    names.push(n);
    return '([^/]+)';
  });
  return { re: new RegExp(`^${source}$`), names };
}

/** Tìm operation theo phương thức + URL thực (có thể kèm tiền tố `/api/v1` và query). */
export function matchOperation(method: string, url: string): MatchedOperation {
  const { spec } = load();
  const pathname = (url.split('?')[0] ?? '').replace(/^\/api\/v1/, '');
  const m = method.toLowerCase();
  for (const [template, item] of Object.entries(spec.paths as Record<string, Json>)) {
    const { re, names } = templateToRegex(template);
    const hit = re.exec(pathname);
    const operation = item[m] as Operation | undefined;
    if (hit && operation) {
      const pathParams = Object.fromEntries(names.map((n, i) => [n, hit[i + 1] ?? '']));
      return {
        template,
        method: m,
        operation,
        operationId: operation.operationId ?? '',
        pathParams,
      };
    }
  }
  throw new Error(`Hợp đồng OpenAPI không có operation cho ${method.toUpperCase()} ${pathname}`);
}

function resolveRef<T extends Json>(node: T): Json {
  const ref = node.$ref;
  if (typeof ref !== 'string') return node;
  let current: unknown = load().spec;
  for (const part of ref.replace(/^#\//, '').split('/')) {
    current = (current as Json)[part.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return current as Json;
}

function pointerEscape(part: string): string {
  return part.replace(/~/g, '~0').replace(/\//g, '~1');
}

function validatorFor(pointer: string): ValidateFunction {
  const state = load();
  let v = state.validators.get(pointer);
  if (!v) {
    const compiled = state.ajv.getSchema(`openapi#${pointer}`);
    if (!compiled) throw new Error(`Không biên dịch được schema ${pointer}`);
    v = compiled;
    state.validators.set(pointer, v);
  }
  return v;
}

function formatErrors(v: ValidateFunction): string {
  return (v.errors ?? []).map((e) => `${e.instancePath || '(gốc)'} ${e.message}`).join('; ');
}

/** Mã trạng thái mà hợp đồng khai báo cho operation. */
export function declaredStatuses(method: string, url: string): string[] {
  return Object.keys(matchOperation(method, url).operation.responses ?? {});
}

/**
 * Khẳng định phản hồi khớp hợp đồng: mã trạng thái được khai báo và (nếu có schema JSON) thân khớp schema.
 * Ném lỗi mô tả cụ thể khi lệch.
 */
export function assertResponseMatches(
  method: string,
  url: string,
  status: number,
  body: unknown,
): void {
  const matched = matchOperation(method, url);
  const responses = matched.operation.responses ?? {};
  const raw = responses[String(status)];
  if (!raw) {
    throw new Error(
      `${method.toUpperCase()} ${matched.template}: hợp đồng không khai báo mã ${status} (có: ${Object.keys(responses).join(', ')})`,
    );
  }
  const response = resolveRef(raw);
  const content = response.content as Record<string, { schema?: Json }> | undefined;
  const schema = content?.['application/json']?.schema;
  if (!schema) return; // phản hồi không có thân (204, 202…)

  // Con trỏ tới schema trong spec; phản hồi dùng $ref thì trỏ vào components.responses.
  const ref = raw.$ref;
  const base =
    typeof ref === 'string'
      ? ref.replace(/^#/, '')
      : `/paths/${pointerEscape(matched.template)}/${matched.method}/responses/${status}`;
  const v = validatorFor(`${base}/content/application~1json/schema`);
  if (!v(body)) {
    throw new Error(
      `${method.toUpperCase()} ${matched.template} → ${status}: phản hồi lệch hợp đồng: ${formatErrors(v)}`,
    );
  }
}

/** Khẳng định thân request khớp schema `requestBody` của operation. */
export function assertRequestMatches(method: string, url: string, body: unknown): void {
  const matched = matchOperation(method, url);
  const requestBody = matched.operation.requestBody;
  const content = requestBody?.content as Record<string, { schema?: Json }> | undefined;
  if (!content?.['application/json']?.schema) return;
  const v = validatorFor(
    `/paths/${pointerEscape(matched.template)}/${matched.method}/requestBody/content/application~1json/schema`,
  );
  if (!v(body)) {
    throw new Error(
      `${method.toUpperCase()} ${matched.template}: request lệch hợp đồng: ${formatErrors(v)}`,
    );
  }
}
