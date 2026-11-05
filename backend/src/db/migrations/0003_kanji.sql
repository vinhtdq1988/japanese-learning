-- Bài học Kanji (spec 003, data-model §5): cột/kiểu/ràng buộc mới. Chỉ thêm cột có DEFAULT hoặc NULL nên
-- dữ liệu của 001 hợp lệ ngay sau migration (mọi dòng cũ có facet = 'item'). KHÔNG sửa `learning_profiles.skills`
-- của người dùng hiện có (giả định "không tự động đổi hồ sơ").

-- Khía cạnh ôn tập: `item` cho từ vựng/ngữ pháp và bài tập không gắn chữ; Kanji dùng meaning | reading | word
-- (mỗi cặp chữ–khía cạnh có lịch ôn riêng).
CREATE TYPE review_facet AS ENUM ('item', 'meaning', 'reading', 'word');

-- Thời điểm người học chọn Kanji (đo SC-001/SC-008); giữ nguyên khi bỏ chọn, đặt lại khi chọn lại.
ALTER TABLE learning_profiles ADD COLUMN kanji_selected_at timestamptz;

-- Thẻ chủ đề và chi tiết của chữ Kanji. CHECK MỘT CHIỀU: mục không phải Kanji không được có hai trường này,
-- nhưng chữ Kanji được phép thiếu (bản nháp); việc đủ dữ liệu được kiểm khi kích hoạt (research K10).
ALTER TABLE content_items
  ADD COLUMN topic_id uuid REFERENCES topics (id),
  ADD COLUMN kanji_details jsonb,
  ADD CONSTRAINT content_items_kanji_details_kind_check CHECK (kind = 'kanji' OR kanji_details IS NULL),
  ADD CONSTRAINT content_items_topic_kind_check CHECK (kind = 'kanji' OR topic_id IS NULL);
CREATE INDEX content_items_topic_idx ON content_items (topic_id) WHERE topic_id IS NOT NULL;

ALTER TABLE exercises ADD COLUMN facet review_facet NOT NULL DEFAULT 'item';
ALTER TABLE study_records ADD COLUMN facet review_facet NOT NULL DEFAULT 'item';

-- Lịch ôn theo cặp (mục, khía cạnh): khóa chính đổi từ (user_id, item_id) sang (user_id, item_id, facet).
ALTER TABLE review_schedules
  ADD COLUMN facet review_facet NOT NULL DEFAULT 'item',
  ADD COLUMN mastered_at timestamptz;
ALTER TABLE review_schedules DROP CONSTRAINT review_schedules_pkey;
ALTER TABLE review_schedules ADD PRIMARY KEY (user_id, item_id, facet);

-- Khía cạnh của từng câu ôn trong gói, song song với review_item_ids (NULL = mọi phần tử là `item`).
ALTER TABLE daily_plan_items
  ADD COLUMN review_facets review_facet[],
  ADD CONSTRAINT daily_plan_items_review_facets_check
    CHECK (review_facets IS NULL OR cardinality(review_facets) = cardinality(review_item_ids));

-- Placement không có Kanji (ngoài phạm vi, research K12).
ALTER TABLE placement_questions
  ADD CONSTRAINT placement_questions_no_kanji_check CHECK (skill <> 'kanji');

-- Độ chính xác gần đây theo cặp (chữ, khía cạnh) – lượt chính.
CREATE INDEX study_records_item_facet_idx
  ON study_records (user_id, item_id, facet, occurred_at DESC) WHERE is_retry = false;
