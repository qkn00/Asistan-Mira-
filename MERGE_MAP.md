# Mira merge map — Phase 2 → Phase 3 → Phase 4

Bu paket ana Mira Next.js projesine doğrudan uygulanmak üzere hazırlanmıştır.

## Korunan çekirdek
- `src/components/Assistant.tsx` — mevcut avatar/chat/voice UI
- `src/components/useSpeaker.ts` — konuşma/TTS ve ses animasyonu
- `src/lib/avatar.ts` — avatar durumları ve kıyafetler
- `src/lib/settings.ts` — kullanıcı ayarları
- `src/db/*` — Drizzle/PostgreSQL bağlantısı ve şema

## Phase 3
- `src/app/api/operations/*` — gerçek işlem günlüğü
- `src/app/api/tasks/*` — görev/reminder CRUD
- `src/app/api/content/*` — YouTube/TikTok içerik kayıtları
- `src/app/api/trends/*` — trend kayıtları
- `src/app/api/n8n/webhook/*` — n8n güvenli giriş noktası
- `n8n/mira-background-template.json` — saatlik arka plan şablonu

## Phase 4
- `src/lib/memory.ts` — kalıcı hafıza yardımcıları
- `src/app/api/memory/*` — hafıza CRUD
- `src/lib/report.ts` — Europe/Istanbul günlük raporu
- `src/app/api/report/daily/*` — yetkili günlük rapor endpoint'i
- `src/app/api/chat/route.ts` — “Bunu hatırla:” ve “Bugün neler yaptık?” komutları

## Kurulum sırası
1. PostgreSQL bağla.
2. `drizzle/0001_mira_phase3_phase4.sql` çalıştır.
3. `.env.example` değerlerini gerçek ortam değişkenleriyle doldur.
4. n8n'e `n8n/mira-background-template.json` import et.
5. n8n'de `MIRA_BASE_URL` ve `MIRA_N8N_SECRET` tanımla.
6. YouTube/TikTok OAuth ve yayınlama workflow'larını ayrıca bağla.
