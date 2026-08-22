# AI Room Manager — Backend Service

The primary documentation and company-level system overview is maintained at the root repository level:

👉 **[View Main Project Documentation (README.md)](../README.md)**

---

## 📚 Authoritative Architecture & Contract Documentation

- **[REST API Reference Guide](./docs/api-documentation.md)** — Complete HTTP endpoints, request/response payloads, status codes, and state transition matrix.
- **[MQTT Broker & Telemetry Contract](./docs/mqtt-contract.md)** — Authoritative topic taxonomy, ESP32 payload formats, QoS, and boundary rules.
- **[Engineering & Architecture Lawbook (`AGENTS.md`)](./AGENTS.md)** — Non-negotiable architectural invariants, validation rules, error handling, and testing bars.

---

## ⚡ Quick Backend Commands

```bash
# Install dependencies
bun install

# Run database migrations
npx prisma migrate dev

# Seed database with sample hotel, users, and rooms
bun run seed

# Run unit tests
bun run test

# Run test coverage
bun run test:cov

# Run development server
bun run start:dev

# Interactive OpenAPI / Swagger UI
# http://localhost:3000/docs
```
