<p align="center">
  <img src="docs/logo/openwa_logo.webp" alt="WhatsGate Logo" width="200"/>
</p>

<h1 align="center">WhatsGate</h1>
<p align="center">
  <strong>WhatsApp Gateway for APIs, Webhooks, and Automation</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-documentation">Docs</a> •
  <a href="#-api-examples">API</a> •
  <a href="#-contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.4-blue.svg" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"/>
  <img src="https://img.shields.io/badge/node-22_LTS-brightgreen.svg" alt="Node"/>
  <img src="https://img.shields.io/badge/NestJS-11.x-red.svg" alt="NestJS"/>
  <img src="https://img.shields.io/badge/self--hosted-ready-brightgreen.svg" alt="Self-Hosted"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6.svg" alt="TypeScript"/>
</p>

---

## ✨ Why WhatsGate?

**WhatsGate** is a free, open-source WhatsApp API Gateway designed for developers who need full control over their messaging infrastructure—without vendor lock-in or hidden paywalls.

Built on a modular architecture, WhatsGate uses **PostgreSQL as the single source of truth** for persisted data, with pluggable storage backends (Local/S3) and cache layers (Memory/Redis).

| 🔓 **100% Open Source**       | No licensing fees, no feature locks, full source code access |
| 🏗️ **Pluggable Architecture** | Swap adapters for database, storage, and cache via config    |
| 🔹 **Multi-Session Ready**    | Run multiple WhatsApp sessions concurrently on one instance  |
| 🔗 **n8n Integration**        | Community nodes for workflow automation                      |

---

## 🎯 Features

### Core Features

| Feature       | Status | Description                          |
| ------------- | ------ | ------------------------------------ |
| REST API      | ✅     | Full WhatsApp API via HTTP endpoints |
| Multi-Session | ✅     | Manage multiple WhatsApp accounts    |
| Webhooks      | ✅     | Real-time events with HMAC signature |
| API Key Auth  | ✅     | Secure API authentication            |
| Swagger Docs  | ✅     | Interactive API documentation        |

### Messaging

| Feature           | Status | Description                      |
| ----------------- | ------ | -------------------------------- |
| Text Messages     | ✅     | Send/receive text messages       |
| Media Messages    | ✅     | Images, videos, documents, audio |
| Message Reactions | ✅     | React to messages with emoji     |
| Bulk Messaging    | ✅     | Send to multiple recipients      |
| Message Status    | ✅     | Track delivery and read receipts |

### Advanced

| Feature             | Status | Description                        |
| ------------------- | ------ | ---------------------------------- |
| Groups API          | ✅     | Create, manage, and message groups |
| Channels/Newsletter | ✅     | WhatsApp Channels support          |
| Labels Management   | ✅     | Organize chats with labels         |
| Proxy Support       | ✅     | Per-session proxy configuration    |
| Rate Limiting       | ✅     | Configurable request limits        |
| CIDR Whitelisting   | ✅     | IP-based access control            |
| Audit Logging       | ✅     | Track all API operations           |

### Infrastructure

| Feature          | Status | Description                    |
| ---------------- | ------ | ------------------------------ |
| PostgreSQL       | ✅     | Single source-of-truth database |
| Redis Cache      | ✅     | Optional performance caching   |
| S3 Storage       | ✅     | Scalable media storage         |
| Health Checks    | ✅     | Kubernetes-ready probes        |
| Data Migration   | ✅     | Export/import between backends |

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/rmyndharis/whatsgate.git
cd whatsgate

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Start the API
npm run dev

# Access
# API: http://localhost:2785/api
# Swagger: http://localhost:2785/api/docs
```

---

## 🏭 Production Deployment

WhatsGate is a standard Node.js application — deploy it anywhere Node.js runs.

```bash
git clone https://github.com/rmyndharis/whatsgate.git
cd whatsgate
npm install

# Configure environment
cp .env.example .env
# Edit .env: set NODE_ENV=production, DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, API_MASTER_KEY, etc.

# Build and start
npm run build
node dist/main
```

> **Tip**: Use a process manager like [PM2](https://pm2.keymetrics.io/) to keep the service running and restart on failure:
> ```bash
> npm install -g pm2
> pm2 start dist/main.js --name whatsgate
> pm2 save && pm2 startup
> ```

## 🔌 Ports

| Service | Port            | Description          |
| ------- | --------------- | -------------------- |
| API     | `2785`          | REST API endpoints   |
| Swagger | `2785/api/docs` | Interactive API docs |

---

## 📡 API Examples

### Create a Session

```bash
curl -X POST http://localhost:2785/api/sessions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"name": "my-bot"}'
```

### Start Session & Get QR Code

```bash
# Start the session
curl -X POST http://localhost:2785/api/sessions/{sessionId}/start \
  -H "X-API-Key: YOUR_API_KEY"

# Get QR code (scan with WhatsApp)
curl http://localhost:2785/api/sessions/{sessionId}/qr \
  -H "X-API-Key: YOUR_API_KEY"
```

### Send a Message

```bash
curl -X POST http://localhost:2785/api/sessions/{sessionId}/messages/send-text \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "chatId": "628123456789@c.us",
    "text": "Hello from WhatsGate!"
  }'
```

### Setup Webhook

```bash
curl -X POST http://localhost:2785/api/sessions/{sessionId}/webhooks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["message.received", "session.status"],
    "secret": "your-hmac-secret"
  }'
```

---

## 🛠 Tech Stack

| Layer         | Technology              |
| ------------- | ----------------------- |
| **Runtime**   | Node.js 22 LTS          |
| **Framework** | NestJS 11.x             |
| **Language**  | TypeScript 5.x          |
| **WA Engine** | whatsapp-web.js         |
| **Database**  | PostgreSQL              |
| **Cache**     | Redis (optional)        |
| **Storage**   | Local / S3              |
| **ORM**       | TypeORM                 |

---

## 📁 Project Structure

```
whatsgate/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── app.module.ts           # Root module
│   ├── config/                 # Configuration
│   ├── common/                 # Shared utilities
│   │   ├── cache/              # Redis caching
│   │   └── storage/            # File storage (Local/S3)
│   ├── core/                   # Core systems
│   │   ├── hooks/              # Plugin hooks
│   │   └── plugins/            # Plugin system
│   ├── engine/                 # WhatsApp engine abstraction
│   └── modules/
│       ├── session/            # Session management
│       ├── message/            # Message handling
│       ├── webhook/            # Webhook management
│       ├── group/              # Groups API
│       ├── contact/            # Contacts API
│       ├── auth/               # API key authentication
│       ├── infra/              # Infrastructure management
│       └── health/             # Health checks
├── docs/                      # Documentation
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## 📚 Documentation

Comprehensive documentation is available in the `docs/` folder:

| Document                                                | Description                  |
| ------------------------------------------------------- | ---------------------------- |
| [Project Overview](./docs/01-project-overview.md)       | Introduction and goals       |
| [Requirements](./docs/02-requirements-specification.md) | Feature specifications       |
| [Architecture](./docs/03-system-architecture.md)        | System design                |
| [Security](./docs/04-security-design.md)                | Security implementation      |
| [Database](./docs/05-database-design.md)                | Data models and migrations   |
| [API Spec](./docs/06-api-specification.md)              | Complete API reference       |
| [Development](./docs/08-development-guidelines.md)      | Coding standards             |
| [Migration Guide](./docs/14-migration-guide.md)         | Database & storage migration |

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** your feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

Please read our [Development Guidelines](./docs/08-development-guidelines.md) for coding standards and best practices.

---

## 📄 License

This project is licensed under the **MIT License** – free for personal and commercial use.

See [LICENSE](./LICENSE) for details.

---

<div align="center">

**WhatsGate** – WhatsApp Gateway for APIs, Webhooks, and Automation

[📖 Documentation](./docs/README.md) · [🔌 API Docs](http://localhost:2785/api/docs) · [🐛 Report Bug](https://github.com/rmyndharis/whatsgate/issues) · [💡 Request Feature](https://github.com/rmyndharis/whatsgate/issues)

<br/>

<sub>Made with ❤️ by <a href="https://github.com/rmyndharis">Yudhi Armyndharis</a> and the WhatsGate Community</sub>

</div>
