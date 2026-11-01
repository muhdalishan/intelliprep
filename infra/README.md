# Infrastructure

For the FYP, hosting is managed through the providers' dashboards (see
[architecture decision 007](../docs/architecture/decisions.md)): Render/Railway for the API,
Cloudflare Pages/Vercel for the frontend, Supabase, Upstash Redis.

`terraform/` is reserved for the AWS production setup (ECS Fargate, RDS/Aurora, SQS, S3, KMS).
Nothing goes here until that move is planned in the backlog.
