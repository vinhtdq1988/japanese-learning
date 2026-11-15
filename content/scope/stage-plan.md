# Kế hoạch chặng và `sequence` (spec 008)

> **BẢN TẠM.** Số đơn vị theo nhóm chủ đề là ƯỚC LƯỢNG từ [research.md D17](../../specs/008-n4-n3-jlpt-content/research.md) và các nhiệm vụ soạn ở [tasks.md](../../specs/008-n4-n3-jlpt-content/tasks.md); số mẫu/từ/chữ cụ thể do danh mục phạm vi đã duyệt (cổng G0) quyết định. Sau MỖI cổng G0 (T043 ngữ pháp, T076 từ vựng, T168 Kanji, T232 đọc/viết) PHẢI rà lại dải chặng và `sequence` bên dưới cho khớp số dòng danh mục thật TRƯỚC khi soạn hàng loạt nhóm tương ứng, rồi sửa tệp này trong cùng commit với danh mục.

## Nguyên tắc

- `sequence = chặng × 100 + vị trí` với vị trí `10, 20, …, 90` ([content-authoring.md §6](../../specs/008-n4-n3-jlpt-content/contracts/content-authoring.md)); PHẢI duy nhất trong (trình độ × loại) trên toàn thư viện (quy tắc AU9), kể cả với 33 đơn vị cơ sở.
- Chặng 0–3 đã bị đợt cơ sở (`000-baseline`) chiếm (từ vựng/ngữ pháp 10–30, Kanji 100–120, đọc/viết 200–350), nên nội dung mới bắt đầu từ **chặng 4** (`sequence` ≥ 410). Mọi loại dùng MỘT trục chặng chung trong một trình độ; mỗi chặng chứa lượng đơn vị tỷ lệ với tổng khối lượng của loại đó.
- Thứ tự trong một loại: **nền tảng trước** (thể て/ない/た và dạng thường trước điều kiện, bị động, sai khiến, kính ngữ), **từ thường gặp trước từ hiếm**, **mẫu dễ trước mẫu dễ nhầm**. Mẫu dễ nhầm (ví dụ 〜ために / 〜ように) nằm cùng đơn vị hoặc đơn vị liền kề.
- Từ vựng và Kanji theo thứ tự đợt phát hành (đợt nhỏ phát hành trước có chặng nhỏ hơn) để thư viện phát hành dở dang vẫn liền mạch. Luyện đọc và luyện viết gồm nhiều dạng/chủ đề nhỏ nên được **xen kẽ** theo vòng, để mỗi chặng đều có đủ dạng.
- Cách dùng: người soạn lấy `sequence` của đơn vị `-NN` ở cột cuối của nhóm tương ứng; tên file `<trình-độ>-<loại>-<chủ-đề>-<NN>.json`. Khi một nhóm có thêm/bớt đơn vị, chạy lại phân bổ cho cả loại (không sửa tay một ô) rồi cập nhật cột này; `pnpm content:lint` (AU9) bắt trùng và sai mẫu.
- Tiên quyết thật (`requires[]`) chỉ khai khi có phụ thuộc khái niệm (ví dụ bị động `requires` thể ない) và PHẢI trỏ tới đơn vị có `(trình độ, sequence)` nhỏ hơn (AU10). Đơn vị mang thẻ `work`/`daily_conversation` KHÔNG được `requires` đơn vị cùng loại.

## Trình độ N4

### N4: chặng 4–23 (20 chặng)

Số đơn vị mỗi chặng theo loại (kiểm tra mật độ `≈ 1–2 ngữ pháp, … từ vựng, … Kanji, … đọc, … viết`):

| Chặng | ngữ pháp | từ vựng | Kanji | luyện đọc | luyện viết |
|---|---|---|---|---|---|
| 4 | 2 | 4 | 3 | 2 | 1 |
| 5 | 1 | 3 | 2 | 1 | 1 |
| 6 | 2 | 3 | 2 | 2 | 1 |
| 7 | 1 | 4 | 3 | 1 | 1 |
| 8 | 1 | 3 | 2 | 2 | 1 |
| 9 | 2 | 3 | 2 | 1 | 1 |
| 10 | 1 | 4 | 3 | 2 | 1 |
| 11 | 2 | 3 | 2 | 1 | 1 |
| 12 | 1 | 3 | 2 | 2 | 1 |
| 13 | 1 | 3 | 2 | 1 | 1 |
| 14 | 2 | 4 | 3 | 2 | 1 |
| 15 | 1 | 3 | 2 | 1 | 1 |
| 16 | 2 | 3 | 2 | 2 | 1 |
| 17 | 1 | 4 | 3 | 1 | 1 |
| 18 | 1 | 3 | 2 | 2 | 1 |
| 19 | 2 | 3 | 2 | 1 | 1 |
| 20 | 1 | 4 | 3 | 2 | 1 |
| 21 | 2 | 3 | 2 | 1 | 1 |
| 22 | 1 | 3 | 2 | 2 | 1 |
| 23 | 1 | 3 | 2 | 1 | 1 |
| **Tổng** | **28** | **66** | **46** | **30** | **20** |

#### N4 – ngữ pháp (28 đơn vị)

| # | Nhóm chủ đề | Đợt | Đơn vị | Dải chặng | `sequence` theo thứ tự đơn vị `-01`, `-02`, … |
|---|---|---|---|---|---|
| 1 | `te-form` (mở rộng thể て (đợt mẫu)) | 001 | 3 | 4–5 | 410, 420, 510 |
| 2 | `grammar-n4-giving-receiving` (cho – nhận) | 001 | 2 | 6–6 | 610, 620 |
| 3 | `grammar-n4-potential-volitional` (khả năng, ý chí, dự định) | 001 | 3 | 7–9 | 710, 810, 910 |
| 4 | `grammar-n4-obligation-permission` (nghĩa vụ – cho phép – cấm – khuyên) | 001 | 2 | 9–10 | 920, 1010 |
| 5 | `grammar-n4-time-sequence` (thời gian – trình tự) | 001 | 2 | 11–11 | 1110, 1120 |
| 6 | `grammar-n4-purpose-reason` (mục đích – lý do) | 001 | 3 | 12–14 | 1210, 1310, 1410 |
| 7 | `grammar-n4-degree-manner` (mức độ – cách thức) | 001 | 2 | 14–15 | 1420, 1510 |
| 8 | `grammar-n4-conditionals` (điều kiện) | 001 | 3 | 16–17 | 1610, 1620, 1710 |
| 9 | `grammar-n4-hearsay-conjecture` (truyền đạt – phỏng đoán) | 001 | 3 | 18–19 | 1810, 1910, 1920 |
| 10 | `grammar-n4-passive-causative` (bị động – sai khiến cơ bản) | 001 | 2 | 20–21 | 2010, 2110 |
| 11 | `grammar-n4-honorific-basic` (kính ngữ cơ bản) | 001 | 3 | 21–23 | 2120, 2210, 2310 |

#### N4 – từ vựng (66 đơn vị)

| # | Nhóm chủ đề | Đợt | Đơn vị | Dải chặng | `sequence` theo thứ tự đơn vị `-01`, `-02`, … |
|---|---|---|---|---|---|
| 1 | `vocab-n4-family-people` (gia đình – con người) | 004 | 3 | 4–4 | 410, 420, 430 |
| 2 | `vocab-n4-home-housing` (nhà cửa – đồ dùng) | 004 | 3 | 4–5 | 440, 510, 520 |
| 3 | `vocab-n4-food-cooking` (ăn uống – nấu nướng) | 004 | 3 | 5–6 | 530, 610, 620 |
| 4 | `vocab-n4-shopping-money` (mua sắm – tiền bạc) | 004 | 3 | 6–7 | 630, 710, 720 |
| 5 | `vocab-n4-time-calendar` (thời gian – lịch) | 004 | 3 | 7–8 | 730, 740, 810 |
| 6 | `vocab-n4-school-study` (trường học – học tập) | 004 | 3 | 8–9 | 820, 830, 910 |
| 7 | `vocab-n4-work-basic` (công việc cơ bản) | 004 | 3 | 9–10 | 920, 930, 1010 |
| 8 | `vocab-n4-clothing-appearance` (quần áo – ngoại hình) | 004 | 2 | 10–10 | 1020, 1030 |
| 9 | `vocab-n4-weather-nature` (thời tiết – thiên nhiên) | 004 | 3 | 10–11 | 1040, 1110, 1120 |
| 10 | `vocab-n4-city-facilities` (thành phố – cơ sở công cộng) | 004 | 2 | 11–12 | 1130, 1210 |
| 11 | `vocab-n4-travel-trip` (du lịch) | 004 | 3 | 12–13 | 1220, 1230, 1310 |
| 12 | `vocab-n4-health-illness` (sức khỏe – bệnh tật) | 004 | 2 | 13–13 | 1320, 1330 |
| 13 | `vocab-n4-daily-verbs` (động từ sinh hoạt) | 005 | 4 | 14–14 | 1410, 1420, 1430, 1440 |
| 14 | `vocab-n4-adjectives` (tính từ miêu tả) | 005 | 3 | 15–15 | 1510, 1520, 1530 |
| 15 | `vocab-n4-communication` (giao tiếp – điện thoại – thư từ) | 005 | 3 | 16–16 | 1610, 1620, 1630 |
| 16 | `vocab-n4-feelings-personality` (cảm xúc – tính cách) | 005 | 3 | 17–17 | 1710, 1720, 1730 |
| 17 | `vocab-n4-adverbs-expressions` (phó từ – cách diễn đạt) | 005 | 3 | 17–18 | 1740, 1810, 1820 |
| 18 | `vocab-n4-hobbies-sports` (sở thích – thể thao) | 005 | 3 | 18–19 | 1830, 1910, 1920 |
| 19 | `vocab-n4-counters-units` (từ đếm – đơn vị) | 005 | 2 | 19–20 | 1930, 2010 |
| 20 | `vocab-n4-appliances-tech` (đồ điện – công nghệ) | 005 | 3 | 20–20 | 2020, 2030, 2040 |
| 21 | `vocab-n4-loanwords` (từ katakana thường gặp) | 005 | 3 | 21–21 | 2110, 2120, 2130 |
| 22 | `vocab-n4-events-customs` (sự kiện – phong tục) | 005 | 2 | 22–22 | 2210, 2220 |
| 23 | `vocab-n4-animals-plants` (động vật – thực vật) | 005 | 2 | 22–23 | 2230, 2310 |
| 24 | `vocab-n4-position-shape` (vị trí – hình dạng) | 005 | 2 | 23–23 | 2320, 2330 |

#### N4 – Kanji (46 đơn vị)

| # | Nhóm chủ đề | Đợt | Đơn vị | Dải chặng | `sequence` theo thứ tự đơn vị `-01`, `-02`, … |
|---|---|---|---|---|---|
| 1 | `kanji-n4-people-family` (con người – gia đình) | 003 | 3 | 4–4 | 410, 420, 430 |
| 2 | `kanji-n4-body-health` (cơ thể – sức khỏe) | 003 | 3 | 5–6 | 510, 520, 610 |
| 3 | `kanji-n4-nature-weather` (thiên nhiên – mùa – động vật) | 003 | 3 | 6–7 | 620, 710, 720 |
| 4 | `kanji-n4-time-calendar` (thời gian – lịch) | 003 | 4 | 7–9 | 730, 810, 820, 910 |
| 5 | `kanji-n4-places-city` (địa điểm – thành phố) | 003 | 5 | 9–11 | 920, 1010, 1020, 1030, 1110 |
| 6 | `kanji-n4-school-learning` (trường học – học tập) | 003 | 6 | 11–14 | 1120, 1210, 1220, 1310, 1320, 1410 |
| 7 | `kanji-n4-work-business` (công việc) | 003 | 4 | 14–15 | 1420, 1430, 1510, 1520 |
| 8 | `kanji-n4-transport-travel` (giao thông – du lịch) | 003 | 3 | 16–17 | 1610, 1620, 1710 |
| 9 | `kanji-n4-food-shopping` (ăn uống – mua sắm) | 003 | 5 | 17–19 | 1720, 1730, 1810, 1820, 1910 |
| 10 | `kanji-n4-daily-verbs` (động từ sinh hoạt) | 003 | 4 | 19–20 | 1920, 2010, 2020, 2030 |
| 11 | `kanji-n4-adjectives-states` (tính từ – trạng thái) | 003 | 6 | 21–23 | 2110, 2120, 2210, 2220, 2310, 2320 |

#### N4 – luyện đọc (30 đơn vị)

| # | Nhóm chủ đề | Đợt | Đơn vị | Dải chặng | `sequence` theo thứ tự đơn vị `-01`, `-02`, … |
|---|---|---|---|---|---|
| 1 | `reading-n4-notice` (dạng thông báo, nội quy, lịch) | 012 | 8 | 4–22 | 410, 620, 910, 1210, 1420, 1710, 2010, 2210 |
| 2 | `reading-n4-email-letter` (dạng thư và email) | 012 | 8 | 4–22 | 420, 710, 1010, 1220, 1510, 1810, 2020, 2220 |
| 3 | `reading-n4-short-essay` (dạng bài viết ngắn) | 012 | 8 | 5–23 | 510, 810, 1020, 1310, 1610, 1820, 2110, 2310 |
| 4 | `reading-n4-info-search` (dạng tra cứu thông tin) | 012 | 6 | 6–19 | 610, 820, 1110, 1410, 1620, 1910 |

#### N4 – luyện viết (20 đơn vị)

| # | Nhóm chủ đề | Đợt | Đơn vị | Dải chặng | `sequence` theo thứ tự đơn vị `-01`, `-02`, … |
|---|---|---|---|---|---|
| 1 | `writing-n4-daily-life` (sinh hoạt hằng ngày) | 013 | 4 | 4–19 | 410, 910, 1410, 1910 |
| 2 | `writing-n4-shopping` (mua sắm) | 013 | 4 | 5–20 | 510, 1010, 1510, 2010 |
| 3 | `writing-n4-school` (trường học) | 013 | 4 | 6–21 | 610, 1110, 1610, 2110 |
| 4 | `writing-n4-health-travel` (sức khỏe – du lịch) | 013 | 4 | 7–22 | 710, 1210, 1710, 2210 |
| 5 | `writing-n4-work-basic` (công việc cơ bản) | 013 | 4 | 8–23 | 810, 1310, 1810, 2310 |

## Trình độ N3

### N3: chặng 4–33 (30 chặng)

Số đơn vị mỗi chặng theo loại (kiểm tra mật độ `≈ 1–2 ngữ pháp, … từ vựng, … Kanji, … đọc, … viết`):

| Chặng | ngữ pháp | từ vựng | Kanji | luyện đọc | luyện viết |
|---|---|---|---|---|---|
| 4 | 1 | 7 | 3 | 1 | 1 |
| 5 | 1 | 7 | 3 | 1 | 1 |
| 6 | 1 | 6 | 2 | 1 | 0 |
| 7 | 1 | 7 | 3 | 1 | 1 |
| 8 | 1 | 7 | 3 | 1 | 1 |
| 9 | 1 | 6 | 2 | 1 | 0 |
| 10 | 1 | 7 | 3 | 1 | 1 |
| 11 | 1 | 7 | 3 | 1 | 1 |
| 12 | 1 | 6 | 2 | 1 | 0 |
| 13 | 1 | 7 | 3 | 1 | 1 |
| 14 | 1 | 7 | 3 | 1 | 1 |
| 15 | 1 | 6 | 2 | 1 | 0 |
| 16 | 1 | 7 | 3 | 1 | 1 |
| 17 | 1 | 7 | 3 | 1 | 1 |
| 18 | 0 | 6 | 2 | 1 | 0 |
| 19 | 1 | 7 | 3 | 1 | 1 |
| 20 | 1 | 7 | 3 | 1 | 1 |
| 21 | 1 | 6 | 2 | 1 | 0 |
| 22 | 1 | 7 | 3 | 1 | 1 |
| 23 | 1 | 7 | 3 | 1 | 1 |
| 24 | 1 | 6 | 2 | 1 | 0 |
| 25 | 1 | 7 | 3 | 1 | 1 |
| 26 | 1 | 7 | 3 | 1 | 1 |
| 27 | 1 | 6 | 2 | 1 | 0 |
| 28 | 1 | 7 | 3 | 1 | 1 |
| 29 | 1 | 7 | 3 | 1 | 1 |
| 30 | 1 | 6 | 2 | 1 | 0 |
| 31 | 1 | 7 | 3 | 1 | 1 |
| 32 | 1 | 7 | 3 | 1 | 1 |
| 33 | 0 | 6 | 2 | 1 | 0 |
| **Tổng** | **28** | **200** | **80** | **30** | **20** |

#### N3 – ngữ pháp (28 đơn vị)

| # | Nhóm chủ đề | Đợt | Đơn vị | Dải chặng | `sequence` theo thứ tự đơn vị `-01`, `-02`, … |
|---|---|---|---|---|---|
| 1 | `grammar-n3-reason-cause` (lý do – nguyên nhân – kết quả) | 002 | 3 | 4–6 | 410, 510, 610 |
| 2 | `grammar-n3-time-scope` (thời gian – phạm vi – đối tượng) | 002 | 3 | 7–9 | 710, 810, 910 |
| 3 | `grammar-n3-aspect-state` (diễn tiến – trạng thái) | 002 | 2 | 10–11 | 1010, 1110 |
| 4 | `grammar-n3-comparison-degree` (so sánh – mức độ) | 002 | 2 | 12–13 | 1210, 1310 |
| 5 | `grammar-n3-conditionals-concession` (điều kiện – nhượng bộ) | 002 | 3 | 14–16 | 1410, 1510, 1610 |
| 6 | `grammar-n3-purpose-intention` (mục đích – ý định – thử làm) | 002 | 3 | 17–20 | 1710, 1910, 2010 |
| 7 | `grammar-n3-obligation-possibility` (nghĩa vụ – cần thiết – khả năng) | 002 | 3 | 21–23 | 2110, 2210, 2310 |
| 8 | `grammar-n3-conjecture-judgment` (phỏng đoán – phán đoán) | 002 | 3 | 24–26 | 2410, 2510, 2610 |
| 9 | `grammar-n3-nominalization-quote-emphasis` (danh từ hóa – trích dẫn – nhấn mạnh) | 002 | 3 | 27–29 | 2710, 2810, 2910 |
| 10 | `grammar-n3-passive-causative-honorific` (bị động – sai khiến – kính ngữ mở rộng) | 002 | 3 | 30–32 | 3010, 3110, 3210 |

#### N3 – từ vựng (200 đơn vị)

| # | Nhóm chủ đề | Đợt | Đơn vị | Dải chặng | `sequence` theo thứ tự đơn vị `-01`, `-02`, … |
|---|---|---|---|---|---|
| 1 | `vocab-n3-work-trade` (công việc – thương mại) | 008 | 6 | 4–4 | 410, 420, 430, 440, 450, 460 |
| 2 | `vocab-n3-office-procedures` (thủ tục văn phòng) | 008 | 5 | 4–5 | 470, 510, 520, 530, 540 |
| 3 | `vocab-n3-employment` (tuyển dụng – việc làm) | 008 | 5 | 5–6 | 550, 560, 570, 610, 620 |
| 4 | `vocab-n3-finance-banking` (tài chính – ngân hàng) | 008 | 5 | 6–7 | 630, 640, 650, 660, 710 |
| 5 | `vocab-n3-economy-industry` (kinh tế – công nghiệp) | 008 | 5 | 7–7 | 720, 730, 740, 750, 760 |
| 6 | `vocab-n3-sales-service` (bán hàng – dịch vụ khách hàng) | 008 | 5 | 7–8 | 770, 810, 820, 830, 840 |
| 7 | `vocab-n3-contracts-rules` (hợp đồng – quy định) | 008 | 4 | 8–9 | 850, 860, 870, 910 |
| 8 | `vocab-n3-management` (quản lý – tổ chức) | 008 | 5 | 9–9 | 920, 930, 940, 950, 960 |
| 9 | `vocab-n3-it-internet` (công nghệ thông tin – internet) | 008 | 5 | 10–10 | 1010, 1020, 1030, 1040, 1050 |
| 10 | `vocab-n3-manufacturing` (sản xuất – chất lượng) | 008 | 5 | 10–11 | 1060, 1070, 1110, 1120, 1130 |
| 11 | `vocab-n3-society-media` (xã hội – truyền thông) | 009 | 6 | 11–12 | 1140, 1150, 1160, 1170, 1210, 1220 |
| 12 | `vocab-n3-news-incidents` (tin tức – vụ việc) | 009 | 5 | 12–13 | 1230, 1240, 1250, 1260, 1310 |
| 13 | `vocab-n3-politics-public` (chính trị – công quyền) | 009 | 5 | 13–13 | 1320, 1330, 1340, 1350, 1360 |
| 14 | `vocab-n3-environment-disaster` (môi trường – thiên tai) | 009 | 5 | 13–14 | 1370, 1410, 1420, 1430, 1440 |
| 15 | `vocab-n3-education-research` (giáo dục – nghiên cứu) | 009 | 5 | 14–15 | 1450, 1460, 1470, 1510, 1520 |
| 16 | `vocab-n3-culture-tradition` (văn hóa – truyền thống) | 009 | 5 | 15–16 | 1530, 1540, 1550, 1560, 1610 |
| 17 | `vocab-n3-international` (quan hệ quốc tế – ở nước ngoài) | 009 | 5 | 16–16 | 1620, 1630, 1640, 1650, 1660 |
| 18 | `vocab-n3-community-housing` (cộng đồng – nhà ở) | 009 | 5 | 16–17 | 1670, 1710, 1720, 1730, 1740 |
| 19 | `vocab-n3-infrastructure` (giao thông – hạ tầng) | 009 | 4 | 17–18 | 1750, 1760, 1770, 1810 |
| 20 | `vocab-n3-history-geography` (lịch sử – địa lý) | 009 | 5 | 18–18 | 1820, 1830, 1840, 1850, 1860 |
| 21 | `vocab-n3-health-medical` (y tế – sức khỏe) | 010 | 6 | 19–19 | 1910, 1920, 1930, 1940, 1950, 1960 |
| 22 | `vocab-n3-condition-injury` (tình trạng cơ thể – chấn thương) | 010 | 5 | 19–20 | 1970, 2010, 2020, 2030, 2040 |
| 23 | `vocab-n3-feelings-personality` (cảm xúc – tính cách) | 010 | 6 | 20–21 | 2050, 2060, 2070, 2110, 2120, 2130 |
| 24 | `vocab-n3-relationships-manners` (quan hệ con người – phép lịch sự) | 010 | 5 | 21–22 | 2140, 2150, 2160, 2210, 2220 |
| 25 | `vocab-n3-family-life-stages` (gia đình – các giai đoạn đời) | 010 | 5 | 22–22 | 2230, 2240, 2250, 2260, 2270 |
| 26 | `vocab-n3-daily-household` (sinh hoạt – việc nhà) | 010 | 5 | 23–23 | 2310, 2320, 2330, 2340, 2350 |
| 27 | `vocab-n3-food-health` (ẩm thực – dinh dưỡng) | 010 | 4 | 23–24 | 2360, 2370, 2410, 2420 |
| 28 | `vocab-n3-leisure-sports` (giải trí – thể thao) | 010 | 5 | 24–25 | 2430, 2440, 2450, 2460, 2510 |
| 29 | `vocab-n3-thoughts-decisions` (suy nghĩ – quyết định) | 010 | 5 | 25–25 | 2520, 2530, 2540, 2550, 2560 |
| 30 | `vocab-n3-speech-communication` (lời nói – giao tiếp) | 010 | 4 | 25–26 | 2570, 2610, 2620, 2630 |
| 31 | `vocab-n3-verbs-change-movement` (động từ biến đổi – di chuyển) | 011 | 6 | 26–27 | 2640, 2650, 2660, 2670, 2710, 2720 |
| 32 | `vocab-n3-verbs-states-actions` (động từ trạng thái – hành động) | 011 | 5 | 27–28 | 2730, 2740, 2750, 2760, 2810 |
| 33 | `vocab-n3-adjectives-evaluation` (tính từ đánh giá) | 011 | 6 | 28–28 | 2820, 2830, 2840, 2850, 2860, 2870 |
| 34 | `vocab-n3-adverbs-degree` (phó từ mức độ – tần suất) | 011 | 5 | 29–29 | 2910, 2920, 2930, 2940, 2950 |
| 35 | `vocab-n3-adverbs-manner` (phó từ cách thức – từ tượng thanh/tượng hình) | 011 | 5 | 29–30 | 2960, 2970, 3010, 3020, 3030 |
| 36 | `vocab-n3-discourse` (liên từ – cách nối ý) | 011 | 4 | 30–31 | 3040, 3050, 3060, 3110 |
| 37 | `vocab-n3-time-expressions` (biểu thức thời gian – trình tự) | 011 | 4 | 31–31 | 3120, 3130, 3140, 3150 |
| 38 | `vocab-n3-quantity-degree` (số lượng – mức độ – so sánh) | 011 | 5 | 31–32 | 3160, 3170, 3210, 3220, 3230 |
| 39 | `vocab-n3-abstract-nouns` (danh từ trừu tượng) | 011 | 5 | 32–33 | 3240, 3250, 3260, 3270, 3310 |
| 40 | `vocab-n3-loanwords` (katakana nâng cao) | 011 | 5 | 33–33 | 3320, 3330, 3340, 3350, 3360 |

#### N3 – Kanji (89 đơn vị)

| # | Nhóm chủ đề | Đợt | Đơn vị | Dải chặng | `sequence` theo thứ tự đơn vị `-01`, `-02`, … |
|---|---|---|---|---|---|
| 1 | `kanji-n3-work-business` (công việc – kinh doanh) | 006 | 7 | 4–6 | 410, 420, 430, 510, 520, 530, 610 |
| 2 | `kanji-n3-society-politics` (xã hội – chính trị) | 006 | 7 | 6–8 | 620, 630, 710, 720, 730, 810, 820 |
| 3 | `kanji-n3-economy-money` (kinh tế – tiền bạc) | 006 | 8 | 9–11 | 910, 920, 930, 1010, 1020, 1030, 1110, 1120 |
| 4 | `kanji-n3-education-culture` (giáo dục – văn hóa) | 006 | 7 | 11–14 | 1130, 1210, 1220, 1230, 1310, 1320, 1410 |
| 5 | `kanji-n3-law-order` (pháp luật – trật tự) | 006 | 8 | 14–16 | 1420, 1430, 1510, 1520, 1530, 1610, 1620, 1630 |
| 6 | `kanji-n3-international` (quốc tế) | 006 | 5 | 17–18 | 1710, 1720, 1730, 1810, 1820 |
| 7 | `kanji-n3-nature-environment` (thiên nhiên – môi trường) | 007 | 8 | 19–21 | 1910, 1920, 1930, 1940, 2010, 2020, 2030, 2110 |
| 8 | `kanji-n3-body-feelings` (cơ thể – cảm xúc) | 007 | 9 | 21–24 | 2120, 2130, 2210, 2220, 2230, 2310, 2320, 2330, 2410 |
| 9 | `kanji-n3-daily-home` (đời sống – nhà cửa) | 007 | 6 | 24–26 | 2420, 2430, 2510, 2520, 2530, 2610 |
| 10 | `kanji-n3-communication` (giao tiếp – diễn đạt) | 007 | 5 | 26–27 | 2620, 2630, 2640, 2710, 2720 |
| 11 | `kanji-n3-verbs-actions` (động từ – hành động) | 007 | 8 | 27–30 | 2730, 2810, 2820, 2830, 2910, 2920, 2930, 3010 |
| 12 | `kanji-n3-adjectives-quantity` (tính từ – số lượng) | 007 | 11 | 30–33 | 3020, 3030, 3110, 3120, 3130, 3210, 3220, 3230, 3310, 3320, 3330 |

#### N3 – luyện đọc (30 đơn vị)

| # | Nhóm chủ đề | Đợt | Đơn vị | Dải chặng | `sequence` theo thứ tự đơn vị `-01`, `-02`, … |
|---|---|---|---|---|---|
| 1 | `reading-n3-notice` (dạng thông báo – hướng dẫn) | 012 | 5 | 4–24 | 410, 910, 1410, 1910, 2410 |
| 2 | `reading-n3-business-email` (dạng thư và email công việc) | 012 | 6 | 5–29 | 510, 1010, 1510, 2010, 2510, 2910 |
| 3 | `reading-n3-column` (dạng bài viết – cột báo) | 012 | 7 | 6–32 | 610, 1110, 1610, 2110, 2610, 3010, 3210 |
| 4 | `reading-n3-mid-text` (dạng đoạn vừa (中文)) | 012 | 7 | 7–33 | 710, 1210, 1710, 2210, 2710, 3110, 3310 |
| 5 | `reading-n3-info-search` (dạng tra cứu thông tin) | 012 | 5 | 8–28 | 810, 1310, 1810, 2310, 2810 |

#### N3 – luyện viết (20 đơn vị)

| # | Nhóm chủ đề | Đợt | Đơn vị | Dải chặng | `sequence` theo thứ tự đơn vị `-01`, `-02`, … |
|---|---|---|---|---|---|
| 1 | `writing-n3-work-business` (công việc – kinh doanh) | 013 | 4 | 4–26 | 410, 1110, 1910, 2610 |
| 2 | `writing-n3-society-news` (xã hội – tin tức) | 013 | 4 | 5–28 | 510, 1310, 2010, 2810 |
| 3 | `writing-n3-opinions` (ý kiến – lý do) | 013 | 4 | 7–29 | 710, 1410, 2210, 2910 |
| 4 | `writing-n3-health-lifestyle` (sức khỏe – lối sống) | 013 | 4 | 8–31 | 810, 1610, 2310, 3110 |
| 5 | `writing-n3-culture-events` (văn hóa – sự kiện) | 013 | 4 | 10–32 | 1010, 1710, 2510, 3210 |



## Ánh xạ nhóm chủ đề từ vựng → dải dòng danh mục (DỰ THẢO, chờ cổng G0 T076)

> Dòng danh mục từ vựng được sắp theo nhóm chủ đề nên mỗi nhóm chiếm một dải `id` liền nhau; người soạn các nhiệm vụ "Soạn … từ vựng" ở Phase 4 lấy từ trong đúng dải của nhóm mình (mỗi từ là mục chính của đúng một đơn vị). Từ baseline (8 từ mỗi trình độ) nằm trong dải của chủ đề phù hợp và đã được tính là phủ, không soạn lại. Tạo bởi tác nhân từ trí nhớ về các danh sách JLPT phổ biến, CHƯA đối chiếu từng dòng với nguồn: người duyệt G0 cần rà (các dòng gán nguồn là ước tính).

### N4 (716 dòng)

| Chủ đề | Từ id | Số dòng |
|---|---|---|
| vocab-n4-family-people | v-n4-0001 … v-n4-0032 | 32 |
| vocab-n4-home-housing | v-n4-0033 … v-n4-0062 | 30 |
| vocab-n4-food-cooking | v-n4-0063 … v-n4-0096 | 34 |
| vocab-n4-shopping-money | v-n4-0097 … v-n4-0127 | 31 |
| vocab-n4-time-calendar | v-n4-0128 … v-n4-0159 | 32 |
| vocab-n4-school-study | v-n4-0160 … v-n4-0191 | 32 |
| vocab-n4-work-basic | v-n4-0192 … v-n4-0224 | 33 |
| vocab-n4-clothing-appearance | v-n4-0225 … v-n4-0248 | 24 |
| vocab-n4-weather-nature | v-n4-0249 … v-n4-0281 | 33 |
| vocab-n4-city-facilities | v-n4-0282 … v-n4-0310 | 29 |
| vocab-n4-travel-trip | v-n4-0311 … v-n4-0342 | 32 |
| vocab-n4-health-illness | v-n4-0343 … v-n4-0367 | 25 |
| vocab-n4-daily-verbs | v-n4-0368 … v-n4-0408 | 41 |
| vocab-n4-adjectives | v-n4-0409 … v-n4-0440 | 32 |
| vocab-n4-communication | v-n4-0441 … v-n4-0471 | 31 |
| vocab-n4-feelings-personality | v-n4-0472 … v-n4-0504 | 33 |
| vocab-n4-adverbs-expressions | v-n4-0505 … v-n4-0537 | 33 |
| vocab-n4-hobbies-sports | v-n4-0538 … v-n4-0565 | 28 |
| vocab-n4-counters-units | v-n4-0566 … v-n4-0591 | 26 |
| vocab-n4-appliances-tech | v-n4-0592 … v-n4-0619 | 28 |
| vocab-n4-loanwords | v-n4-0620 … v-n4-0652 | 33 |
| vocab-n4-events-customs | v-n4-0653 … v-n4-0673 | 21 |
| vocab-n4-animals-plants | v-n4-0674 … v-n4-0694 | 21 |
| vocab-n4-position-shape | v-n4-0695 … v-n4-0716 | 22 |

### N3 (2.243 dòng)

| Chủ đề | Từ id | Số dòng |
|---|---|---|
| vocab-n3-work-trade | v-n3-0001 … v-n3-0076 | 76 |
| vocab-n3-office-procedures | v-n3-0077 … v-n3-0140 | 64 |
| vocab-n3-employment | v-n3-0141 … v-n3-0202 | 62 |
| vocab-n3-finance-banking | v-n3-0203 … v-n3-0265 | 63 |
| vocab-n3-economy-industry | v-n3-0266 … v-n3-0324 | 59 |
| vocab-n3-sales-service | v-n3-0325 … v-n3-0382 | 58 |
| vocab-n3-contracts-rules | v-n3-0383 … v-n3-0432 | 50 |
| vocab-n3-management | v-n3-0433 … v-n3-0489 | 57 |
| vocab-n3-it-internet | v-n3-0490 … v-n3-0548 | 59 |
| vocab-n3-manufacturing | v-n3-0549 … v-n3-0605 | 57 |
| vocab-n3-society-media | v-n3-0606 … v-n3-0671 | 66 |
| vocab-n3-news-incidents | v-n3-0672 … v-n3-0730 | 59 |
| vocab-n3-politics-public | v-n3-0731 … v-n3-0787 | 57 |
| vocab-n3-environment-disaster | v-n3-0788 … v-n3-0846 | 59 |
| vocab-n3-education-research | v-n3-0847 … v-n3-0900 | 54 |
| vocab-n3-culture-tradition | v-n3-0901 … v-n3-0958 | 58 |
| vocab-n3-international | v-n3-0959 … v-n3-1012 | 54 |
| vocab-n3-community-housing | v-n3-1013 … v-n3-1065 | 53 |
| vocab-n3-infrastructure | v-n3-1066 … v-n3-1114 | 49 |
| vocab-n3-history-geography | v-n3-1115 … v-n3-1166 | 52 |
| vocab-n3-health-medical | v-n3-1167 … v-n3-1234 | 68 |
| vocab-n3-condition-injury | v-n3-1235 … v-n3-1289 | 55 |
| vocab-n3-feelings-personality | v-n3-1290 … v-n3-1355 | 66 |
| vocab-n3-relationships-manners | v-n3-1356 … v-n3-1412 | 57 |
| vocab-n3-family-life-stages | v-n3-1413 … v-n3-1467 | 55 |
| vocab-n3-daily-household | v-n3-1468 … v-n3-1522 | 55 |
| vocab-n3-food-health | v-n3-1523 … v-n3-1567 | 45 |
| vocab-n3-leisure-sports | v-n3-1568 … v-n3-1618 | 51 |
| vocab-n3-thoughts-decisions | v-n3-1619 … v-n3-1672 | 54 |
| vocab-n3-speech-communication | v-n3-1673 … v-n3-1714 | 42 |
| vocab-n3-verbs-change-movement | v-n3-1715 … v-n3-1778 | 64 |
| vocab-n3-verbs-states-actions | v-n3-1779 … v-n3-1836 | 58 |
| vocab-n3-adjectives-evaluation | v-n3-1837 … v-n3-1903 | 67 |
| vocab-n3-adverbs-degree | v-n3-1904 … v-n3-1960 | 57 |
| vocab-n3-adverbs-manner | v-n3-1961 … v-n3-2011 | 51 |
| vocab-n3-discourse | v-n3-2012 … v-n3-2058 | 47 |
| vocab-n3-time-expressions | v-n3-2059 … v-n3-2101 | 43 |
| vocab-n3-quantity-degree | v-n3-2102 … v-n3-2150 | 49 |
| vocab-n3-abstract-nouns | v-n3-2151 … v-n3-2196 | 46 |
| vocab-n3-loanwords | v-n3-2197 … v-n3-2243 | 47 |
