# Multi-stage build producing BOTH the headscale binary (with the embedded web
# UI) and the standalone web backend binary, in a single image. Compose runs the
# two as separate services from this image.

# 1) Build the web UI (React -> static files embedded by headscale at compile).
FROM node:22-bookworm-slim AS webbuild
WORKDIR /src/web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

# 2) Build the Go binaries.
FROM golang:1.27-bookworm AS gobuild
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Bring in the prebuilt web UI so //go:embed picks it up.
COPY --from=webbuild /src/web/dist ./hscontrol/webui/dist
RUN go build -o /out/headscale ./cmd/headscale
RUN go build -o /out/webbackend ./cmd/webbackend

# 3) Runtime image.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=gobuild /out/headscale /usr/local/bin/headscale
COPY --from=gobuild /out/webbackend /usr/local/bin/webbackend
# Default data dirs (override with volumes).
RUN mkdir -p /var/lib/headscale /var/lib/webui
EXPOSE 8080 8090
ENTRYPOINT ["/usr/local/bin/headscale"]
CMD ["serve"]
