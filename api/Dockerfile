# Chronicles of Matthias API. Build context: api/ (the vendored Chess Studio
# module + our command). Cross-compiles on the runner for each target arch;
# OCI A1 staging is linux/arm64.
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
RUN apk add --no-cache ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY internal/ ./internal/
COPY cmd/ ./cmd/
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/chronicles-api ./cmd/chronicles-api

FROM scratch
# Immutable source revision is published by /api/release and cannot be
# inferred from a successful health check. The source workflow supplies it.
ARG CHRONICLES_SOURCE_SHA
ENV GIT_COMMIT_SHA=${CHRONICLES_SOURCE_SHA}
COPY --from=build /out/chronicles-api /app/chronicles-api
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD ["/app/chronicles-api", "healthcheck"]
ENTRYPOINT ["/app/chronicles-api"]
