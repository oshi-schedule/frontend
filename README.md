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
BACKEND_API_BASE_URL=http://localhost:8000
OCR_API_BASE_URL=http://34.146.158.181:8000
```

VercelなどHTTPSで配信される環境からHTTP backendへ直接ブラウザfetchすると mixed content でブロックされます。
`NEXT_PUBLIC_API_BASE_URL` が `http://` かつ画面が `https://` の場合、ブラウザ側は自動的に同一オリジンの `/api/backend` を使い、Next.js API route が `BACKEND_API_BASE_URL` へサーバーサイド転送します。

`OCR_API_BASE_URL` は `/ocr-test` のOCR専用VMプロキシで使います。ブラウザから直接OCR VMを叩くのではなく、Next.js API routeからサーバーサイドで転送するため、CORSの影響を受けにくい構成です。

## Type generation

OpenAPI から型生成できるようにしています。

```bash
cd backend
python scripts/export_openapi.py
cd ../frontend
npm run types:openapi
```

現在は `src/types/api.ts` に手書き型を置いています。生成型へ差し替える場合は API client の戻り値型から移行してください。
