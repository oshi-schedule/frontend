# 推しスケ Frontend

Phase2 のイベント登録体験を検証するための Next.js App Router アプリです。

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Type generation

OpenAPI から型生成できるようにしています。

```bash
cd backend
python scripts/export_openapi.py
cd ../frontend
npm run types:openapi
```

現在は `src/types/api.ts` に手書き型を置いています。生成型へ差し替える場合は API client の戻り値型から移行してください。
