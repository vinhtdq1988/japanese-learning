// Tổng thời gian học = độ dài của HỢP các khoảng `[startedAt, startedAt + durationSeconds)` (data-model
// §2.15, FR-026/041): các khoảng chồng nhau từ nhiều cửa sổ chỉ được tính một lần.

export interface StudyInterval {
  startedAt: Date;
  durationSeconds: number;
}

/** Độ dài (giây) của hợp các khoảng; khoảng chồng nhau hoặc liền kề không bị cộng trùng. */
export function unionDurationSeconds(intervals: readonly StudyInterval[]): number {
  const spans = intervals
    .map((i) => ({
      from: i.startedAt.getTime(),
      to: i.startedAt.getTime() + i.durationSeconds * 1000,
    }))
    .filter((s) => s.to > s.from)
    .sort((a, b) => a.from - b.from);

  let totalMs = 0;
  let curFrom = 0;
  let curTo = 0;
  let open = false;
  for (const span of spans) {
    if (!open) {
      [curFrom, curTo, open] = [span.from, span.to, true];
    } else if (span.from <= curTo) {
      curTo = Math.max(curTo, span.to);
    } else {
      totalMs += curTo - curFrom;
      [curFrom, curTo] = [span.from, span.to];
    }
  }
  if (open) totalMs += curTo - curFrom;
  return Math.round(totalMs / 1000);
}
