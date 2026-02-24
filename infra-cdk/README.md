# Anon Chat – CDK Infra

This CDK app deploys an ultra‑low‑cost anonymous chat backend:

- API Gateway v2 WebSocket (`$connect`, `$disconnect`, `join`, `send`)
- Lambda handlers (re‑using code in `../backend/src/handlers`)
- DynamoDB PAY_PER_REQUEST table with TTL and room GSI
- Private S3 website bucket fronted by CloudFront (Price Class 200)

Resources are prefixed with `{appName}-{env}` and tagged (`Project=anon-chat`) to avoid collisions in accounts with other infra.

## Usage

- Install deps and bootstrap (once per account/region):

```
npm ci
npx cdk bootstrap
```

- Deploy:

```
npx cdk deploy -c env=dev -c appName="anon-chat"
```

- Destroy:

```
npx cdk destroy -c env=dev -c appName="anon-chat"
```

Outputs include the WebSocket URL for the frontend `wsUrl`, the website bucket name, CloudFront domain (`WebsiteUrl`), and distribution id.

## Naming & Multi‑stack Accounts

- Stack name defaults to `anonchat`. You can customize via context or env:

```
# using context
npx cdk deploy -c appName="anonchat"

# or environment variables
APP_NAME=anonchat npx cdk deploy
```

- Resources are prefixed as `{appName}` (e.g., `anonchat-Connections`). This avoids collisions as long as `appName` is unique in your account/region.
- Reserved concurrency is not set to avoid partitioning regional concurrency from other apps.

## Notes

- The Lambda runtime is Node.js 18. Code is packaged from `../backend/src` without extra bundling.
- DynamoDB table default removal policy is `DESTROY` for convenience in dev. Consider changing to `RETAIN` for prod.
- API Gateway permissions to invoke Lambdas are explicitly set.
