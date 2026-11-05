# Đặc tả tính năng: Bài học Kanji

**Nhánh tính năng**: `003-kanji-lessons` (tên thư mục; chưa tạo nhánh git)

**Ngày tạo**: 2026-11-05

**Trạng thái**: Đã lập kế hoạch ([plan.md](plan.md))

**Giai đoạn**: Giai đoạn 1 – MVP (mô-đun Learning Content – Kanji N5–N3, nhận diện nghĩa/cách đọc, không luyện viết, theo hiến pháp v1.1.0). Spec `001-phase1-mvp` đã hoãn Kanji ra ngoài phạm vi của nó; spec này đảm nhận phần Kanji của Giai đoạn 1.

**Đầu vào**: Mô tả của người dùng: "Bổ sung bài học về KANJ" (Kanji)

**Tiêu chí thành công của hiến pháp được hỗ trợ**: (1) bắt đầu học mà không cần tự xây dựng kế hoạch; (2) bài học hằng ngày vừa trong 5–15 phút; (3) lộ trình phù hợp trình độ và mục tiêu; (4) phát hiện điểm yếu và gợi ý cải thiện; (5) theo dõi được tiến độ và mức đạt mục tiêu.

## Làm rõ

### Phiên 2026-11-05

- Q: Lịch ôn Kanji theo dõi mỗi chữ như một mục duy nhất hay theo từng khía cạnh? → A: Mỗi cặp (chữ, khía cạnh) có lịch ôn riêng; cấp chữ chỉ là bản tổng hợp (chữ đến hạn khi có ít nhất một cặp đến hạn); số chữ đã học và độ chính xác tính theo chữ.
- Q: Hệ thống dựa vào đâu để gom các chữ Kanji thành "nhóm" khi chỉ báo mảng yếu? → A: Mỗi chữ Kanji có một thẻ chủ đề (ví dụ thời gian, con người, thiên nhiên) do quản trị viên khai báo; nhóm yếu là chủ đề có độ chính xác ôn thấp.
- Q: Một bài Kanji nên có bao nhiêu chữ Kanji mới để vừa trong 5–15 phút? → A: 3–5 chữ Kanji mới mỗi bài.
- Q: Người học hoàn toàn mới phải học xong bao nhiêu nội dung nền tảng thì bài Kanji đầu tiên mới được đưa vào kế hoạch? → A: Không cần điều kiện tiên quyết; bài Kanji đủ điều kiện ngay từ ngày đầu nếu người học đã chọn Kanji.
- Q: Từ ví dụ trong bài Kanji là dữ liệu riêng của Kanji hay liên kết tới từ vựng đã có? → A: Dữ liệu riêng của Kanji (chữ, cách đọc kana, nghĩa vi/en), không liên kết với thư viện từ vựng; việc ôn khía cạnh "từ chứa chữ" chỉ ghi vào lịch ôn Kanji.

## Kịch bản người dùng và kiểm thử *(bắt buộc)*

### Câu chuyện người dùng 1 - Học một bài Kanji ngắn (Ưu tiên: P1)

Người học mở một bài Kanji gồm 3–5 chữ Kanji mới cùng chủ đề và trình độ. Với mỗi chữ, họ thấy chữ viết, nghĩa, các cách đọc, số nét và các từ ví dụ, rồi làm bài tập thực hành có phản hồi đúng/sai ngay lập tức. Cả bài hoàn thành trong 5–15 phút.

**Lý do ưu tiên**: Đây là giá trị cốt lõi của tính năng; không có bài Kanji thì các phần lộ trình, ôn tập, tiến độ đều không có gì để vận hành.

**Kiểm thử độc lập**: Với một bộ nội dung Kanji mẫu đã kích hoạt, mở bài từ danh sách nội dung bổ sung, học qua từng chữ, làm hết bài tập và xác minh: nội dung hiển thị đầy đủ, phản hồi tức thì, kết quả được ghi lại, thời lượng ước tính nằm trong 5–15 phút.

**Kịch bản chấp nhận**:

1. **Với** một bài Kanji đã kích hoạt, **Khi** người học mở bài, **Thì** với mỗi chữ họ thấy chữ Kanji cỡ lớn dễ đọc, nghĩa (theo ngôn ngữ họ đã chọn), các cách đọc (âm On và âm Kun, nếu có), số nét và ít nhất một từ ví dụ có cách đọc bằng kana và nghĩa.
2. **Với** một bài Kanji, **Khi** người học làm bài tập, **Thì** họ nhận phản hồi đúng/sai tức thì kèm giải thích ngắn; bài tập là loại khách quan tự chấm (trắc nghiệm, ghép cặp, điền cách đọc với tập đáp án cố định).
3. **Với** một bài Kanji, **Khi** người học dừng giữa chừng và quay lại sau, **Thì** họ tiếp tục từ chỗ đã dừng mà không mất các câu trả lời đã ghi.
4. **Với** một bài Kanji, **Khi** người học hoàn thành mọi bài tập, **Thì** bài được ghi nhận hoàn thành kèm tóm tắt kết quả (số câu đúng, các chữ cần chú ý).
5. **Với** người học chọn tiếng Anh làm ngôn ngữ giao diện, **Khi** họ mở bài Kanji, **Thì** nghĩa, giải thích và phản hồi hiển thị bằng tiếng Anh; ngược lại với tiếng Việt.

---

### Câu chuyện người dùng 2 - Kanji nằm trong lộ trình và kế hoạch hằng ngày (Ưu tiên: P1)

Người học chọn Kanji là kỹ năng muốn cải thiện (khi onboarding hoặc khi điều chỉnh kế hoạch). Từ đó, kế hoạch hằng ngày tự động chen các bài Kanji phù hợp trình độ và mục tiêu cùng với từ vựng và ngữ pháp, trong đúng quỹ thời gian mỗi ngày họ đã khai báo.

**Lý do ưu tiên**: Nếu Kanji chỉ là danh sách bài tự chọn thì người học phải tự lên kế hoạch, trái với nguyên tắc "bắt đầu học mà không cần tự xây dựng kế hoạch".

**Kiểm thử độc lập**: Tạo hồ sơ người học có chọn Kanji ở nhiều mức thời gian (5/10/15/30 phút) và nhiều trình độ; sinh lộ trình và kế hoạch nhiều ngày liên tiếp; xác minh có bài Kanji trong kế hoạch, đúng trình độ, và tổng thời lượng không vượt quỹ thời gian.

**Kịch bản chấp nhận**:

1. **Với** màn hình onboarding hoặc điều chỉnh kế hoạch, **Khi** người học xem danh sách kỹ năng, **Thì** Kanji chọn được (không còn bị khóa); nghe và đọc vẫn hiển thị là tùy chọn bị khóa kèm ghi chú "chưa có trong phiên bản này".
2. **Với** một người học đã chọn Kanji, **Khi** họ mở "Hôm nay", **Thì** kế hoạch có bài Kanji phù hợp trình độ và mục tiêu bên cạnh bài từ vựng/ngữ pháp, và tổng thời lượng ước tính không vượt thời gian mỗi ngày đã khai báo.
3. **Với** một người học KHÔNG chọn Kanji, **Khi** họ mở "Hôm nay", **Thì** kế hoạch mặc định của họ không chứa bài Kanji nào và không thay đổi so với trước khi có tính năng này.
4. **Với** một người học đang dùng ứng dụng (đã có lộ trình chỉ gồm từ vựng và ngữ pháp), **Khi** họ thêm Kanji vào kỹ năng của mình trong phần điều chỉnh kế hoạch, **Thì** kế hoạch từ lần sinh kế tiếp có bài Kanji, và tiến độ cùng lịch ôn đã có của họ được giữ nguyên.
5. **Với** một người học ưu tiên kỹ năng Kanji, **Khi** kế hoạch được sinh, **Thì** bài Kanji chiếm tỷ trọng lớn hơn trong phần học mới của kế hoạch so với khi không ưu tiên, nhưng vẫn nằm trong quỹ thời gian.
6. **Với** người học đã học xong mọi bài Kanji hiện có ở trình độ của mình, **Khi** mở kế hoạch, **Thì** họ nhận thông báo rõ ràng và gợi ý mảng nội dung tiếp theo thay vì kế hoạch trống.

---

### Câu chuyện người dùng 3 - Ôn lại Kanji sắp quên (Ưu tiên: P2)

Các chữ Kanji đã học được hệ thống đưa vào lịch ôn theo lặp lại ngắt quãng (spaced repetition). Chữ nào người học trả lời sai thì quay lại sớm hơn; chữ nào nhớ chắc thì giãn dần.

**Lý do ưu tiên**: Kanji rất dễ quên nếu không ôn; ôn tập là điều kiện để việc học Kanji có hiệu quả lâu dài, nhưng cần có bài học (câu chuyện 1, 2) trước.

**Kiểm thử độc lập**: Với người học đã học một vài bài Kanji, mô phỏng các ngày trôi qua và các kết quả đúng/sai; xác minh các chữ đến hạn được đưa vào gói ôn trong kế hoạch, chữ sai quay lại sớm hơn chữ đúng.

**Kịch bản chấp nhận**:

1. **Với** một chữ Kanji vừa học xong bài, **Khi** bài hoàn thành, **Thì** mỗi cặp (chữ, khía cạnh) của chữ đó được lên lịch ôn lần đầu.
2. **Với** một chữ Kanji có ít nhất một khía cạnh đến hạn ôn, **Khi** người học mở kế hoạch hôm nay, **Thì** chữ đó nằm trong gói ôn với đúng các khía cạnh đã đến hạn, được ưu tiên theo mức quá hạn và nằm trong quỹ thời gian chung (cùng cơ chế với ôn từ vựng và ngữ pháp).
3. **Với** một câu ôn Kanji, **Khi** người học trả lời sai, **Thì** cặp (chữ, khía cạnh) được hỏi được hẹn ôn lại sớm hơn so với khi trả lời đúng; các khía cạnh khác của chữ đó không bị đổi lịch.
4. **Với** một cặp (chữ, khía cạnh) được ôn nhiều lần, **Khi** người học liên tục trả lời đúng, **Thì** khoảng cách giữa các lần ôn của cặp đó kéo dài dần.
5. **Với** một chữ Kanji có nhiều cách đọc và nhiều từ ví dụ, **Khi** ôn, **Thì** gói ôn hỏi đủ ba khía cạnh (nghĩa, cách đọc, từ chứa chữ) theo lịch riêng của từng khía cạnh, để người học không chỉ nhớ một dạng câu hỏi và không bị hỏi lại khía cạnh còn nhớ chắc.

---

### Câu chuyện người dùng 4 - Theo dõi tiến độ và điểm yếu về Kanji (Ưu tiên: P2)

Người học thấy tiến độ Kanji của mình: đã học bao nhiêu chữ, độ chính xác khi ôn, các mảng Kanji còn yếu, và tiến độ hướng tới mục tiêu có tính đến Kanji khi họ đã chọn kỹ năng này.

**Lý do ưu tiên**: Theo dõi tiến độ là cam kết của sản phẩm; người học cần thấy nỗ lực học Kanji được ghi nhận để duy trì thói quen.

**Kiểm thử độc lập**: Hoàn thành một số bài và ôn Kanji với kết quả đúng/sai đã biết; mở màn hình tiến độ và xác minh số liệu Kanji khớp với hoạt động đã ghi.

**Kịch bản chấp nhận**:

1. **Với** người học đã học Kanji, **Khi** xem tiến độ, **Thì** họ thấy số chữ Kanji đã học, số bài Kanji đã hoàn thành, thời gian học Kanji và độ chính xác khi ôn Kanji, tách riêng khỏi từ vựng và ngữ pháp, đồng thời vẫn nằm trong tổng thời gian học và chuỗi ngày học chung.
2. **Với** người học thường xuyên sai ở các chữ cùng thẻ chủ đề (ví dụ chủ đề thời gian), **Khi** xem tiến độ, **Thì** chủ đề đó được chỉ báo là mảng yếu.
3. **Với** người học đã chọn Kanji, **Khi** hệ thống tính tiến độ hướng tới mục tiêu và mốc thời gian, **Thì** các bài Kanji thuộc phạm vi mục tiêu được tính vào tiến độ; người học không chọn Kanji thì tiến độ mục tiêu không bị ảnh hưởng.

---

### Câu chuyện người dùng 5 - Quản trị viên quản lý nội dung Kanji (Ưu tiên: P3)

Quản trị viên tạo, sửa, kích hoạt/vô hiệu hóa và sắp xếp các bài Kanji, cùng các chữ, từ ví dụ và bài tập của chúng, giống như cách họ quản lý bài từ vựng và ngữ pháp, mà không cần phát hành lại ứng dụng.

**Lý do ưu tiên**: Thư viện ban đầu có thể nạp sẵn; công cụ quản trị cần thiết để mở rộng và sửa nội dung về sau nhưng không chặn người học bắt đầu học.

**Kiểm thử độc lập**: Đăng nhập quản trị, tạo một bài Kanji mới đủ thông tin, kích hoạt, rồi xác minh người học phù hợp nhìn thấy bài trong kế hoạch/học thêm mà không cần phát hành ứng dụng; thử kích hoạt bài thiếu thông tin và xác minh bị từ chối kèm lý do.

**Kịch bản chấp nhận**:

1. **Với** quản trị viên, **Khi** họ tạo một bài Kanji gồm các chữ, nghĩa (vi và en), cách đọc, số nét, từ ví dụ và bài tập rồi kích hoạt, **Thì** bài xuất hiện cho người học phù hợp mà không cần cập nhật ứng dụng.
2. **Với** một bài Kanji thiếu thông tin bắt buộc (ví dụ số chữ ngoài khoảng 3–5, chưa có bản dịch tiếng Anh, chữ chưa có cách đọc, chữ chưa có thẻ chủ đề, chưa có bài tập), **Khi** quản trị viên kích hoạt, **Thì** hệ thống từ chối và nêu rõ phần còn thiếu.
3. **Với** một bài Kanji đang có người học đã học và có lịch ôn, **Khi** quản trị viên sửa hoặc ngừng một chữ/bài tập, **Thì** lịch sử học và lịch ôn của người học không bị mất hay hỏng; mục đã ngừng không còn được đưa vào bài học hay gói ôn mới.
4. **Với** mọi thay đổi nội dung Kanji, **Khi** quản trị viên lưu, **Thì** hành động được ghi lại kèm ai thực hiện và khi nào.

---

### Các trường hợp biên

- Người học hoàn toàn mới (chưa biết gì) chọn Kanji → bài Kanji đủ điều kiện xuất hiện trong kế hoạch ngay từ ngày đầu, không bị chặn bởi việc học nội dung nền tảng; kế hoạch vẫn hoạt động ngay từ ngày đầu và tuân theo quỹ thời gian và quy tắc luân phiên như mọi người học khác.
- Người học khai báo trình độ hoặc mục tiêu N2/N1 → nội dung Kanji cũng chỉ đến N3; áp dụng thông báo phạm vi nội dung hiện có như với từ vựng và ngữ pháp.
- Thời gian khai báo rất ít (5 phút) → ngày đó vẫn chỉ gồm một đơn vị (Kanji, từ vựng hoặc ngữ pháp) hoặc gói ôn trong 5 phút; luân phiên theo quy tắc hiện có để Kanji không chiếm hết hoặc bị bỏ đói.
- Một chữ Kanji có nhiều cách đọc (ví dụ cả âm On và âm Kun, hoặc cách đọc đổi theo từ) → bài học nêu rõ cách đọc nào dùng trong từ ví dụ nào; câu hỏi không được mơ hồ giữa các cách đọc đúng.
- Một chữ chỉ có âm On hoặc chỉ có âm Kun → bài học hiển thị đúng phần có, không để trống hay hiện giá trị giả.
- Câu điền cách đọc → chấp nhận mọi cách viết kana hợp lệ do quản trị viên khai báo trong tập đáp án cố định; không dùng chấm tự do hay nhận diện chữ viết tay.
- Trình duyệt người dùng thiếu phông chữ hiển thị một chữ Kanji ít gặp → chữ vẫn phải đọc được (dùng phông chữ dự phòng) và không hiện ô vuông trống.
- Mất kết nối giữa chừng bài Kanji → các câu trả lời đã ghi được giữ; người học thử lại và không bị báo hoàn thành khi chưa lưu.
- Người học đã chọn Kanji rồi bỏ chọn → các bài Kanji đã học vẫn nằm trong lịch sử và tiến độ; lịch ôn các chữ đã học vẫn đến hạn như cũ cho đến khi họ chủ động đánh dấu đã thành thạo; bài Kanji mới không còn được đưa vào kế hoạch.
- Cùng một chữ Kanji xuất hiện ở nhiều bài (ví dụ gặp lại ở trình độ cao hơn với cách đọc mới) → lịch ôn theo dõi từng cặp (chữ, khía cạnh) độc lập với bài, không tạo trùng lặp lịch ôn cho cùng một cặp.
- Cùng một tài khoản học Kanji ở hai cửa sổ trình duyệt đồng thời → mỗi câu trả lời và khoảng thời gian học chỉ được ghi một lần, như quy định chung của hệ thống.

## Yêu cầu *(bắt buộc)*

### Yêu cầu chức năng

**Bài học Kanji**

- **FR-001**: Hệ thống PHẢI cung cấp bài học Kanji dưới dạng đơn vị học rời rạc gồm một nhóm từ 3 đến 5 chữ Kanji mới liên quan (cùng chủ đề, trình độ), mỗi bài hoàn thành được trong 5–15 phút trong một lần ngồi học.
- **FR-002**: Mỗi chữ Kanji trong bài PHẢI có: chữ viết, nghĩa, ít nhất một cách đọc (âm On hoặc âm Kun), số nét, và ít nhất một từ ví dụ dùng chữ đó kèm cách đọc bằng kana và nghĩa. Mỗi chữ NÊN có từ hai từ ví dụ trở lên và CÓ THỂ có thông tin về bộ thủ/thành phần cấu tạo. Từ ví dụ là dữ liệu riêng của Kanji, không liên kết với thư viện từ vựng.
- **FR-003**: Nghĩa, giải thích và phản hồi bài tập của Kanji PHẢI có bằng tiếng Việt và tiếng Anh và tuân theo ngôn ngữ người học đã chọn (nhất quán với FR-019a của spec 001).
- **FR-004**: Mỗi bài Kanji PHẢI kết hợp giải thích với bài tập thực hành (học bằng làm) và phản hồi đúng/sai tức thì; bài tập PHẢI là loại khách quan tự động chấm (trắc nghiệm, ghép cặp, điền cách đọc với tập đáp án chấp nhận cố định). Bộ bài tập của một bài PHẢI bao phủ cả việc nhận diện nghĩa, chọn/điền cách đọc và đọc từ chứa Kanji.
- **FR-005**: Người học PHẢI có thể rời bài Kanji và tiếp tục mà không mất các câu trả lời đã ghi; bài Kanji tuân theo các quy tắc chung đã có của bài học (thời lượng, ghi nhận hoàn thành, ghi một lần khi nhiều cửa sổ).
- **FR-006**: Chữ Kanji PHẢI được hiển thị rõ ràng, đủ lớn để nhận ra các nét, và đúng trên các trình duyệt desktop hiện hành, kể cả chữ ít gặp.

**Tích hợp vào lộ trình và kế hoạch hằng ngày**

- **FR-007**: Onboarding và phần điều chỉnh kế hoạch PHẢI cho phép người học chọn Kanji là kỹ năng muốn cải thiện; nghe và đọc vẫn là tùy chọn bị khóa kèm ghi chú "chưa có trong phiên bản này".
- **FR-008**: Khi người học đã chọn Kanji, lộ trình và kế hoạch hằng ngày PHẢI xếp bài Kanji phù hợp trình độ và mục tiêu cùng với từ vựng và ngữ pháp, và tổng thời lượng ước tính mặc định KHÔNG ĐƯỢC vượt thời gian mỗi ngày đã khai báo; không bài Kanji hay gói ôn nào được ước tính quá 15 phút.
- **FR-009**: Người học KHÔNG chọn Kanji PHẢI tiếp tục nhận kế hoạch mặc định không có bài Kanji và không đổi hành vi so với trước khi có tính năng này.
- **FR-010**: Người học PHẢI có thể thêm hoặc bỏ Kanji khỏi kỹ năng của mình, ưu tiên Kanji, đánh dấu chữ/bài Kanji đã thành thạo, và yêu cầu xây dựng lại lộ trình; các thay đổi này PHẢI có hiệu lực trong kế hoạch được sinh kế tiếp và PHẢI giữ nguyên tiến độ cùng lịch ôn đã có.
- **FR-011**: Bài Kanji PHẢI được gắn thẻ trình độ (N5–N3) và mức liên quan đến mục tiêu như các đơn vị học khác, để lộ trình có thể chọn lọc.
- **FR-012**: Với người học hoàn toàn mới đã chọn Kanji, bài Kanji PHẢI đủ điều kiện được xếp ngay từ ngày đầu mà không có điều kiện tiên quyết về nội dung nền tảng; kế hoạch của họ vẫn PHẢI hoạt động ngay từ ngày đầu và tuân theo FR-008.
- **FR-013**: Người học hết nội dung Kanji hiện có ở trình độ của mình PHẢI nhận thông báo rõ ràng và gợi ý mảng nội dung tiếp theo thay vì kế hoạch trống.

**Ôn tập**

- **FR-014**: Hệ thống PHẢI lên lịch ôn từng cặp (chữ Kanji, khía cạnh) đã học bằng lặp lại ngắt quãng dựa trên kết quả ghi nhớ đã ghi, với ba khía cạnh: nghĩa, cách đọc, từ chứa chữ; trả lời sai PHẢI làm cặp đó quay lại sớm hơn trả lời đúng. Cấp chữ là bản tổng hợp: một chữ được coi là đến hạn khi có ít nhất một cặp đến hạn; số chữ đã học và độ chính xác được tính theo chữ.
- **FR-015**: Bài ôn Kanji đến hạn PHẢI được đưa vào kế hoạch hằng ngày cùng cơ chế ưu tiên theo mức quá hạn và quỹ thời gian dành cho ôn tập như từ vựng và ngữ pháp; gói ôn chỉ hỏi các khía cạnh đã đến hạn của chữ.
- **FR-016**: Câu ôn Kanji PHẢI nhắm đúng khía cạnh (nghĩa, cách đọc, từ chứa chữ) đang đến hạn của chữ và chỉ dùng bài tập khách quan tự động chấm.

**Theo dõi tiến độ**

- **FR-017**: Hệ thống PHẢI ghi lại thời gian học, mức hoàn thành và kết quả bài tập/ôn tập Kanji, và PHẢI hiển thị cho người học số chữ Kanji đã học, số bài đã hoàn thành, thời gian và độ chính xác riêng cho Kanji, bên cạnh các số liệu chung (tổng thời gian, chuỗi ngày học).
- **FR-018**: Hệ thống PHẢI nhận diện và hiển thị các chủ đề Kanji người học làm kém, tính theo độ chính xác ôn tập của các chữ cùng thẻ chủ đề (chỉ báo điểm yếu cơ bản như với từ vựng và ngữ pháp).
- **FR-019**: Tiến độ hướng tới mục tiêu và mốc thời gian PHẢI tính cả các bài Kanji thuộc phạm vi mục tiêu của người học khi họ đã chọn Kanji, và PHẢI không đổi với người không chọn Kanji.

**Quản trị nội dung**

- **FR-020**: Quản trị viên PHẢI có thể tạo, sửa, kích hoạt/vô hiệu hóa và sắp xếp bài Kanji, các chữ, từ ví dụ và bài tập của chúng bằng công cụ quản trị nội dung hiện có; nội dung Kanji PHẢI được quản lý như dữ liệu độc lập với bản phát hành ứng dụng.
- **FR-021**: Hệ thống PHẢI từ chối kích hoạt bài Kanji thiếu thông tin bắt buộc (từ 3 đến 5 chữ Kanji, nghĩa vi và en, cách đọc, số nét, thẻ chủ đề, ít nhất một từ ví dụ cho mỗi chữ, ít nhất một bài tập, đáp án hợp lệ) và PHẢI nêu rõ phần thiếu.
- **FR-022**: Sửa hoặc ngừng nội dung Kanji KHÔNG ĐƯỢC làm hỏng lịch sử học hay lịch ôn đã lưu; mục đã ngừng KHÔNG ĐƯỢC vào bài học hay gói ôn mới và KHÔNG ĐƯỢC tính vào tiến độ mục tiêu, còn lịch sử của chúng vẫn được tính vào độ chính xác và thời gian học đã ghi.
- **FR-023**: Mọi thay đổi nội dung Kanji của quản trị viên PHẢI được ghi lại kèm ai thực hiện và khi nào.

**Kiểm thử và chất lượng**

- **FR-024**: Hành vi lộ trình, điều chỉnh độ khó và lên lịch ôn khi có Kanji PHẢI được xác minh bằng kiểm thử tự động trên các hồ sơ người học đại diện, gồm cả hồ sơ có chọn Kanji và hồ sơ không chọn Kanji (không đổi so với trước).

**Ngoài phạm vi tính năng này**: luyện viết tay Kanji và hoạt ảnh thứ tự nét; tra cứu/từ điển Kanji tự do; phân tích bộ thủ chuyên sâu; câu hỏi Kanji trong bài kiểm tra trình độ đầu vào (bộ 20 câu giữ nguyên); Kanji trong chế độ dùng thử cho khách; nội dung Kanji N2/N1; furigana trong các bài từ vựng và ngữ pháp hiện có; luyện nghe/đọc; ứng dụng di động; thông báo nhắc học.

### Thực thể chính

- **Chữ Kanji (Kanji Character)**: Nội dung nhỏ nhất của bài Kanji: chữ viết, nghĩa (vi/en), các cách đọc (âm On, âm Kun), số nét, thẻ chủ đề (bắt buộc, do quản trị viên khai báo, dùng để nhóm điểm yếu) và thông tin bộ thủ/thành phần (tùy chọn) và các từ ví dụ. Là đơn vị được lên lịch ôn tập.
- **Từ ví dụ (Example Word)**: Từ hoặc cụm từ có chứa chữ Kanji, kèm cách đọc kana, nghĩa (vi/en), cho thấy chữ được đọc thế nào trong ngữ cảnh. Là dữ liệu riêng của Kanji, không liên kết với thư viện từ vựng; việc ôn từ ví dụ không ảnh hưởng lịch ôn từ vựng.
- **Bài học Kanji (Kanji Lesson Unit)**: Một đơn vị học ngắn (5–15 phút) chứa 3–5 chữ Kanji mới kèm bài tập; có trình độ, thẻ mục tiêu, độ khó và thời lượng ước tính như các đơn vị học khác.
- **Bài tập Kanji (Kanji Exercise)**: Câu hỏi khách quan tự chấm gắn với bài hoặc với một chữ, kèm đáp án đúng và phản hồi bằng tiếng Việt/tiếng Anh.
- **Hồ sơ học tập (Learning Profile)** *(đã có, mở rộng)*: danh sách kỹ năng mong muốn nay có thể gồm Kanji.
- **Lịch ôn tập (Review Schedule)** *(đã có, mở rộng)*: theo dõi từng người học và từng cặp (chữ Kanji, khía cạnh: nghĩa / cách đọc / từ chứa chữ), mỗi cặp có lịch sử ghi nhớ và ngày đến hạn kế tiếp riêng; cấp chữ là bản tổng hợp.
- **Tóm tắt tiến độ (Progress Summary)** *(đã có, mở rộng)*: bổ sung số liệu và chỉ báo điểm yếu riêng cho Kanji.

## Tiêu chí thành công *(bắt buộc)*

### Kết quả đo lường được

- **SC-001**: Người học đã chọn Kanji thấy bài Kanji trong kế hoạch "Hôm nay" của họ từ lần sinh kế hoạch kế tiếp, và bắt đầu bài Kanji đó trong tối đa 2 lần nhấp từ màn hình "Hôm nay".
- **SC-002**: 100% kế hoạch hằng ngày mặc định của người học có chọn Kanji (kiểm thử trên các hồ sơ ở mức 5/10/15/30 phút) có tổng thời lượng ước tính không vượt thời gian mỗi ngày đã khai báo, và không bài Kanji hay gói ôn nào được ước tính quá 15 phút.
- **SC-003**: 100% bài Kanji đã kích hoạt có đầy đủ nghĩa tiếng Việt và tiếng Anh, cách đọc, số nét, ít nhất một từ ví dụ cho mỗi chữ và ít nhất một bài tập hợp lệ (kiểm chứng bằng kiểm tra nội dung tự động).
- **SC-004**: Thư viện Kanji ban đầu có ít nhất một bài Kanji 5 phút cho mỗi trình độ N5, N4 và N3, đủ để người học ở mỗi trình độ có bài Kanji trong kế hoạch.
- **SC-005**: Các chữ Kanji trả lời sai được đưa lại vào ôn tập trung bình sớm hơn các chữ trả lời đúng, được xác minh trên các hồ sơ kiểm thử đại diện.
- **SC-006**: 100% kế hoạch mặc định của hồ sơ người học không chọn Kanji (gồm bộ hồ sơ đại diện hiện có) không chứa bài Kanji và giống kết quả trước khi có tính năng này.
- **SC-007**: Người học xem được số liệu tiến độ Kanji trong vòng 2 lần nhấp từ màn hình hằng ngày, và các số liệu khớp với hoạt động đã ghi.
- **SC-008**: Ít nhất 80% người học đã chọn Kanji hoàn thành ít nhất một bài Kanji trong 3 ngày sau khi chọn (đo từ dữ liệu học tập đã ghi).
- **SC-009**: Quản trị viên thêm một bài Kanji mới và kích hoạt thì trong vòng 5 phút bài xuất hiện cho người học phù hợp mà không cần phát hành ứng dụng; nội dung đã sửa hiển thị cho các phiên học mới mà không làm hỏng dữ liệu học đã lưu.

## Giả định

- Hiến pháp v1.1.0 đưa Kanji (N5–N3, nhận diện nghĩa/cách đọc, không luyện viết) vào danh sách Giai đoạn 1 và đặt luyện viết tay Kanji (thứ tự nét, nhận dạng chữ viết) ngoài Giai đoạn 1; spec này tuân thủ phạm vi đó mà không cần biện minh sai lệch.
- Phạm vi nội dung Kanji bằng phạm vi nội dung hiện có: trình độ N5–N3, do đội dự án biên soạn; số lượng chữ cụ thể của thư viện ban đầu được chốt ở giai đoạn lập kế hoạch nhưng PHẢI thỏa SC-004.
- Bài tập Kanji dùng đúng các dạng bài khách quan đã có (trắc nghiệm, ghép cặp, điền từ với tập đáp án cố định); không thêm dạng bài mới như viết tay hay nhận diện nét.
- Cách đọc hiển thị bằng kana theo quy ước thông thường (âm On thường được ghi bằng katakana, âm Kun bằng hiragana); việc trình bày cụ thể do thiết kế giao diện quyết định.
- Cách đọc ví dụ và nghĩa dùng tiếng Nhật chuẩn của tài liệu học JLPT; người biên soạn chịu trách nhiệm tính chính xác của nội dung.
- Bài kiểm tra trình độ đầu vào và chế độ dùng thử không thay đổi; người học bỏ qua bài kiểm tra vẫn nhận lộ trình từ hồ sơ khai báo, kể cả khi chọn Kanji.
- Người học hiện có (đã đăng ký trước khi có tính năng này) không bị thay đổi hồ sơ hay lộ trình tự động; Kanji chỉ xuất hiện khi họ chủ động chọn.
- Việc học Kanji miễn phí như phần còn lại của sản phẩm; Web vẫn là mục tiêu phân phối duy nhất.
- Hệ thống kế hoạch hằng ngày, ôn tập lặp lại ngắt quãng, theo dõi tiến độ, quản trị nội dung và nhật ký quản trị của spec `001-phase1-mvp` đã hoàn tất và được tái sử dụng; spec này chỉ mở rộng chúng cho Kanji.
