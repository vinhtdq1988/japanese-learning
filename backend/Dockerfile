# Image API (T118). Ngữ cảnh build là THƯ MỤC GỐC kho mã (cần cả `content/`):
#   docker build -f backend/Dockerfile -t japanese-learning-api .
# docker-compose.yml đã cấu hình sẵn ngữ cảnh này.

FROM node:22-slim AS build
WORKDIR /srv/backend
RUN corepack enable
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/tests ./tests
COPY backend/vitest.config.ts ./
RUN pnpm build
# tsc không chép file .sql; migration và truy vấn báo cáo chạy từ dist/src.
RUN mkdir -p dist/src/db/migrations dist/src/reports \
 && cp src/db/migrations/*.sql dist/src/db/migrations/ \
 && cp src/reports/*.sql dist/src/reports/

FROM node:22-slim AS prod-deps
WORKDIR /srv/backend
RUN corepack enable
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /srv/backend
COPY --from=prod-deps /srv/backend/node_modules ./node_modules
COPY --from=build /srv/backend/dist/src ./dist/src
COPY backend/package.json ./
# Nội dung gốc cho `node dist/src/seed/index.js` (đường dẫn tương đối ../../../content so với dist/src/seed).
COPY content ./content
# Phông Noto Sans JP đóng gói cho client: backend đọc bảng cmap để chặn nội dung Kanji thiếu glyph (FONT_PATH mặc định).
COPY client/assets/fonts/NotoSansJP.ttf ./client/assets/fonts/NotoSansJP.ttf
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migration chạy trước khi nhận yêu cầu (có khóa advisory nên nhiều bản sao khởi động đồng thời vẫn an toàn).
CMD ["sh", "-c", "node dist/src/db/migrate.js && node dist/src/server.js"]
