# --- Tầng build ---
FROM node:22-alpine AS build

WORKDIR /app

# Copy manifest riêng để tận dụng cache: deps chỉ cài lại khi manifest đổi.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# --- Tầng chạy ---
FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:7860/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
