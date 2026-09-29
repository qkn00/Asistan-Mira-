# Mira — Phase 3 + Phase 4

## Phase 3 — arka plan ve otomasyon omurgası
- `operations`: yapılan işlerin gerçek günlüğü
- `tasks`: görev/reminder altyapısı
- `content_items`: YouTube/TikTok içerik ve performans kaydı
- `trends`: trend kayıtları
- `/api/n8n/webhook`: n8n'den güvenli kayıt alma endpoint'i
- `/api/automation/orchestrate`: n8n için tek birleşik otomasyon kuyruğu
- `n8n/mira-background-operations.json`: saatlik/15 dakikalık arka plan kontrolü
- `n8n/mira-automation-orchestrator.json`: birleşik otomasyon döngüsü

## Phase 4 — kalıcı hafıza ve günlük rapor
- `Bunu hatırla: ...` komutu kalıcı hafızaya kayıt açar.
- Normal AI sohbetlerinde en önemli 20 hafıza kaydı bağlama eklenir.
- `Bugün neler yaptık?` gerçek DB kayıtlarından rapor üretir.
- Rapor; işlemleri, başarısızlıkları, görevleri, gerçek yayın kayıtlarını, kayıtlı metrikleri ve günün trendlerini ayırır.
- Günlük sınırlar `Europe/Istanbul` saat dilimine göre hesaplanır.
- Günlük rapor endpoint'i n8n anahtarıyla korunur.

## Otomasyonların bağlanması
1. PostgreSQL `DATABASE_URL` ayarla.
2. `drizzle/0001_mira_phase3_phase4.sql` çalıştır.
3. `MIRA_N8N_SECRET` üret ve n8n ile aynı değeri kullan.
4. `n8n/mira-automation-orchestrator.json` import et ve aktif et.
5. n8n'de `MIRA_BASE_URL` ve `MIRA_N8N_SECRET` tanımla.
6. YouTube/TikTok OAuth ve yayınlama workflow'larını ayrıca bağla.
7. Gerçek yayın sonucu geldiğinde `/api/content/publish-result` ile kaydet.

## Test notu
Bu çalışma ortamında npm registry erişimi zaman aşımına uğradığı için tam `next build` doğrulanamadı. JSON workflow'ları parse edilerek doğrulandı ve kaynaklarda şüpheli placeholder/syntax izi tarandı. Gerçek deployment üzerinde `npm install`, `npm run typecheck` ve `npm run build` çalıştırılmalıdır.
