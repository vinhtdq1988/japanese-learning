# Thay đổi hợp đồng REST API: Lộ trình lớn, thông báo phạm vi JLPT, kích hoạt đơn vị (OpenAPI 1.14.0 → 1.15.0)

**Nhánh**: `008-n4-n3-jlpt-content` | **Đặc tả**: FR-019, FR-022, FR-023, SC-007 | **Mô hình**: [data-model.md §7](../data-model.md) | **Quyết định**: [research.md D4, D12, D15](../research.md)

Hợp đồng duy nhất vẫn là [`specs/001-phase1-mvp/contracts/openapi.yaml`](../../001-phase1-mvp/contracts/openapi.yaml). Tài liệu này mô tả các thay đổi PHẢI áp vào file đó khi hiện thực (không tạo file OpenAPI thứ hai). Mọi thay đổi là **bổ sung hoặc làm rõ ngữ nghĩa**: không route nào bị xóa hay đổi nghĩa phá vỡ; client cũ vẫn chạy (tham số mới tùy chọn, trường mới tùy chọn). Spec này **không thêm route mới**. Sau khi sửa, sinh lại API client Dart (`client/lib/data/api/README.md`).

## 1. Nhật ký thay đổi (dán vào `info.description`, đổi `info.version` thành `1.15.0`)

```text
1.15.0 (spec 008-n4-n3-jlpt-content) – mở rộng nội dung N4/N3: (1) `GET /path` nhận tham số lọc tùy chọn
`kind`, `level`, `status`, `limit`, `offset` và trả thêm `itemsTotal` (số đơn vị khớp bộ lọc); không có tham số thì
hành vi cũ (toàn bộ đơn vị); (2) `PathSummary.notices` và `ProgressSummary.goal.notices` (mảng `ScopeNoticeCode`, tính khi
đọc): `content_ceiling_n3` như `scopeNotice` cũ và `listening_not_available` khi mục tiêu là JLPT (ứng dụng chưa có
phần nghe hiểu); `scopeNotice` giữ nguyên; (3) `ProgressSummary.goal.completionRatio` nay tính theo TỔNG PHÚT
(Σ estMinutes đã xong / Σ estMinutes trong phạm vi) thay vì số đơn vị; (4) Admin: kích hoạt đơn vị kiểm tra "mục
chính duy nhất" cho từ vựng và ngữ pháp (trước chỉ Kanji) → có thể trả `422 VALIDATION_FAILED`. Thay đổi bổ sung/làm rõ;
client PHẢI sinh lại từ OpenAPI 1.15.0.
```

## 2. `GET /path` — lọc và phân trang tùy chọn

```yaml
  /path:
    get:
      operationId: getPath
      tags: [path]
      summary: Lộ trình hiện tại
      description: >
        Không có tham số thì trả toàn bộ đơn vị như cũ. Có thể lọc để client dựng danh sách lười khi thư viện lớn
        (khoảng 600 đơn vị). Thứ tự các phần tử giữ nguyên thứ tự xếp hạng động. `totalUnits`/`completedUnits` luôn
        là số của TOÀN BỘ lộ trình (không đổi theo bộ lọc).
      parameters:
        - { name: kind,   in: query, required: false, schema: { $ref: '#/components/schemas/Skill' } }
        - { name: level,  in: query, required: false, schema: { $ref: '#/components/schemas/ContentLevel' } }
        - { name: status, in: query, required: false, schema: { type: string, enum: [pending, in_progress, completed, mastered] } }
        - { name: limit,  in: query, required: false, schema: { type: integer, minimum: 1, maximum: 500 } }
        - { name: offset, in: query, required: false, schema: { type: integer, minimum: 0, default: 0 } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/PathDetail' } } } }
        '404': { description: Chưa có lộ trình (chưa onboarding), content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
        '422': { $ref: '#/components/responses/ValidationError' }
```

`PathDetail` thêm trường (tùy chọn khi đọc):

```yaml
            itemsTotal:
              type: integer
              description: 'Số đơn vị khớp bộ lọc (trước `limit`/`offset`); không có bộ lọc = số phần tử của toàn bộ lộ trình'
```

Quy tắc: tham số sai kiểu/giá trị ngoài enum → `422 VALIDATION_FAILED`; `offset` vượt `itemsTotal` → `items: []`; bộ lọc `kind` nằm ngoài kỹ năng hiệu lực của người học → `items: []` (không lỗi). Áp dụng cho cả lộ trình lớp (`source = class`). Không đổi `competency` của từng phần tử.

## 3. Thông báo phạm vi suy ra lúc đọc (`notices`)

```yaml
    ScopeNoticeCode:
      type: string
      enum: [content_ceiling_n3, listening_not_available]
      description: >
        `content_ceiling_n3`: trình độ hoặc mục tiêu N2/N1 bị cắt ở N3 (như `scopeNotice`).
        `listening_not_available`: mục tiêu JLPT — ứng dụng chưa có phần nghe hiểu của kỳ thi (Giai đoạn 2).
```

`PathSummary` (và do đó `PathDetail`) và `ProgressSummary.goal` thêm:

```yaml
        notices:
          type: array
          items: { $ref: '#/components/schemas/ScopeNoticeCode' }
          description: >
            Tính khi đọc từ hồ sơ và tham số lộ trình, KHÔNG lưu vào lộ trình nên lộ trình đã tồn tại cũng có.
            Thứ tự: `content_ceiling_n3` (nếu có) rồi `listening_not_available` (nếu `goalType = jlpt`).
```

`scopeNotice` (enum `ScopeNotice`) **giữ nguyên** và chỉ trả `content_ceiling_n3`. Ma trận quyền: không đổi (cùng route, cùng quyền người học).

Nơi client hiển thị (cùng thành phần banner đang dùng cho `content_ceiling_n3`): kết thúc onboarding (nơi nhận `PathSummary`), Hồ sơ (phần mục tiêu), Lộ trình, Tiến độ — [quickstart.md QS6](../quickstart.md).

## 4. `ProgressSummary.goal.completionRatio` — làm rõ ngữ nghĩa

Mô tả mới: "Tỷ lệ **phút** của các đơn vị đã xong (hoàn thành hoặc thành thạo) trên tổng phút của các đơn vị `active` trong phạm vi lộ trình". Kiểu/khoảng giá trị không đổi (số 0–1, làm tròn 3 chữ số). Cùng nguồn với các thành tựu `goal_*` (spec 005). Không có thay đổi schema, chỉ mô tả và hành vi (research D12, xác nhận C4).

## 5. Admin: kích hoạt đơn vị — mở rộng kiểm tra mục chính duy nhất

`PUT /admin/units/{id}` và đường kích hoạt/`status` hiện chạy `validateUnit` + kiểm tra chữ Kanji duy nhất. Từ 1.15.0:

- Đơn vị **từ vựng** có mục trùng khóa `japanese|reading` với một đơn vị `active` khác → `422 VALIDATION_FAILED`, `fields["items[i].japanese"] = "mục 「…」 đã có ở bài 「…」 đang hoạt động"`.
- Đơn vị **ngữ pháp** có mục trùng `japanese` với một đơn vị `active` khác → cùng định dạng lỗi.
- `scopeRef`, `format`, `requires` **không** tồn tại trong Admin API (siêu dữ liệu file); quy tắc AU4–AU13 ([content-authoring.md §4](content-authoring.md)) **chỉ** chạy ở seed/CI, không chạy khi kích hoạt qua Admin (để quản trị viên vẫn sửa nhanh được sự cố).
- Mô tả lỗi `422` của hai route cập nhật nêu thêm các thông điệp trên. Ma trận quyền: không đổi.

## 6. Tương thích và triển khai

- Trường/tham số mới đều tùy chọn ⇒ client cũ không đổi hành vi; client mới (sinh lại từ 1.15.0) dùng `notices`, bộ lọc `GET /path`.
- Phát hành backend **trước** hoặc **cùng lúc** client (client cũ bỏ qua `notices`/`itemsTotal`; không có enum cũ nào mở rộng trong `Skill`/`ScopeNotice`).
- Kiểm thử hợp đồng: `path-filter.contract.test.ts` (tổ hợp lọc, 422, lớp, `itemsTotal`), `scope-notices.contract.test.ts` (JLPT/không JLPT, lộ trình cũ, N2/N1 cả hai thông báo), `goal-ratio-minutes.contract.test.ts`; cập nhật `authz-matrix.json` (không route mới nên chỉ rà soát); snapshot `api-snapshot.ts` thêm hai trường tùy chọn.
