# Image client web (T118): build tĩnh bằng `flutter build web` rồi phục vụ qua nginx.
#   docker build -t japanese-learning-web ./client
# Đổi phiên bản Flutter bằng --build-arg FLUTTER_VERSION=<tag> (khuyến nghị ghim phiên bản khi phát hành).
ARG FLUTTER_VERSION=stable

FROM ghcr.io/cirruslabs/flutter:${FLUTTER_VERSION} AS build
WORKDIR /app/client
COPY . .

# Mã sinh từ OpenAPI đã commit (đã vá); chỉ cần sinh các file json_serializable (*.g.dart, bị .gitignore).
WORKDIR /app/client/lib/data/api/generated
RUN dart pub get && dart run build_runner build --delete-conflicting-outputs

WORKDIR /app/client
RUN flutter pub get
# --no-web-resources-cdn: CanvasKit và phông phục vụ từ chính origin để CSP `default-src 'self'` có hiệu lực.
RUN flutter build web --release --no-web-resources-cdn --base-href /

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/build/web /usr/share/nginx/html
# Chứng chỉ TLS được gắn vào /etc/nginx/certs (fullchain.pem, privkey.pem) khi chạy; xem backend/README.md.
EXPOSE 80 443
