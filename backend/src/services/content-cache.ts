import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { loadActiveUnitContent } from '../db/repositories/sessions.js';
import { learningUnits } from '../db/schema.js';
import { buildSnapshot, type SessionSnapshot } from '../domain/session-snapshot.js';
import type { Clock } from '../engine/clock.js';
import type { RankableUnit } from '../engine/path.js';
import type { I18nText, Language } from '../domain/types.js';

// Bộ đệm đọc danh mục đơn vị học `active` với TTL ngắn (R13, R17, SC-008): người học thấy thay đổi
// nội dung của admin trong tối đa `ttlMs` (≤ 60 giây) mà không cần phát hành client. Dùng đồng hồ tiêm
// vào nên kiểm thử mô phỏng được việc hết hạn. Phần nội dung chi tiết (mục, bài tập đã bản địa hóa)
// được đệm riêng theo (đơn vị, ngôn ngữ) cho phiên học mới, và mỗi phiên chụp snapshot lúc bắt đầu (R12).

export const CONTENT_CACHE_TTL_MS = 60_000;

/** Đơn vị trong danh mục: đủ để xếp hạng (engine) và hiển thị tiêu đề. */
export interface CatalogUnit extends RankableUnit {
  title: I18nText;
  isTrial: boolean;
}

export class ContentCache {
  private units: readonly CatalogUnit[] | null = null;
  private loadedAt = 0;
  private inflight: Promise<readonly CatalogUnit[]> | null = null;
  private readonly snapshots = new Map<string, { snapshot: SessionSnapshot; loadedAt: number }>();
  private readonly snapshotLoads = new Map<string, Promise<SessionSnapshot | null>>();

  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly ttlMs: number = CONTENT_CACHE_TTL_MS,
  ) {}

  /** Mọi đơn vị `active`; đọc lại từ CSDL khi bộ đệm quá hạn `ttlMs`. */
  async activeUnits(): Promise<readonly CatalogUnit[]> {
    const now = this.clock.now().getTime();
    const age = now - this.loadedAt;
    // Đồng hồ lùi (age < 0) cũng coi là quá hạn để không giữ bản cũ quá `ttlMs`.
    if (this.units && age >= 0 && age < this.ttlMs) return this.units;
    // Gộp các yêu cầu đồng thời vào một lần đọc.
    this.inflight ??= this.load().finally(() => {
      this.inflight = null;
    });
    const units = await this.inflight;
    this.units = units;
    this.loadedAt = now;
    return units;
  }

  /**
   * Ảnh chụp nội dung đã bản địa hóa của một đơn vị `active` (mục + bài tập, kèm đáp án) cho phiên học
   * (R12, T066). Cùng TTL với danh mục nên sửa nội dung có hiệu lực với phiên MỚI trong ≤ `ttlMs`;
   * phiên đang học giữ snapshot đã lưu. Trả null khi đơn vị không còn `active`.
   */
  async lessonSnapshot(unitId: string, language: Language): Promise<SessionSnapshot | null> {
    const key = `${unitId}:${language}`;
    const now = this.clock.now().getTime();
    const hit = this.snapshots.get(key);
    if (hit && now - hit.loadedAt >= 0 && now - hit.loadedAt < this.ttlMs) return hit.snapshot;

    let pending = this.snapshotLoads.get(key);
    if (!pending) {
      pending = this.loadSnapshot(unitId, language).finally(() => this.snapshotLoads.delete(key));
      this.snapshotLoads.set(key, pending);
    }
    const snapshot = await pending;
    if (snapshot) this.snapshots.set(key, { snapshot, loadedAt: now });
    else this.snapshots.delete(key);
    return snapshot;
  }

  /** Bỏ bộ đệm (sau khi chính tiến trình này ghi nội dung, hoặc trong kiểm thử). */
  invalidate(): void {
    this.units = null;
    this.snapshots.clear();
  }

  private async loadSnapshot(unitId: string, language: Language): Promise<SessionSnapshot | null> {
    const content = await loadActiveUnitContent(this.db, unitId);
    if (!content) return null;
    return buildSnapshot({
      title: content.unit.title,
      unitId: content.unit.id,
      items: content.items,
      exercises: content.exercises,
      language,
    });
  }

  private async load(): Promise<readonly CatalogUnit[]> {
    const rows = await this.db
      .select()
      .from(learningUnits)
      .where(eq(learningUnits.status, 'active'));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      level: r.level,
      tier: r.tier,
      goalTags: r.goalTags,
      topicId: r.topicId,
      difficulty: r.difficulty,
      estMinutes: r.estMinutes,
      sequence: r.sequence,
      status: 'active' as const,
      title: r.title,
      isTrial: r.isTrial,
    }));
  }
}
