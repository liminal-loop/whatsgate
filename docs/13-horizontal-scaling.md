# 13 - Horizontal Scaling Guide

This guide explains how to deploy WhatsGate in a horizontally scaled environment for high availability and increased capacity.

## 13.1 Architecture Overview

```mermaid
flowchart TB
    subgraph LB["Load Balancer"]
        NGINX[Nginx/Traefik]
    end

    subgraph Nodes["WhatsGate Nodes"]
        N1[WhatsGate Node 1]
        N2[WhatsGate Node 2]
        N3[WhatsGate Node 3]
    end

    subgraph Storage["Shared Storage"]
        PG[(PostgreSQL)]
        REDIS[(Redis)]
        S3[S3/MinIO<br/>Media Storage]
    end

    LB --> N1
    LB --> N2
    LB --> N3

    N1 --> PG
    N2 --> PG
    N3 --> PG

    N1 --> REDIS
    N2 --> REDIS
    N3 --> REDIS

    N1 --> S3
    N2 --> S3
    N3 --> S3
```

### Key Principles

| Principle            | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| **Session Affinity** | WhatsApp sessions are stateful and must stay on the same node |
| **Shared Database**  | PostgreSQL stores all persistent data across nodes            |
| **Redis for State**  | Shared cache and queue coordination                           |
| **Sticky Sessions**  | Load balancer routes session requests to the correct node     |

## 13.2 Session Affinity Strategy

Since WhatsApp sessions maintain WebSocket connections and browser instances, they cannot be freely moved between nodes.

### Strategy 1: Session-to-Node Mapping (Recommended)

Store session-node mapping in the database:

```sql
-- Sessions table includes node assignment
ALTER TABLE sessions ADD COLUMN node_id VARCHAR(50);
ALTER TABLE sessions ADD COLUMN node_url VARCHAR(255);
```

The load balancer reads the mapping and routes accordingly.

### Strategy 2: Consistent Hashing

Route sessions based on session ID hash:

```typescript
function getNodeForSession(sessionId: string, nodes: string[]): string {
  const hash = crypto.createHash('md5').update(sessionId).digest('hex');
  const index = parseInt(hash.substring(0, 8), 16) % nodes.length;
  return nodes[index];
}
```

### Strategy 3: Session Claim

Each node "claims" sessions on startup and releases them on shutdown.

## 13.3 Docker Swarm Deployment

### docker-compose.swarm.yml

```yaml
version: '3.8'

services:
  whatsgate:
    image: ghcr.io/rmyndharis/whatsgate:0.2.0
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 30s
      restart_policy:
        condition: on-failure
        max_attempts: 3
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M
    environment:
      - NODE_ENV=production
      - DATABASE_TYPE=postgres
      - DATABASE_HOST=postgres
      - DATABASE_NAME=whatsgate
      - DATABASE_USER=whatsgate
      - DATABASE_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - ENABLE_QUEUE=true
      - NODE_ID={{.Node.Hostname}}-{{.Task.Slot}}
    volumes:
      - sessions:/app/data/sessions
    networks:
      - whatsgate-net
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
    environment:
      - POSTGRES_DB=whatsgate
      - POSTGRES_USER=whatsgate
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - whatsgate-net

  redis:
    image: redis:7-alpine
    deploy:
      replicas: 1
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - whatsgate-net

  traefik:
    image: traefik:v3.0
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command:
      - '--providers.swarm=true'
      - '--entrypoints.web.address=:80'
      - '--entrypoints.websecure.address=:443'
    networks:
      - whatsgate-net

volumes:
  postgres-data:
  redis-data:
  sessions:

networks:
  whatsgate-net:
    driver: overlay
```

### Deploy to Swarm

```bash
# Initialize swarm (if not already)
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.swarm.yml whatsgate

# Scale up/down
docker service scale whatsgate_whatsgate=5

# Check status
docker service ls
docker service ps whatsgate_whatsgate
```

## 13.4 Kubernetes Deployment

### k8s/namespace.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: whatsgate
```

### k8s/configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: whatsgate-config
  namespace: whatsgate
data:
  NODE_ENV: 'production'
  DATABASE_TYPE: 'postgres'
  DATABASE_HOST: 'postgres-service'
  DATABASE_PORT: '5432'
  DATABASE_NAME: 'whatsgate'
  REDIS_HOST: 'redis-service'
  REDIS_PORT: '6379'
  ENABLE_QUEUE: 'true'
  API_PORT: '3000'
```

### k8s/secret.yaml

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: whatsgate-secrets
  namespace: whatsgate
type: Opaque
stringData:
  DATABASE_USER: whatsgate
  DATABASE_PASSWORD: your-secure-password
  ADMIN_API_KEY: your-admin-api-key
  WEBHOOK_SECRET: your-webhook-secret
```

### k8s/deployment.yaml

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: whatsgate
  namespace: whatsgate
spec:
  serviceName: whatsgate
  replicas: 3
  selector:
    matchLabels:
      app: whatsgate
  template:
    metadata:
      labels:
        app: whatsgate
    spec:
      containers:
        - name: whatsgate
          image: ghcr.io/rmyndharis/whatsgate:0.2.0
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - configMapRef:
                name: whatsgate-config
            - secretRef:
                name: whatsgate-secrets
          env:
            - name: NODE_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
          resources:
            requests:
              memory: '512Mi'
              cpu: '250m'
            limits:
              memory: '2Gi'
              cpu: '1000m'
          volumeMounts:
            - name: session-data
              mountPath: /app/data/sessions
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
  volumeClaimTemplates:
    - metadata:
        name: session-data
      spec:
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 10Gi
```

### k8s/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: whatsgate-service
  namespace: whatsgate
spec:
  type: ClusterIP
  selector:
    app: whatsgate
  ports:
    - port: 80
      targetPort: 3000
      name: http
---
apiVersion: v1
kind: Service
metadata:
  name: whatsgate-headless
  namespace: whatsgate
spec:
  clusterIP: None
  selector:
    app: whatsgate
  ports:
    - port: 3000
      name: http
```

### k8s/ingress.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: whatsgate-ingress
  namespace: whatsgate
  annotations:
    nginx.ingress.kubernetes.io/affinity: 'cookie'
    nginx.ingress.kubernetes.io/session-cookie-name: 'whatsgate-session'
    nginx.ingress.kubernetes.io/session-cookie-max-age: '172800'
spec:
  ingressClassName: nginx
  rules:
    - host: whatsgate.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: whatsgate-service
                port:
                  number: 80
  tls:
    - hosts:
        - whatsgate.example.com
      secretName: whatsgate-tls
```

### Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check pods
kubectl get pods -n whatsgate

# Check logs
kubectl logs -f deployment/whatsgate -n whatsgate

# Scale
kubectl scale statefulset whatsgate --replicas=5 -n whatsgate
```

## 13.5 Load Balancer Configuration

### Traefik Dynamic Config

```yaml
# traefik/dynamic-scaling.yml
http:
  routers:
    whatsgate:
      rule: 'Host(`whatsgate.example.com`)'
      service: whatsgate
      middlewares:
        - sticky-session

  middlewares:
    sticky-session:
      headers:
        customResponseHeaders:
          X-WhatsGate-Node: '{{.Node}}'

  services:
    whatsgate:
      loadBalancer:
        sticky:
          cookie:
            name: whatsgate_node
            secure: true
            httpOnly: true
        servers:
          - url: 'http://whatsgate-1:2785'
          - url: 'http://whatsgate-2:2785'
          - url: 'http://whatsgate-3:2785'
        healthCheck:
          path: /api/health
          interval: 10s
          timeout: 3s
```

### Nginx Upstream Config

```nginx
upstream whatsgate {
    ip_hash;  # Sticky sessions based on client IP

    server whatsgate-1:2785 weight=1 max_fails=3 fail_timeout=30s;
    server whatsgate-2:2785 weight=1 max_fails=3 fail_timeout=30s;
    server whatsgate-3:2785 weight=1 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name whatsgate.example.com;

    location / {
        proxy_pass http://whatsgate;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Session affinity cookie
        proxy_cookie_path / "/; SameSite=Strict; HttpOnly";
    }

    location /api/health {
        proxy_pass http://whatsgate;
        proxy_connect_timeout 5s;
        proxy_read_timeout 5s;
    }
}
```

## 13.6 Capacity Planning

### Resource Requirements per Node

| Sessions | Memory | CPU      | Disk  |
| -------- | ------ | -------- | ----- |
| 1-5      | 1 GB   | 0.5 vCPU | 5 GB  |
| 5-10     | 2 GB   | 1 vCPU   | 10 GB |
| 10-25    | 4 GB   | 2 vCPU   | 25 GB |
| 25-50    | 8 GB   | 4 vCPU   | 50 GB |

### Scaling Guidelines

| Metric                        | Threshold  | Action     |
| ----------------------------- | ---------- | ---------- |
| CPU > 80%                     | 5 minutes  | Scale up   |
| Memory > 85%                  | 5 minutes  | Scale up   |
| CPU < 30%                     | 15 minutes | Scale down |
| Active sessions per node > 20 | -          | Scale up   |

### Benchmarks

Tested on 2 vCPU / 4GB RAM nodes:

| Nodes | Sessions | Messages/sec | p95 Latency |
| ----- | -------- | ------------ | ----------- |
| 1     | 10       | 50           | 150ms       |
| 3     | 30       | 150          | 180ms       |
| 5     | 50       | 250          | 200ms       |

## 13.7 Monitoring

### Prometheus Metrics (Future)

```yaml
# prometheus/whatsgate-rules.yaml
groups:
  - name: whatsgate
    rules:
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes{container="whatsgate"} > 1.8e9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'WhatsGate node high memory usage'

      - alert: NodeDown
        expr: up{job="whatsgate"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'WhatsGate node is down'
```

### Health Check Endpoints

| Endpoint               | Purpose                         |
| ---------------------- | ------------------------------- |
| `/api/health`          | Liveness probe                  |
| `/api/health/ready`    | Readiness probe                 |
| `/api/health/detailed` | Full status with DB/Redis check |
---

<div align="center">

[← 12 - Troubleshooting & FAQ](./12-troubleshooting-faq.md) · [Documentation Index](./README.md) · [Next: 14 - Migration Guide →](./14-migration-guide.md)

</div>
