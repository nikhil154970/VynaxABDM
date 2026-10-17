# Backend (VyanX Hospital Management System)

## Setup

1. Create `.env` from `.env.example` and set `DATABASE_URL` and `JWT_SECRET`.
2. Install dependencies:

```bash
npm install
```

3. Run Prisma migration + generate client:

```bash
npm run prisma:migrate
```

4. Start the API (on first successful DB connection, SUPER_ADMIN from `.env` is created/updated automatically):

```bash
npm run dev
```

Optional manual seed (same as startup):

```bash
npm run seed
```

## Key endpoints

- `POST /api/auth/login`
- `GET /api/users` (SUPER_ADMIN)
- `POST /api/users` (SUPER_ADMIN)
- `DELETE /api/users/:id` (SUPER_ADMIN)

