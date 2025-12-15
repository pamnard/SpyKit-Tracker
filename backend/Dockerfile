FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY . .
RUN go mod tidy
RUN go mod download

RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/backend .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /bin/backend /app/backend

EXPOSE 3000
CMD ["/app/backend"]
