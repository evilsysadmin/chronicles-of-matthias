# Chronicles of Matthias API. Build context: api/ (the vendored Chess Studio
# module + our command). Cross-compiles on the runner for each target arch;
# OCI A1 staging is linux/arm64.
FROM --platform=$BUILDPLATFORM golang:1.27.3-alpine3.23 AS build
ARG TARGETOS
ARG TARGETARCH
ARG EXPECTED_GO_VERSION=1.27.3
# Refuse implicit compiler switches during downloads and final compilation.
ENV GOTOOLCHAIN=local
WORKDIR /src
# Pin validation happens inside the actual builder, not only on the CI runner.
RUN test "$(GOTOOLCHAIN=local go env GOVERSION)" = "go${EXPECTED_GO_VERSION}"
RUN apk add --no-cache ca-certificates
COPY go.mod go.sum ./
# Go already checks go.sum; also catch post-download module-cache modification.
RUN go mod download && go mod verify
COPY internal/ ./internal/
COPY cmd/ ./cmd/
# GO-2026-5932 has no patched x/crypto/openpgp release. Inspect the
# actual target-platform dependency graph inside the release Docker builder.
RUN set -eu; \
    deps="$(CGO_ENABLED=0 GOTOOLCHAIN=local GOOS="$TARGETOS" GOARCH="$TARGETARCH" go list -deps ./cmd/chronicles-api)"; \
    if printf '%s\n' "$deps" | grep -Eq '^golang[.]org/x/crypto/openpgp(/|$)'; then \
      echo "GO-2026-5932: forbidden legacy OpenPGP import in $TARGETOS/$TARGETARCH" >&2; \
      exit 1; \
    fi
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/chronicles-api ./cmd/chronicles-api
RUN set -eu; \
    test "$(go version /out/chronicles-api)" = "/out/chronicles-api: go${EXPECTED_GO_VERSION}"; \
    go version -m /out/chronicles-api | grep -Fqx "$(printf '\tbuild\tGOOS=%s' "$TARGETOS")"; \
    go version -m /out/chronicles-api | grep -Fqx "$(printf '\tbuild\tGOARCH=%s' "$TARGETARCH")"

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
