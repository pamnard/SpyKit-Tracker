FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY . .
RUN go mod tidy
RUN go mod download

# Build the processor binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/processor ./cmd/processor

FROM alpine:latest
WORKDIR /app
COPY --from=builder /bin/processor /app/processor

EXPOSE 8080
CMD ["/app/processor"]

