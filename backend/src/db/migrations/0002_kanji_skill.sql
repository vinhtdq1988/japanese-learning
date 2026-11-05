-- Bài học Kanji (spec 003, research K2): thêm giá trị `kanji` vào enum `skill`.
-- Tách thành file riêng vì PostgreSQL cho phép `ADD VALUE` trong giao dịch nhưng KHÔNG cho dùng giá trị
-- mới trước khi giao dịch commit; mọi CHECK/seed dùng 'kanji' nằm ở 0003_kanji.sql (chạy sau, giao dịch khác).
-- Enum `skill` được dùng chung bởi topics.skill, learning_units.kind, content_items.kind,
-- learning_profiles.skills/prioritized_skill và placement_questions.skill nên một giá trị mới phủ hết.
ALTER TYPE skill ADD VALUE IF NOT EXISTS 'kanji';
