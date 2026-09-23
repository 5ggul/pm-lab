# DealOps isolated Cloudflare preview 0.6.1

This branch is isolated from main and existing services. Source is transferred as SHA-256-verified xz JSON in `.transfer/`; the workflow unpacks 19 UTF-8 files and checks their contracts before any temporary resource is created.

Cloudflare Workers + D1 only. AI and collectors are OFF. No automatic Daangn publishing. Native-node contract tests do not substitute for HTTPS runtime verification. A temporary preview requires owner claim before its returned expiration to persist. Claim link, API token and bootstrap secret are encrypted to the owner's session key and never committed as plaintext.

Initial source digest: ceb1b6f7a10e1fb12883824fbb1604245b6ebb99700747da22e3156bf8f21ebe

Migration source is under cloudflare/migrations, not migrations/0001_init.sql. Deployment changes include nodejs_compat, server-connected UI build, browser/bootstrap request compatibility, D1 atomic audit/CAS, persisted rate limits and bounded scrypt.
