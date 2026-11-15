-- Luyện đọc/viết (spec 007, research P1): thêm hai giá trị `reading`, `writing` vào enum `skill`.
-- Tách thành file riêng như 0002_kanji_skill.sql: PostgreSQL cho phép `ADD VALUE` trong giao dịch nhưng KHÔNG cho dùng
-- giá trị mới trước khi giao dịch commit; migration này không dùng giá trị mới trong cùng giao dịch.
-- Enum `skill` được dùng chung bởi topics.skill, learning_units.kind, content_items.kind,
-- learning_profiles.skills/prioritized_skill và placement_questions.skill nên hai giá trị mới phủ hết.
-- Không bảng/cột mới, không sửa hàng nào: mọi hàng cũ giữ nguyên giá trị.
ALTER TYPE skill ADD VALUE IF NOT EXISTS 'reading';
ALTER TYPE skill ADD VALUE IF NOT EXISTS 'writing';
