# Đặc tả tính năng: Bổ sung nội dung học N4 → N3 đầy đủ để thi JLPT

**Nhánh tính năng**: `008-n4-n3-jlpt-content` (tên thư mục; nhánh git hiện tại là `master`)

**Ngày tạo**: 2026-11-14

**Trạng thái**: Đã có kế hoạch và nhiệm vụ (`plan.md`, `tasks.md`); chờ `/speckit-implement` sau khi xử lý các điểm của báo cáo phân tích

**Giai đoạn**: Giai đoạn 1 – MVP (mô-đun Learning Content: từ vựng, ngữ pháp, Kanji N5–N3 theo hiến pháp v1.2.0) cộng với phần luyện đọc/luyện viết đã được nhận ở spec `007-fix-comments`. Spec này **chỉ mở rộng nội dung** trên các loại bài học đã có, không thêm loại bài học mới nào thuộc giai đoạn sau; vì vậy không cần sửa hiến pháp; riêng luyện đọc chạm phạm vi Giai đoạn 2 ("luyện nghe và đọc") và được biện minh ở `plan.md` (mục "Theo dõi độ phức tạp", điểm C8 của `research.md`).

**Đầu vào**: Mô tả của người dùng: "Bổ sung nội dung cho trình độ học từ N4 lên N3 đầy đủ để thi JLPT".

**Tiêu chí thành công của hiến pháp được hỗ trợ**: (2) bài học hằng ngày vừa trong 5–15 phút – mọi đơn vị mới giữ đúng thời lượng; (3) lộ trình phù hợp với trình độ và mục tiêu – người học nhắm JLPT N3 có đủ nội dung để đi hết chặng N4 → N3; (4) phát hiện điểm yếu và gợi ý cải thiện – nhiều chủ đề mịn hơn giúp chỉ ra đúng mảng yếu; (5) theo dõi được tiến độ và mức đạt mục tiêu – tiến độ JLPT N3 được tính trên toàn bộ phạm vi.

## Bối cảnh

Thư viện hiện tại chỉ có khoảng 10 đơn vị cho mỗi trình độ N4 và N3 (ví dụ: 8 chữ Hán N4, 7 chữ Hán N3, 2 bài ngữ pháp (8 mẫu) mỗi trình độ, 2 bài luyện đọc mỗi trình độ). Con số này đủ để chạy thử luồng học nhưng không đủ để một người học đang ở N4 học tới N3 rồi đi thi: phạm vi thi thực tế là hàng trăm chữ Hán, hàng nghìn từ vựng và khoảng một trăm mẫu ngữ pháp cho mỗi trình độ. Người học hiện nay sẽ hết nội dung chỉ sau vài ngày.

Phần thi JLPT gồm ba mảng: **chữ – từ vựng**, **ngữ pháp**, **đọc hiểu** và **nghe hiểu**. Spec này phủ ba mảng đầu (tương ứng các loại bài từ vựng, Kanji, ngữ pháp, luyện đọc, luyện viết đã có). Nghe hiểu nằm ngoài phạm vi (xem "Ngoài phạm vi").

## Kịch bản người dùng và kiểm thử *(bắt buộc)*

### Câu chuyện người dùng 1 - Học ngữ pháp N4 và N3 đầy đủ (Ưu tiên: P1)

Người học đặt mục tiêu JLPT N3 và đang ở trình độ N4. Họ học lần lượt các mẫu ngữ pháp của N4, rồi N3, mỗi bài ngắn 5–15 phút: nắm ý nghĩa, cách chia, sắc thái, so sánh với mẫu gần nghĩa và làm bài tập có dạng giống câu hỏi ngữ pháp trong đề thi (chọn mẫu phù hợp để điền vào chỗ trống, chọn câu đúng, sắp xếp câu). Khi học xong chặng này, người học đã gặp gần như mọi mẫu ngữ pháp thường ra trong đề thi N4 và N3.

**Vì sao ưu tiên này**: Ngữ pháp là mảng người học tự học khó nhất và là phần có khoảng cách lớn nhất giữa nội dung hiện có (2 bài, khoảng 8 mẫu mỗi trình độ) và nhu cầu thật (~100 mẫu mỗi trình độ). Mỗi mẫu có thể học độc lập nên phát hành theo đợt được.

**Kiểm thử độc lập**: Lấy danh mục mẫu ngữ pháp N4 và N3, đối chiếu với thư viện: mỗi mẫu có đơn vị chứa nó (hoặc lý do loại trừ được ghi lại); rồi cho một học viên hồ sơ N4 học liên tục và xác nhận họ gặp các mẫu theo thứ tự hợp lý và làm được bài tập.

**Kịch bản chấp nhận**:

1. **Cho trước** danh mục phạm vi ngữ pháp N4 và N3 đã được duyệt, **Khi** đối chiếu với thư viện đã kích hoạt, **Thì** mỗi mẫu trong danh mục thuộc ít nhất một đơn vị ngữ pháp, hoặc có lý do loại trừ được ghi lại.
2. **Cho trước** một mẫu ngữ pháp trong đơn vị, **Khi** người học xem mẫu, **Thì** thấy giải thích song ngữ vi/en, cách chia/kết hợp, ít nhất một ví dụ kèm cách đọc kana và bản dịch.
3. **Cho trước** hai mẫu dễ nhầm với nhau (ví dụ chỉ mục đích và chỉ lý do), **Khi** người học học đơn vị chứa chúng, **Thì** có phần so sánh hoặc bài tập phân biệt hai mẫu đó.
4. **Cho trước** một mẫu cần kiến thức nền (ví dụ bị động cần thể ない và thể từ điển), **Khi** hệ thống xếp thứ tự học, **Thì** kiến thức nền được học trước mẫu đó.
5. **Cho trước** người học làm xong bài tập của một đơn vị ngữ pháp, **Khi** xem kết quả, **Thì** mỗi câu sai có phản hồi giải thích vì sao đáp án đúng là đáp án đúng.

---

### Câu chuyện người dùng 2 - Học từ vựng N4 và N3 đầy đủ theo chủ đề (Ưu tiên: P1)

Người học học từ vựng của N4 rồi N3 theo từng chủ đề quen thuộc (công việc, sức khỏe, giao thông, xã hội, cảm xúc…), mỗi bài vài từ kèm cách đọc, nghĩa, ví dụ và bài tập có dạng như phần thi từ vựng (chọn cách đọc, chọn từ hợp ngữ cảnh, chọn từ đồng nghĩa). Từ đã học vào lịch ôn tập.

**Vì sao ưu tiên này**: Từ vựng là khối lượng lớn nhất (khoảng 700 từ mới ở N4 và 2.250 từ mới ở N3 theo mức tham chiếu thông dụng) và là nền cho mọi mảng khác, kể cả đọc hiểu.

**Kiểm thử độc lập**: Đối chiếu danh mục từ vựng N4/N3 với thư viện; cho một học viên học 1 bài từ vựng và kiểm tra các từ vào lịch ôn tập với cách đọc, nghĩa và ví dụ đầy đủ.

**Kịch bản chấp nhận**:

1. **Cho trước** danh mục từ vựng N4 và N3 đã được duyệt, **Khi** đối chiếu với thư viện đã kích hoạt, **Thì** mỗi từ trong danh mục thuộc đúng một đơn vị từ vựng chính, hoặc có lý do loại trừ được ghi lại.
2. **Cho trước** một từ trong đơn vị, **Khi** người học xem từ, **Thì** thấy chữ viết, cách đọc kana, nghĩa song ngữ và ít nhất một câu ví dụ kèm bản dịch.
3. **Cho trước** một đơn vị từ vựng, **Khi** người học làm bài tập, **Thì** có các câu theo dạng đề thi: chọn cách đọc của từ viết bằng chữ Hán, chọn từ phù hợp với ngữ cảnh câu, và chọn từ gần nghĩa.
4. **Cho trước** người học đặt mục tiêu "công việc", **Khi** hệ thống chọn bài từ vựng, **Thì** các chủ đề công việc được ưu tiên nhưng người học vẫn gặp đủ từ vựng của danh mục thi khi mục tiêu của họ là JLPT.

---

### Câu chuyện người dùng 3 - Học chữ Hán N4 và N3 đầy đủ (Ưu tiên: P1)

Người học học dần các chữ Hán của N4 và N3, mỗi bài 3–5 chữ: nghĩa, cách đọc on/kun, các từ chứa chữ đó, và bài tập nhận diện nghĩa, chọn cách đọc trong từ cụ thể, hiểu từ chứa chữ (theo hướng nhận diện, không luyện viết tay – hiến pháp v1.2.0).

**Vì sao ưu tiên này**: Chữ Hán là rào cản lớn nhất khi lên N3 (khoảng 350 chữ mới so với 7 chữ hiện có) và ảnh hưởng đến cả phần chữ – từ vựng lẫn đọc hiểu.

**Kiểm thử độc lập**: Đối chiếu danh mục chữ Hán N4/N3 với thư viện; học một bài Kanji bất kỳ và xác nhận mỗi chữ có đủ ba khía cạnh bài tập (nghĩa, cách đọc, từ chứa chữ).

**Kịch bản chấp nhận**:

1. **Cho trước** danh mục chữ Hán N4 và N3 đã được duyệt, **Khi** đối chiếu với thư viện đã kích hoạt, **Thì** mỗi chữ thuộc đúng một bài Kanji, hoặc có lý do loại trừ được ghi lại.
2. **Cho trước** một chữ có nhiều cách đọc, **Khi** người học làm câu hỏi cách đọc, **Thì** đề nêu rõ từ ngữ cảnh để chỉ có một đáp án đúng.
3. **Cho trước** một chữ vốn đã học ở trình độ thấp hơn nhưng có thêm cách đọc ở N3, **Khi** biên soạn, **Thì** cách đọc mới được bổ sung vào mục chữ hiện có thay vì tạo chữ lặp ở bài khác.
4. **Cho trước** một bài Kanji bất kỳ, **Khi** người học mở bài, **Thì** mọi chữ Hán trong bài và trong ví dụ hiển thị đúng chữ, không bị ô vuông hay ký tự thiếu.

---

### Câu chuyện người dùng 4 - Lộ trình liền mạch từ N4 sang N3 (Ưu tiên: P2)

Người học khai báo trình độ N4 (hoặc được xếp ở N4 sau bài kiểm tra) và mục tiêu JLPT N3 nhận kế hoạch hằng ngày bắt đầu từ nội dung N4, tiến dần sang N3 mà không bị trùng lặp, không bị nhảy cóc về kiến thức nền, và không hết nội dung giữa chừng. Người học đã biết một phần có thể đánh dấu đã thành thạo để bỏ qua. Tiến độ mục tiêu cho họ biết đã đi được bao nhiêu phần của phạm vi JLPT N3.

**Vì sao ưu tiên này**: Nội dung nhiều mà lộ trình không dùng đúng thì người học không thấy lợi ích; câu chuyện này bảo đảm Learning Engine hoạt động đúng với thư viện lớn gấp nhiều lần.

**Kiểm thử độc lập**: Chạy các hồ sơ học viên tiêu biểu (N4/10 phút, N4/15 phút, N3/30 phút, quay lại sau gián đoạn) qua nhiều ngày học mô phỏng và kiểm tra thứ tự, quỹ thời gian, trùng lặp và tiến độ.

**Kịch bản chấp nhận**:

1. **Cho trước** một học viên N4 với mục tiêu JLPT và 15 phút mỗi ngày, **Khi** học liên tục, **Thì** kế hoạch mỗi ngày nằm trong 15 phút, các đơn vị N4 được xếp trước, rồi chuyển sang N3, và không có đơn vị nào xuất hiện lại như bài mới.
2. **Cho trước** một học viên N3 bỏ qua N4, **Khi** hệ thống lập kế hoạch, **Thì** học viên được nhận nội dung N3 và vẫn có thể được gợi ý ôn nội dung N4 ở mảng họ yếu.
3. **Cho trước** một học viên đã đánh dấu thành thạo một số đơn vị, **Khi** hệ thống lập kế hoạch, **Thì** các đơn vị đó không được đẩy lại như bài mới.
4. **Cho trước** học viên đã học hết toàn bộ nội dung N3, **Khi** mở màn hình "Hôm nay", **Thì** thấy thông báo hết nội dung kèm gợi ý ôn tập, như hành vi hiện có.
5. **Cho trước** học viên đặt mục tiêu JLPT N3, **Khi** xem tiến độ mục tiêu, **Thì** phần trăm hoàn thành được tính trên toàn bộ phạm vi N4–N3 sau khi mở rộng, và học viên được thông báo rõ rằng phần nghe hiểu của kỳ thi chưa có trong ứng dụng.

---

### Câu chuyện người dùng 5 - Luyện đọc hiểu theo dạng đề JLPT (Ưu tiên: P2)

Người học có quỹ thời gian từ 30 phút mỗi ngày (điều kiện của spec 007) có nhiều bài luyện đọc N4 và N3 hơn: đoạn văn ngắn và vừa về nhiều chủ đề (thông báo, email công việc, tin tức, bài viết đời sống, thông tin tra cứu như lịch hay quảng cáo), kèm câu hỏi kiểm tra mức hiểu giống dạng đọc hiểu trong đề thi.

**Vì sao ưu tiên này**: Đọc hiểu chiếm phần lớn điểm kỳ thi nhưng hiện chỉ có 2 bài mỗi trình độ. Giá trị xuất hiện khi người học có thời gian nên xếp P2 sau ba mảng nền.

**Kiểm thử độc lập**: Với một học viên 30 phút/ngày, mở lần lượt vài bài luyện đọc N4 và N3 ở các chủ đề khác nhau, trả lời và đọc phản hồi.

**Kịch bản chấp nhận**:

1. **Cho trước** thư viện luyện đọc đã bổ sung, **Khi** thống kê, **Thì** mỗi trình độ N4 và N3 có đủ số bài theo yêu cầu (FR-009), phủ nhiều chủ đề và nhiều dạng đoạn văn.
2. **Cho trước** một học viên N4 mở bài luyện đọc, **Khi** đọc đoạn văn, **Thì** từ vựng và ngữ pháp trong đoạn nằm trong phạm vi N4 trở xuống (từ ngoài phạm vi, nếu có, được chú giải).
3. **Cho trước** một câu hỏi đọc hiểu, **Khi** người học trả lời sai, **Thì** phản hồi chỉ ra phần của đoạn văn dẫn tới đáp án đúng.
4. **Cho trước** học viên có quỹ dưới 30 phút mỗi ngày, **Khi** xem kế hoạch, **Thì** vẫn không thấy bài luyện đọc (giữ hành vi của spec 007).

---

### Câu chuyện người dùng 6 - Luyện viết N4 và N3 mở rộng (Ưu tiên: P3)

Người học có quỹ thời gian từ 30 phút mỗi ngày có thêm bài luyện viết (gõ bàn phím) N4 và N3: gõ từ, chữ Hán hoặc câu ngắn theo nghĩa/ngữ cảnh gợi ý, bám phạm vi từ vựng, Kanji và ngữ pháp đã học.

**Vì sao ưu tiên này**: Luyện viết củng cố nhớ chủ động nhưng không phải phần thi trực tiếp; xếp sau cùng.

**Kiểm thử độc lập**: Mở một số bài luyện viết N4 và N3, nhập đáp án đúng ở dạng hiragana, dạng Kanji và dạng sai để kiểm tra chấm điểm.

**Kịch bản chấp nhận**:

1. **Cho trước** thư viện luyện viết đã bổ sung, **Khi** thống kê, **Thì** mỗi trình độ N4 và N3 có đủ số bài theo yêu cầu (FR-010).
2. **Cho trước** một câu hỏi luyện viết, **Khi** người học nhập đáp án hợp lý ở dạng viết khác (Kanji hoặc hiragana), **Thì** được chấm đúng; đáp án sai nghĩa không được chấp nhận.

---

### Các trường hợp biên

- Người học đã có tiến độ và lịch ôn trên các đơn vị N4/N3 hiện có → việc bổ sung nội dung KHÔNG làm mất tiến độ, lịch ôn hay kết quả của họ; mọi đơn vị và mục hiện có giữ nguyên danh tính.
- Một mục trong danh mục không phù hợp để đưa vào (quá hiếm, cổ, hoặc thuộc N2) → mục đó được loại khỏi danh mục kèm lý do, không bị bỏ lặng lẽ.
- Một từ hoặc chữ vừa xuất hiện làm mục chính ở một đơn vị, vừa xuất hiện làm ví dụ ở đơn vị khác → được phép làm ví dụ; chỉ KHÔNG ĐƯỢC làm mục chính ở hai đơn vị.
- Ví dụ dùng chữ Hán mà người học chưa học → vẫn có cách đọc kana đi kèm để người học hiểu được.
- Một đơn vị mới bị người duyệt từ chối hoặc chưa duyệt xong → đơn vị đó không hiển thị cho người học; các đơn vị đã duyệt khác vẫn được phát hành.
- Câu hỏi có hai đáp án cùng đúng (ví dụ chữ Hán nhiều cách đọc, từ đồng nghĩa mơ hồ) → bị loại khi duyệt; đề phải nêu ngữ cảnh để chỉ còn một đáp án.
- Người học khai báo trình độ hoặc mục tiêu N2/N1 → hành vi hiện có giữ nguyên: nội dung dừng ở N3 và có thông báo phạm vi.
- Người học chỉ có 5 phút mỗi ngày → mọi kỹ năng được chọn vẫn có đơn vị 5 phút ở cả N4 và N3, nên kế hoạch hằng ngày không bị rỗng.
- Thư viện lớn gấp nhiều lần hiện tại → màn hình "Hôm nay", lộ trình và ôn tập không chậm đi đáng kể.

## Yêu cầu *(bắt buộc)*

### Yêu cầu chức năng

**Danh mục phạm vi và độ phủ**

- **FR-001**: Hệ thống nội dung PHẢI có **danh mục phạm vi JLPT N4 và N3** liệt kê các mục cần phủ theo bốn loại: chữ Hán, từ vựng, mẫu ngữ pháp và dạng/chủ đề đọc hiểu; mỗi mục gắn trình độ (N4 hoặc N3). Danh mục PHẢI được chủ dự án duyệt trước khi biên soạn hàng loạt và PHẢI ghi lại nguồn tham khảo.
- **FR-002**: Mỗi mục trong danh mục PHẢI có trạng thái rõ ràng: đã được phủ bởi một đơn vị học cụ thể, chưa phủ, hoặc bị loại trừ kèm lý do. PHẢI có báo cáo mức phủ theo từng loại × trình độ để người duyệt kiểm tra được.
- **FR-003**: Tập mục tiêu về độ phủ: **mẫu ngữ pháp ≥ 95%**, **chữ Hán ≥ 95%**, **từ vựng ≥ 90%** số mục trong danh mục, cho cả N4 và N3 (số mục cụ thể do danh mục quyết định). Ngưỡng này trùng với SC-002; đổi một nơi PHẢI đổi nơi kia.

**Nội dung theo mảng**

- **FR-004**: Mỗi đơn vị ngữ pháp PHẢI nêu cho từng mẫu: ý nghĩa và cách dùng (song ngữ vi/en), cách chia/kết hợp, sắc thái hoặc khác biệt với mẫu gần nghĩa khi có, và ≥ 1 ví dụ có cách đọc kana và bản dịch song ngữ.
- **FR-005**: Mỗi đơn vị từ vựng PHẢI nêu cho từng từ: chữ viết, cách đọc kana, nghĩa song ngữ vi/en và ≥ 1 câu ví dụ có cách đọc kana và bản dịch. Từ PHẢI được nhóm theo chủ đề mạch lạc.
- **FR-006**: Mỗi bài Kanji PHẢI tuân thủ quy ước hiện có: 3–5 chữ mỗi bài, theo hướng nhận diện (nghĩa, cách đọc on/kun, từ chứa chữ), mỗi chữ có đủ ba khía cạnh bài tập (nghĩa, cách đọc trong từ cụ thể, từ chứa chữ); KHÔNG có nội dung luyện viết tay hoặc thứ tự nét.
- **FR-007**: Mỗi chữ Hán, từ vựng hoặc mẫu ngữ pháp PHẢI là **mục chính của đúng một** đơn vị trong toàn thư viện (không trùng lặp). Cách đọc bổ sung của chữ Hán ở trình độ cao hơn được thêm vào mục hiện có (bổ sung chỉ-thêm). Với từ vựng và ngữ pháp, nghĩa hoặc cách dùng bổ sung ở trình độ cao hơn được trình bày làm ví dụ hoặc giải thích ở đơn vị trình độ cao hơn (được phép theo mục Trường hợp biên) chứ KHÔNG tạo mục chính thứ hai; muốn sửa mục đã phát hành thì dùng chức năng quản trị nội dung hiện có.
- **FR-008**: Bài tập PHẢI bám dạng câu hỏi tương ứng của đề thi: chữ – từ vựng (chọn cách đọc chữ Hán, chọn chữ Hán đúng cho cách đọc, điền từ theo ngữ cảnh, chọn từ gần nghĩa, chọn cách dùng đúng), ngữ pháp (chọn mẫu phù hợp để điền vào chỗ trống, chọn hoặc sắp xếp câu đúng ngữ pháp), đọc hiểu (hiểu nội dung, tìm thông tin). Dạng nào hệ thống chưa thể hiện được thì ghi rõ ở kế hoạch triển khai và thay bằng dạng tương đương có sẵn.
- **FR-009**: Luyện đọc PHẢI có **ít nhất 30 bài** cho mỗi trình độ N4 và N3, đa dạng chủ đề (≥ 8 chủ đề) và dạng đoạn văn (thông báo, thư/email, bài viết ngắn, thông tin tra cứu…). Từ vựng và ngữ pháp trong đoạn PHẢI nằm trong phạm vi trình độ đó hoặc thấp hơn; từ vượt phạm vi PHẢI được chú giải. Cách kiểm: máy kiểm ở mức chữ Hán (chữ ngoài phạm vi phải được chú giải); phần từ vựng và ngữ pháp do người duyệt xác nhận bằng một mục riêng trong checklist duyệt (hệ thống không có bộ phân tích hình thái tự động).
- **FR-010**: Luyện viết PHẢI có **ít nhất 20 bài** cho mỗi trình độ N4 và N3, bám phạm vi từ vựng, Kanji và ngữ pháp đã có ở trình độ đó, tuân thủ quy ước chấm hiện có (liệt kê đủ dạng chấp nhận, không viết tay).

**Cấu trúc, thời lượng và chất lượng**

- **FR-011**: Mọi đơn vị mới PHẢI gắn trình độ (N4 hoặc N3), chủ đề, độ khó, thứ tự học và mục tiêu liên quan (JLPT, và công việc/giao tiếp khi phù hợp); mọi đơn vị thuộc phạm vi thi PHẢI mang thẻ mục tiêu JLPT. Thứ tự học PHẢI bảo đảm kiến thức nền được học trước kiến thức dựa trên nó.
- **FR-012**: Mọi đơn vị mới PHẢI dài 5, 10 hoặc 15 phút và số bài tập PHẢI nằm trong quỹ thời lượng quy định hiện hành. Với mỗi cặp (loại bài × trình độ) PHẢI có đơn vị 5 phút, để người học có ít thời gian vẫn có bài.
- **FR-013**: Chủ đề (mảng nội dung) PHẢI đủ mịn để việc phát hiện điểm yếu chỉ ra được nhóm kiến thức cụ thể (ví dụ "so sánh", "điều kiện", "chữ Hán chủ đề công việc") thay vì chỉ theo trình độ.
- **FR-014**: Văn bản người học thấy PHẢI song ngữ vi/en; nội dung tiếng Nhật giữ nguyên; phản hồi đúng/sai PHẢI giải thích lý do.
- **FR-015**: Mọi chữ Hán và ký tự trong nội dung mới PHẢI hiển thị đúng trên ứng dụng (không ô vuông, không ký tự thiếu).

**Quy trình biên soạn và phát hành**

- **FR-016**: Nội dung PHẢI được biên soạn mới, tham khảo nguồn công khai chính thống và giáo trình tiếng Nhật phổ biến để bám phạm vi; KHÔNG ĐƯỢC chép nguyên văn đoạn văn, câu hỏi hoặc bài tập từ giáo trình hay trang web có bản quyền. Nguồn tham khảo của từng đợt PHẢI được ghi lại.
- **FR-017**: Mọi đơn vị PHẢI qua kiểm tra tự động (cấu trúc, thời lượng, không trùng lặp, ký tự hiển thị được) và qua bước duyệt của người có chuyên môn tiếng Nhật trước khi hiển thị cho người học. Đơn vị chưa duyệt KHÔNG ĐƯỢC hiển thị cho người học.
- **FR-018**: Nội dung PHẢI được phát hành **theo đợt**, mỗi đợt dùng được độc lập. Việc phát hành một đợt KHÔNG ĐƯỢC làm mất hoặc đổi tiến độ, lịch ôn, kết quả của người học hiện có, và KHÔNG ĐƯỢC đổi khóa/danh tính nội dung đã có.
- **FR-019**: Nội dung mới PHẢI tuân thủ hợp đồng nội dung hiện hành (cấu trúc đơn vị, mục, bài tập). Nếu cần mở rộng hợp đồng (ví dụ dạng đoạn văn dài hơn giới hạn hiện có, dạng bài sắp xếp câu), thay đổi PHẢI được ghi lại thành tài liệu và KHÔNG ĐƯỢC làm hỏng nội dung đã lưu.

**Lộ trình, xếp lớp và tiến độ**

- **FR-020**: Người học ở N4 (khai báo hoặc theo kết quả bài kiểm tra trình độ) có mục tiêu JLPT N3 PHẢI nhận kế hoạch bắt đầu từ nội dung N4 và chuyển sang N3, với nội dung đủ để học liên tục không bị hết trong thời gian quy định ở SC-003.
- **FR-021**: Kết quả bài kiểm tra trình độ PHẢI đưa người học tới đúng điểm xuất phát trong thư viện mở rộng; việc có điều chỉnh bộ câu hỏi kiểm tra hay không do kế hoạch triển khai quyết định.
- **FR-022**: Tiến độ mục tiêu JLPT hiển thị cho người học PHẢI tính trên toàn bộ phạm vi N4–N3 sau mở rộng. Khi người học đặt mục tiêu JLPT, hệ thống PHẢI nói rõ phần nghe hiểu của kỳ thi chưa có trong ứng dụng (cùng cách thông báo hiện có cho phạm vi nội dung).
- **FR-023**: Hành vi hiện có PHẢI giữ nguyên: kế hoạch hằng ngày không vượt quỹ thời gian khai báo; luyện đọc/viết chỉ cho người học từ 30 phút mỗi ngày; trần nội dung là N3 cho người học khai báo N2/N1.

### Thực thể chính

- **Danh mục phạm vi JLPT**: tập các mục cần phủ ở N4 và N3, mỗi mục có loại (chữ Hán, từ vựng, mẫu ngữ pháp, dạng đọc hiểu), trình độ, trạng thái phủ (đã phủ bởi đơn vị nào / chưa phủ / loại trừ kèm lý do) và nguồn tham khảo.
- **Đơn vị học**: đơn vị 5–15 phút đã có; mở rộng về số lượng, mỗi đơn vị thuộc một loại bài (từ vựng, ngữ pháp, Kanji, luyện đọc, luyện viết), một trình độ, một chủ đề, một thứ tự học.
- **Mục nội dung**: chữ Hán, từ, mẫu ngữ pháp, đoạn văn hoặc câu luyện viết; là mục chính của đúng một đơn vị.
- **Chủ đề (mảng nội dung)**: nhóm kiến thức dùng để xếp lộ trình và phát hiện điểm yếu.
- **Đợt phát hành nội dung**: nhóm đơn vị được duyệt và kích hoạt cùng lúc, kèm nguồn tham khảo và hồ sơ duyệt.
- **Báo cáo mức phủ**: thống kê độ phủ danh mục theo loại × trình độ, dùng để theo dõi tiến độ biên soạn và nghiệm thu.

## Tiêu chí thành công *(bắt buộc)*

### Kết quả đo được

- **SC-001**: 100% mục trong danh mục phạm vi N4 và N3 có trạng thái rõ ràng (đã phủ hoặc loại trừ kèm lý do); không còn mục "chưa phủ" khi nghiệm thu.
- **SC-002**: Mức phủ danh mục đạt ≥ 95% mẫu ngữ pháp, ≥ 95% chữ Hán và ≥ 90% từ vựng, cho cả N4 và N3.
- **SC-003**: Một học viên N4 có mục tiêu JLPT và 15 phút mỗi ngày học liên tục **không gặp thông báo hết nội dung trong ít nhất 180 ngày học**; trong mô phỏng của mọi hồ sơ học viên tiêu biểu (5/10/15/30 phút), 100% kế hoạch hằng ngày nằm trong quỹ thời gian khai báo.
- **SC-004**: 100% đơn vị đã kích hoạt qua kiểm tra tự động; 100% đơn vị của các đợt mới (từ đợt 001) có hồ sơ duyệt (người duyệt, ngày duyệt); 0 đơn vị chưa duyệt hiển thị cho người học. 33 đơn vị đã có trước spec này (baseline) là hồ sơ lịch sử của spec 001/003/007: chỉ cần qua kiểm tra tự động hiện có, không yêu cầu bổ sung hồ sơ duyệt.
- **SC-005**: Lấy mẫu ngẫu nhiên 5% đơn vị đã kích hoạt để rà soát lại: không quá 1 lỗi nội dung (đáp án sai, hai đáp án cùng đúng, cách đọc sai, bản dịch sai nghĩa) trên mỗi 100 mục.
- **SC-006**: Mỗi trình độ N4 và N3 có ≥ 30 bài luyện đọc (≥ 8 chủ đề) và ≥ 20 bài luyện viết; mỗi cặp (loại bài × trình độ) có ≥ 1 đơn vị 5 phút.
- **SC-007**: Sau mỗi đợt phát hành, 0 học viên hiện có bị mất hoặc đổi tiến độ, lịch ôn hay kết quả; màn hình "Hôm nay" hiển thị không chậm hơn quá 10% so với trước đợt đó.
- **SC-008**: Ít nhất một người có chuyên môn tiếng Nhật đối chiếu danh mục với tài liệu thi tham khảo chuẩn và xác nhận bằng văn bản rằng không thiếu mảng kiến thức chính nào của phần chữ – từ vựng, ngữ pháp, đọc hiểu ở N4 và N3.

## Ngoài phạm vi

- **Luyện nghe và nghe hiểu**: hiến pháp xếp luyện nghe vào Giai đoạn 2; không xây sớm. Do đó ứng dụng chưa bao phủ toàn bộ kỳ thi (phần nghe chiếm khoảng một phần ba điểm); người học được thông báo rõ (FR-022).
- **Thi thử mô phỏng nguyên đề** (tính giờ, chấm điểm theo thang JLPT, dự đoán đậu/rớt): là tính năng mới, không thuộc spec nội dung này; có thể làm spec riêng sau khi nội dung đủ.
- **Nội dung N5, N2, N1**: N5 giả định người học đã biết khi vào N4 (nội dung N5 hiện còn ít, có thể được mở rộng bằng spec riêng); N2/N1 giữ nguyên hành vi trần N3.
- **Luyện viết tay Kanji, thứ tự nét, nhận dạng nét**: ngoài phạm vi Giai đoạn 1.
- **Thay đổi giao diện hay hành vi Learning Engine**: chỉ thực hiện phần tối thiểu cần để thư viện lớn vận hành đúng (US4, FR-020 đến FR-023).

## Giả định

- "Trình độ học từ N4 lên N3" được hiểu là **cả N4 và N3 đều được phủ đầy đủ**: người học ở N4 phải học nốt N4 rồi sang N3; người học xếp thẳng N3 vẫn có nội dung N4 để ôn chỗ yếu.
- "Đầy đủ để thi JLPT" được hiểu là đầy đủ về **kiến thức ngôn ngữ và đọc hiểu** (chữ – từ vựng, ngữ pháp, đọc hiểu); phần nghe hiểu để Giai đoạn 2 theo hiến pháp.
- JLPT không còn công bố danh sách từ vựng, chữ Hán, ngữ pháp chính thức, nên danh mục phạm vi (FR-001) được xây từ các nguồn tham khảo công khai và giáo trình phổ biến, do chủ dự án duyệt. Mức tham chiếu thông dụng để ước lượng khối lượng (con số chính thức chốt khi lập danh mục): N4 ≈ 200 chữ Hán mới (≈ 300 cộng dồn), ≈ 700 từ mới (≈ 1.500 cộng dồn), ≈ 100 mẫu ngữ pháp; N3 ≈ 350 chữ Hán mới (≈ 650 cộng dồn), ≈ 2.250 từ mới (≈ 3.750 cộng dồn), ≈ 100 mẫu ngữ pháp.
- Cách biên soạn kế thừa quyết định của spec 007: viết mới, tham khảo nguồn chính thống và giáo trình nổi tiếng để bám phạm vi trình độ, không chép nguyên văn, chủ dự án duyệt cuối.
- Khối lượng rất lớn (hàng trăm đơn vị) nên biên soạn và phát hành theo đợt; việc chia đợt và thứ tự đợt do kế hoạch triển khai quyết định, mỗi câu chuyện người dùng ở trên có thể phát hành độc lập.
- Nội dung mới dùng đúng cấu trúc dữ liệu hiện có (đơn vị 5/10/15 phút, bài tập chọn đáp án, ghép cặp và điền chỗ trống); khả năng cần dạng bài hoặc giới hạn độ dài đoạn văn mới được xác định ở kế hoạch (FR-019).
- Nội dung bổ sung được dùng chung cho cả học viên cá nhân và lớp học của tổ chức (spec 004) vì cùng dùng một thư viện nội dung.
- Thư viện tiếp tục song ngữ vi/en như quy ước hiện hành.
