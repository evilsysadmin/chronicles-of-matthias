FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY cmd/ ./cmd/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/chronicles-api ./cmd/chronicles-api

FROM scratch
COPY --from=build /out/chronicles-api /app/chronicles-api
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/app/chronicles-api"]
