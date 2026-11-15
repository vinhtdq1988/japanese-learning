# Hồ sơ người duyệt nội dung (spec 008)

> File này do **chủ dự án** quyết định nội dung. Tác nhân/LLM KHÔNG ĐƯỢC tự chọn tên người duyệt, ngày hay xác nhận ở đây; mục "Người duyệt được chỉ định" bên dưới được ghi theo chỉ định trực tiếp của chủ dự án. Chưa có người duyệt được chỉ định thì không đợt nội dung nào được phát hành (điều kiện C1 của [plan.md](../../specs/008-n4-n3-jlpt-content/plan.md); [research.md](../../specs/008-n4-n3-jlpt-content/research.md) mục C1).

## Người duyệt được chỉ định

Cổng **G1**: người có chuyên môn tiếng Nhật duyệt từng đơn vị trước khi chuyển từ `content/drafts/` sang `content/units/`.

| Họ tên            | Phạm vi duyệt (loại/trình độ) | Năng lực (đơn vị/đợt) | Ngày chỉ định | Người chỉ định |
| ----------------- | ----------------------------- | --------------------- | ------------- | -------------- |
| tdq_vinh          | Toàn bộ nội dung (mọi loại: từ vựng, ngữ pháp, Kanji, đọc, viết; trình độ N4 và N3) | ≈ 40 | 2026-11-14 | Chủ dự án |

## G0 – Danh mục phạm vi

Cổng **G0** (C2): chủ dự án duyệt danh mục phạm vi và nguồn/giấy phép trước khi biên soạn hàng loạt.

| Danh mục | Ngày duyệt | Người duyệt | Nguồn bị loại do giấy phép | Ghi chú |
| -------- | ---------- | ----------- | -------------------------- | ------- |
| G0 – Danh mục từ vựng: `n4-vocabulary.json` (716 dòng), `n3-vocabulary.json` (2.243 dòng) và danh sách nguồn | 2026-11-15 | tdq_vinh (chủ dự án; duyệt theo yêu cầu trực tiếp trong phiên làm việc) | Không có | Danh mục do tác nhân soạn nháp từ trí nhớ về các danh sách JLPT phổ biến; cột nguồn từng dòng là ƯỚC TÍNH, chưa đối chiếu từng dòng với nguồn. Mọi dòng được giữ (không `exclude`); 8 từ baseline mỗi trình độ nằm trong danh mục và tính là đã phủ. Dải dòng theo nhóm chủ đề ghi ở `content/scope/stage-plan.md`. |
| G0 – Danh mục chữ Hán: `n4-kanji.json` (170 dòng), `n3-kanji.json` (359 dòng) và danh sách nguồn | 2026-11-15 | tdq_vinh (chủ dự án; duyệt theo yêu cầu trực tiếp trong phiên làm việc) | Không có | Danh mục do tác nhân soạn nháp từ trí nhớ về các danh sách JLPT phổ biến; cột nguồn từng dòng là ƯỚC TÍNH, chưa đối chiếu từng dòng với nguồn. Mọi dòng có ≥ 2 nguồn, không có dòng `exclude`; không chữ nào trùng giữa N4 và N3. `pnpm content:coverage --kind kanji` thoát `0`: mức phủ ban đầu N4 8/170, N3 7/359 (chỉ các chữ của đơn vị baseline khớp theo khóa). Ghi chú cách đọc mới ở N3 cho `amendments` nằm ở `content/scope/kanji-amendment-candidates.md` (schema chưa có trường `notes`), CHƯA xác minh, để T201 xử lý. |
| G0 – Danh mục phạm vi: `n4-grammar.json` (104 dòng), `n3-grammar.json` (106 dòng) và danh sách nguồn | 2026-11-14 | tdq_vinh (chủ dự án; duyệt theo yêu cầu trực tiếp trong phiên làm việc) | Không có | Dòng chỉ có 1 nguồn được giữ. Gán nguồn từng dòng do tác nhân soạn nháp ước tính; mẫu baseline (ば/たら/ので/ために/受身/使役/使役受身/させてください) đặt ở N3, các mẫu trùng giữa gợi ý T045–T069 được chia cho đúng một trình độ. |

## Xác nhận SC-008

Điền ở phase cuối (nghiệm thu): người duyệt xác nhận bằng văn bản rằng nội dung các đợt đã duyệt đúng về tiếng Nhật (SC-008).

_(chưa xác nhận)_
