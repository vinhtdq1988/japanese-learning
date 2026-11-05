# Thay đổi JSON Schema nội dung: Bài học Kanji

**Nhánh**: `003-kanji-lessons` | **Mô hình dữ liệu**: [data-model.md](../data-model.md) | **Quy tắc**: [research K10](../research.md#k10-quy-tắc-nội-dung-kanji-fr-021-sc-003)

Nội dung gốc nằm ở `content/` và được seed vào CSDL (Nguyên tắc VI). Các thay đổi dưới đây áp vào schema trong `content/schema/` và PHẢI ghi vào `content/schema/CHANGELOG.md`.

| Schema | Phiên bản | Thay đổi |
|---|---|---|
| `unit.schema.json` | 1.0.0 → **1.1.0** | `kind` nhận `kanji`; mục thêm `topic`, `kanjiDetails`; ví dụ thêm `kanjiReading`; bài tập thêm `facet`. Bổ sung, file đơn vị cũ vẫn hợp lệ |
| `topics.schema.json` | 1.0.0 → **1.1.0** | `skill` nhận `kanji` |
| `placement.schema.json` | 1.0.0 (không đổi) | `skill` vẫn chỉ `vocabulary`, `grammar` |

## 1. Đơn vị Kanji (`content/units/<level>-kanji-<slug>.json`)

Ví dụ rút gọn (bài 5 phút, 3 chữ):

```json
{
  "$schema": "../schema/unit.schema.json",
  "kind": "kanji",
  "level": "N5",
  "tier": "core",
  "topic": "kanji-n5-numbers",
  "title": { "vi": "Kanji số đếm 1", "en": "Number kanji 1" },
  "goalTags": ["jlpt", "daily_conversation", "work"],
  "difficulty": 1,
  "estMinutes": 5,
  "sequence": 100,
  "isTrial": false,
  "items": [
    {
      "japanese": "三",
      "topic": "kanji-n5-numbers",
      "meaning": { "vi": "ba", "en": "three" },
      "kanjiDetails": {
        "onReadings": ["サン"],
        "kunReadings": ["み", "み.つ"],
        "strokeCount": 3,
        "components": { "vi": "Ba nét ngang", "en": "Three horizontal strokes" }
      },
      "examples": [
        { "ja": "三月", "reading": "さんがつ", "kanjiReading": "サン",
          "translation": { "vi": "tháng Ba", "en": "March" } },
        { "ja": "三つ", "reading": "みっつ", "kanjiReading": "み",
          "translation": { "vi": "ba cái", "en": "three (things)" } }
      ]
    }
  ],
  "exercises": [
    {
      "item": "三", "facet": "meaning", "type": "multiple_choice",
      "prompt": { "vi": "「三」nghĩa là gì?", "en": "What does 「三」 mean?" },
      "payload": { "choices": [{ "vi": "một", "en": "one" }, { "vi": "ba", "en": "three" }, { "vi": "năm", "en": "five" }], "correct_index": 1 },
      "feedbackCorrect": { "vi": "Đúng! 三 nghĩa là ba.", "en": "Correct! 三 means three." },
      "feedbackIncorrect": { "vi": "Chưa đúng. 三 nghĩa là ba.", "en": "Not quite. 三 means three." }
    },
    {
      "item": "三", "facet": "reading", "type": "fill_blank",
      "prompt": { "vi": "Điền cách đọc của 「三」 trong 「三月」 (tháng Ba).", "en": "Type the reading of 「三」 in 「三月」 (March)." },
      "payload": { "accepted_answers": ["さん", "サン"], "hint": "〇がつ" },
      "feedbackCorrect": { "vi": "Đúng! 三月 = さんがつ.", "en": "Correct! 三月 = さんがつ." },
      "feedbackIncorrect": { "vi": "Trong 三月, 三 đọc là さん.", "en": "In 三月, 三 is read さん." }
    },
    {
      "item": "三", "facet": "word", "type": "multiple_choice",
      "prompt": { "vi": "「三つ」đọc là gì?", "en": "How is 「三つ」 read?" },
      "payload": { "choices": ["さんつ", "みっつ", "みつ"], "correct_index": 1 },
      "feedbackCorrect": { "vi": "Đúng! 三つ = みっつ (ba cái).", "en": "Correct! 三つ = みっつ (three things)." },
      "feedbackIncorrect": { "vi": "三つ đọc là みっつ.", "en": "三つ is read みっつ." }
    }
  ]
}
```

## 2. Định nghĩa schema bổ sung (`unit.schema.json` 1.1.0)

```json
{
  "$id": "https://japanese-learning.local/schema/unit/1.1.0",
  "properties": {
    "kind": { "enum": ["vocabulary", "grammar", "kanji"] }
  },
  "definitions": {
    "kanjiDetails": {
      "type": "object",
      "required": ["onReadings", "kunReadings", "strokeCount"],
      "additionalProperties": false,
      "properties": {
        "onReadings":  { "type": "array", "items": { "type": "string", "pattern": "^[\\u30A0-\\u30FF]+$" } },
        "kunReadings": { "type": "array", "items": { "type": "string", "pattern": "^[\\u3040-\\u309F.]+$" } },
        "strokeCount": { "type": "integer", "minimum": 1, "maximum": 30 },
        "components":  { "$ref": "#/definitions/i18nText" }
      }
    },
    "item": {
      "properties": {
        "topic": { "type": "string", "description": "Khóa chủ đề trong topics.json; bắt buộc khi kind=kanji" },
        "kanjiDetails": { "$ref": "#/definitions/kanjiDetails" }
      }
    },
    "example": {
      "properties": {
        "kanjiReading": { "type": "string" }
      }
    },
    "exercise": {
      "properties": {
        "facet": { "enum": ["item", "meaning", "reading", "word"], "default": "item" }
      }
    }
  },
  "allOf": [
    {
      "if": { "properties": { "kind": { "const": "kanji" } } },
      "then": {
        "properties": {
          "tier": { "const": "core" },
          "goalTags": { "minItems": 1 },
          "items": {
            "minItems": 3, "maxItems": 5,
            "items": { "required": ["japanese", "meaning", "topic", "kanjiDetails", "examples"] }
          }
        }
      }
    }
  ]
}
```

Với `kind = kanji`, `goalTags` PHẢI có ít nhất một phần tử (khác từ vựng/ngữ pháp, nơi mảng rỗng vẫn hợp lệ).

JSON Schema chỉ kiểm tra hình dạng; quy tắc xuyên trường (một ký tự Kanji, có glyph, mỗi chữ đủ ba khía cạnh bài tập, từ ví dụ chứa chữ, `kanjiReading` thuộc tập cách đọc, chủ đề có `skill='kanji'`, mỗi trình độ có bài 5 phút) do `domain/content-validation.ts` kiểm tra ở seed, ở kiểm thử `tests/unit/content-files.test.ts` và khi admin kích hoạt.

## 3. Chủ đề Kanji (`content/topics.json`)

```json
{ "key": "kanji-n5-numbers", "skill": "kanji", "level": "N5", "name": { "vi": "Số đếm", "en": "Numbers" } },
{ "key": "kanji-n5-time",    "skill": "kanji", "level": "N5", "name": { "vi": "Thời gian", "en": "Time" } },
{ "key": "kanji-n4-people",  "skill": "kanji", "level": "N4", "name": { "vi": "Con người", "en": "People" } },
{ "key": "kanji-n4-nature",  "skill": "kanji", "level": "N4", "name": { "vi": "Thiên nhiên", "en": "Nature" } },
{ "key": "kanji-n3-work",    "skill": "kanji", "level": "N3", "name": { "vi": "Công việc", "en": "Work" } },
{ "key": "kanji-n3-society", "skill": "kanji", "level": "N3", "name": { "vi": "Xã hội", "en": "Society" } }
```

Khóa chủ đề Kanji có tiền tố `kanji-` để không trùng khóa từ vựng (ví dụ `numbers`).

## 4. Tương thích

- Mọi file đơn vị và chủ đề hiện có hợp lệ với schema 1.1.0 mà không cần sửa (`facet` mặc định `item`, các trường mới tùy chọn ngoài `kind=kanji`).
- Seed (`backend/src/seed/content.ts`) ánh xạ `item.topic` → `content_items.topic_id`, `kanjiDetails` → `kanji_details`, `exercise.facet` → `exercises.facet`; seed lại là idempotent như 001.
