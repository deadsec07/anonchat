# Ultra‑Low‑Cost Anonymous Chat (AWS)

A minimal, mobile‑friendly anonymous chat built on ultra low cost AWS primitives:

- Static frontend on S3 (optional CloudFront later)
- WebSocket API (API Gateway v2) + Lambda
- DynamoDB (on‑demand) for connections and room membership with TTL cleanup

Aiming for <$2/month at light usage by paying only per message + invocations and keeping storage small/ephemeral.

## Features

- Anonymous, room‑based chat (no sign‑up)
- WebSocket real‑time messaging via API Gateway
- DynamoDB stores active connections with TTL
- Simple, responsive UI for mobile
- Local dev options via DynamoDB Local and a tiny WS dev server

## Architecture

- `API Gateway WebSocket` routes:
  - `$connect` → `connect` Lambda: registers connection (with TTL)
  - `$disconnect` → `disconnect` Lambda: removes connection
  - `join` → `join` Lambda: sets room + alias, notifies room
  - `send` → `send` Lambda: broadcasts message to the room
- `DynamoDB` table tracks `connectionId`, `roomId`, `alias`, and expiry (name is prefixed with app/env to avoid collisions).
- `Lambda` uses `ApiGatewayManagementApi.postToConnection` to push messages to connected clients.

## Cost Notes (ballpark)

- DynamoDB on‑demand for a small table at light traffic typically pennies/month. TTL removes stale items.
- API Gateway WebSocket charges per message/connection minutes; with low traffic you stay under a couple dollars.
- Lambda: few ms per invocation; often < $0.10 at low volume.
- S3 static hosting: pennies depending on GB/requests.

Keep messages ephemeral and prune aggressively to keep storage low. Avoid constant pings from clients.

## Repo Layout

- `backend/` – Lambda handlers (used by CDK stack)
- `infra-cdk/` – CDK stack (WebSocket API, Lambdas, DynamoDB, S3 website bucket)
- `frontend/` – static SPA (Tailwind-based, no build step)
- `local/` – optional local WS dev server to test the frontend UI

## Prereqs

- AWS account + credentials (for deploy)
- Node.js 18+
- DynamoDB Local (optional for local dev)
- LocalStack (optional; WebSocket API emulation requires Pro; not necessary if using the provided local WS dev server)
 - AWS CDK v2 CLI (`npm i -g aws-cdk`)

## Quick Start

1) Configure frontend endpoint

- Copy `frontend/config.example.js` → `frontend/config.js` and set `wsUrl`:
  - After deploy: `wss://<api-id>.execute-api.<region>.amazonaws.com/$default`
  - Local dev (optional local WS): `ws://localhost:3001`

2) Local development (no AWS)

- This uses a minimal Node WebSocket server to simulate backend flows.
- Install deps and run:

```
cd local
npm init -y
npm install ws
node ws-dev-server.js
```

- Open `frontend/index.html` (via a local web server recommended) and set `frontend/config.js` to `ws://localhost:3001`.

Note: The local server is only for iterative UI testing. Real behavior (API GW/Lambda semantics) is covered in AWS.

3) Deploy to AWS with CDK (prod only)

- Bootstrap once per account+region if needed:

```
cd infra-cdk
npm ci
npx cdk bootstrap
```

- Deploy:

```
npx cdk deploy
```

- Output includes the WebSocket URL; set it in `frontend/config.js` as `wsUrl`.

4) Host the frontend

- The CDK stack creates an S3 static website bucket and outputs its name and website URL.
- Use the provided GitHub Action (Frontend Deploy) or sync manually:

```
aws s3 sync frontend s3://<WebsiteBucketName>/ --delete --exclude index.html --cache-control max-age=31536000,public
aws s3 cp frontend/index.html s3://<WebsiteBucketName>/index.html --cache-control no-store
```

## Testing

- Join same room from two browser tabs/devices, send messages, confirm broadcast.
- Disconnect a tab and check it vanishes on next broadcast (stale connections are auto‑cleaned when `postToConnection` returns `410 Gone`).

## Cleanup

- `cdk destroy` from `infra-cdk/` when done.
- Empty/tear down S3 bucket for frontend if used.

## Notes

- This stack stores minimal state to keep costs low. Additions like persistence or moderation can be layered on with care.
- If you need LocalStack integration for WebSockets, note that community edition may not emulate API Gateway WebSocket; the provided local WS server is recommended for UI iteration.

### Cost guardrails implemented

- Lambda reserved concurrency capped at 10 per function to prevent runaway costs.
- CloudWatch Logs retention set to 1 week for all Lambdas.
- Basic per-connection rate limiting (30 msgs/min) with polite client notice.
- Presence count broadcast on join/leave; frontend shows online count.

## GitHub Actions

- Infra CDK Deploy: runs only when a PR into `main` is merged.
- Frontend Deploy: runs only when a PR into `main` is merged; discovers the stack outputs (WebSocket URL + Website bucket), generates `frontend/config.js` automatically, and syncs the site to S3. No extra secrets required beyond AWS creds.

Resources are tagged (`Project=anonchat`) and prefixed with `anonchat` to reduce confusion in accounts with other infra.
