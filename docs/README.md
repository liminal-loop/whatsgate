<p align="center">
  <img src="logo/whatsgate_brand.svg" alt="WhatsGate Logo" width="360"/>
</p>

<h1 align="center">WhatsGate Documentation</h1>
<p align="center">
  <strong>WhatsApp Gateway for APIs, Webhooks, and Automation</strong>
</p>

<p align="center">
  <a href="#features-current">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation-map">Docs</a> •
  <a href="#api-example">API</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.5-blue.svg" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"/>
  <img src="https://img.shields.io/badge/node-26-brightgreen.svg" alt="Node"/>
  <img src="https://img.shields.io/badge/NestJS-11.x-red.svg" alt="NestJS"/>
  <img src="https://img.shields.io/badge/docker-ready-blue.svg" alt="Docker"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6.svg" alt="TypeScript"/>
</p>

---

## Documentation Map

**Full Index (by number)**

| No  | Document                                                         | Description                                       |
| --- | ---------------------------------------------------------------- | ------------------------------------------------- |
| 01  | [Project Overview](./01-project-overview.md)                     | Vision, goals, scope, current status              |
| 02  | [Requirements Specification](./02-requirements-specification.md) | Functional and non-functional requirements        |
| 03  | [System Architecture](./03-system-architecture.md)               | Architecture, modules, and runtime flows          |
| 04  | [Security Design](./04-security-design.md)                       | Auth, rate limiting, and security controls        |
| 05  | [Database Design](./05-database-design.md)                       | Entities and storage considerations               |
| 06  | [API Specification](./06-api-specification.md)                   | REST API and WebSocket protocol                   |
| 07  | [API Collection](./07-api-collection.md)                         | Example requests and Postman import tips          |
| 08  | [Development Guidelines](./08-development-guidelines.md)         | Coding standards and workflow                     |
| 09  | [Testing Strategy](./09-testing-strategy.md)                     | Test types and tooling                            |
| 10  | [DevOps & Infrastructure](./10-devops-infrastructure.md)         | Docker, deployment, and environment configuration |
| 11  | [Operational Runbooks](./11-operational-runbooks.md)             | Incident, maintenance, and backup runbooks        |
| 12  | [Troubleshooting FAQ](./12-troubleshooting-faq.md)               | Common issues and fixes                           |
| 13  | [Horizontal Scaling](./13-horizontal-scaling.md)                 | Multi-node deployment guidance                    |
| 14  | [Migration Guide](./14-migration-guide.md)                       | Upgrade and data migration guidance               |
| 15  | [Project Roadmap](./15-project-roadmap.md)                       | Near-term and long-term roadmap                   |
| 16  | [Risk Management](./16-risk-management.md)                       | Risks and mitigations                             |
| 17  | [Dashboard Design](./17-dashboard-design.md)                     | Dashboard UX overview                             |
| 18  | [SDK Design](./18-sdk-design.md)                                 | SDK design and v1 preview availability            |
| 19  | [Plugin Architecture](./19-plugin-architecture.md)               | Extensibility concepts                            |
| 20  | [Community Guidelines](./20-community-guidelines.md)             | Contribution and governance                       |
| 21  | [Glossary](./21-glossary.md)                                     | Terms and definitions                             |
| 22  | [n8n Integration](./22-n8n-integration.md)                       | n8n community nodes for WhatsGate                 |

## Quick Start

### Option A: Minimal Setup (PostgreSQL, no Docker services)

```bash
# Clone repository
git clone https://github.com/rmyndharis/whatsgate.git
cd whatsgate

# Install & configure
npm ci
cp .env.example .env

# Create data directories
mkdir -p data/sessions data/media

# Run
npm run start:dev
```

Access:

- API: `http://localhost:2785/api`
- Swagger: `http://localhost:2785/api/docs`
- Health: `http://localhost:2785/api/health`

### Option B: Docker (Traefik + API + Dashboard)

```bash
# Clone repository
git clone https://github.com/rmyndharis/whatsgate.git
cd whatsgate

# Start services
docker compose up -d
```

Access:

- Dashboard: `http://localhost:2886`
- API: `http://localhost:2785/api`
- Swagger: `http://localhost:2785/api/docs`
- Traefik (optional): `http://localhost:2886/api`

### API Key

WhatsGate generates a cryptographically-random API key on first run and prints it to the application log. Retrieve it from the startup output or create additional keys via the API (see [API Specification](./06-api-specification.md)).

## API Example

```bash
# Create a session
curl -X POST http://localhost:2785/api/sessions \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-bot"}'

# Start the session
curl -X POST http://localhost:2785/api/sessions/{sessionId}/start \
  -H "X-API-Key: your-api-key"

# Get QR code (base64)
curl http://localhost:2785/api/sessions/{sessionId}/qr \
  -H "X-API-Key: your-api-key"

# Send a message
curl -X POST http://localhost:2785/api/sessions/{sessionId}/messages/send-text \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"chatId": "628123456789@c.us", "text": "Hello from WhatsGate!"}'
```

## WebSocket Example (Socket.IO)

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:2785/events', {
  extraHeaders: { 'X-API-Key': 'your-api-key' },
  transports: ['websocket'],
});

socket.on('connect', () => {
  socket.emit('message', {
    type: 'subscribe',
    sessionId: 'sess_abc123',
    events: ['message.received', 'session.status'],
    requestId: 'req_001',
  });
});

socket.on('message', msg => {
  if (msg.type === 'event') {
    console.log('Event:', msg.payload.event, msg.payload.data);
  }
});
```

## Features (Current)

| Feature                         | Status                        |
| ------------------------------- | ----------------------------- |
| REST API for WhatsApp           | Ready                         |
| WebSocket Events (Socket.IO)    | Ready                         |
| Multi-session Support           | Ready                         |
| Web Dashboard                   | Ready                         |
| Docker + Traefik Deployment     | Ready                         |
| Webhooks with HMAC Signature    | Ready                         |
| PostgreSQL Storage              | Ready                         |
| API Key Authentication & Roles  | Ready                         |
| Session-Scoped API Keys         | Ready (fail-closed)           |
| CIDR IP Allowlisting            | Ready (fail-closed)           |
| Rate Limiting                   | Ready                         |
| Audit Logging                   | Ready                         |
| Groups / Contacts / Labels API  | Ready                         |
| Channels / Status / Catalog API | Experimental (engine-limited) |
| Queue-based Webhook Retries     | Optional (QUEUE_ENABLED=true) |
| TypeScript/Python SDKs          | Preview (source in repository)|

## Tech Stack

| Layer     | Technology                    |
| --------- | ----------------------------- |
| Runtime   | Node.js 26                    |
| Framework | NestJS 11.x                   |
| Language  | TypeScript 5.9.x              |
| WA Engine | whatsapp-web.js 1.34.x        |
| WebSocket | Socket.IO                     |
| Database  | PostgreSQL                    |
| ORM       | TypeORM (synchronize, v1)     |
| Container | Docker + Docker Compose       |
| Dashboard | React + Vite + TanStack Query |

## Project Structure

```
WhatsGate/
├── src/                    # Backend source code
├── sdk/                    # Official SDKs (JS/TS and Python preview)
├── docs/                   # Project documentation
├── scripts/                # Shell and bootstrap scripts
└── test/                   # E2E tests and test configuration
```

## Contributing

See [Development Guidelines](./08-development-guidelines.md) for coding standards and workflow.

## License

MIT License.

---

<div align="center">

**Start Reading: [01 - Project Overview](./01-project-overview.md)**

_WhatsGate Documentation · Last updated: 2026-02-05_

</div>
