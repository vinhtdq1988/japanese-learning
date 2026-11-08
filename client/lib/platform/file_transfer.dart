// Giao diện chuyển tệp CSV giữa người dùng và ứng dụng (Nguyên tắc V, research O18): chọn tệp CSV để nhập
// danh sách học viên và lưu tệp CSV báo cáo lớp. Mọi truy cập API trình duyệt (chọn/tải tệp) nằm ở
// `platform/web/file_transfer_web.dart`; `domain/data/presentation` chỉ biết giao diện này.

/// Chọn và lưu tệp CSV. Web: hộp thoại chọn tệp và tải xuống qua trình duyệt; mobile sau này: hộp thoại
/// hệ thống/chia sẻ, thay bằng triển khai khác mà không đụng vào tầng trên.
abstract interface class FileTransfer {
  /// Mở hộp thoại chọn một tệp CSV và trả nội dung văn bản (UTF-8) của tệp; `null` nếu người dùng hủy
  /// hoặc không đọc được tệp. Nội dung được gửi nguyên văn lên máy chủ (`text/csv`), không phân tích ở client.
  Future<String?> pickCsv();

  /// Lưu [bytes] thành tệp CSV tên [filename] (người dùng thấy hộp thoại/thanh tải xuống). Byte do caller
  /// tạo sẵn (đã có BOM UTF-8 nếu là báo cáo từ máy chủ) và được ghi nguyên vẹn.
  Future<void> saveCsv(String filename, List<int> bytes);
}
