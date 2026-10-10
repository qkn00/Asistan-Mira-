# Mira — Sistem Denetimi ve Yol Haritası (10 Ekim 2026)

Bu belge, Mira kod tabanının gerçek testlerle denetlenmesinin sonucudur.
"Çalışıyor" olarak işaretlenen her satır bu oturumda birebir koşturulup doğrulanmıştır.

## 1. Test Sonuçları

| Bileşen | Durum | Kanıt |
|---|---|---|
| TypeScript derlemesi | ✅ Çalışıyor (1 hata düzeltildi) | `tsc --noEmit` temiz |
| Production build | ✅ Çalışıyor | `next build` başarılı |
| Edge TTS (Türkçe ses) | ✅ Çalışıyor | Canlı sentez: 22 kelime, 12.5 sn MP3 |
| Edge TTS kelime zaman damgaları | ✅ Çalışıyor | `getWordBoundaries()` → 100ns tick, doğrulandı |
| TTS JSON modu (ses+altyazı+süre) | ✅ Çalışıyor (yeni eklendi) | `/api/tts` `format:"json"` yanıtı test edildi |
| MP4 render (`/api/video/render`) | ✅ Çalışıyor (3 kritik hata düzeltildi) | 13.4s ve 18.4s MP4 üretimi, kare kare doğrulama |
| Altyazı gömme (Türkçe karakter) | ✅ Çalışıyor | 6s/10s karelerinde senkronlu, kalın, altta altyazı göründü |
| ElevenLabs bağlantısı | ⚠️ Test edilemedi | `ELEVENLABS_API_KEY`/`VOICE_ID` bu ortamda yok |
| Civitai görsel üretimi | ⚠️ Test edilemedi | `CIVITAI_API_KEY` bu ortamda yok |
| YouTube trend araştırması | ⚠️ Test edilemedi | `YOUTUBE_API_KEY` bu ortamda yok |
| LLM sağlayıcıları (OpenRouter/Groq/Gemini/Ollama) | ⚠️ Test edilemedi | API anahtarları bu ortamda yok |
| Veritabanı akışları (kuyruk, taslak, onay) | ⚠️ Test edilemedi | `DATABASE_URL` bu ortamda yok |

## 2. Düzeltilen Hatalar

1. **`outfits/[id]` route tip hatasi** — `RouteContext` global tipi kullanılıyordu; `tsc` kırmızıydı ve Railway build'i bundan patlardı. Inline tip ile düzeltildi.
2. **`spawn /ROOT/node_modules/ffmpeg-static/ffmpeg ENOENT`** — Next.js bundler ffmpeg-static'in binary yolunu bozuyordu; video üretimi **hiç çalışamazdı** (Railway'de de). Çözüm: `next.config.ts` → `serverExternalPackages: ["ffmpeg-static", "@andresaya/edge-tts"]`.
3. **Sabit 20 saniye süre** — Ses 12.5s iken video 20s üretiyor, son 7.5s ölü sessizlikti. Artık `durationSeconds` parametresi, yoksa FFprobe mantığıyla (ffmpeg -i parse) gerçek ses süresinden ölçülüyor. Test: 1.8s/12.5s/18s talepler → 10.6s/13.4s/18.4s çıktı.
4. **Altyazı konumu** — libass `MarginV=180` PlayResY=288 birimindeydi; altyazı ekranın üst ortasında duruyordu. Stil düzeltildi (`FontSize=17, Bold=1, MarginV=34`) → altyazı artık altta ve kalın.
5. **Font bağımlılığı** — Railway imajında sistem fontu garantisi yok. DejaVu Sans (Regular+Bold) `public/fonts/` içine bundle edildi ve `fontsdir` ile refere edildi.
6. **TTS altyazıları yoktu** — Edge TTS kelime zamanları hiç kullanılmıyordu (altyazılar tahmini karakter oranına göre bölünüyordu → senkron kaçıyordu). Yeni `src/lib/narration.ts`: kelime boşluklarından (cümle sonu >300ms boşluk) gerçek senkron altyazı grupları üretiyor. Edge noktalama işaretlerini word-boundary'den temizlediği için cümle tespiti boşluk süresiyle yapılıyor — kalibre edildi.

## 3. Kalan Eksikler (öncelik sırasıyla)

| # | Eksik | Not |
|---|---|---|
| 1 | **Uçtan uca üretim motoru** | Taslak → narration → 3 görsel (Civitai) → render → asset'e kayıt tek akışta yok; parçalar var, birleştiren yok |
| 2 | **YouTube upload** | OAuth2 + `videos.insert` tamamen eksik. Kota: günde ~6 video (1600 birim/yükleme). **Dikkat:** audit'den geçmemiş Google projesinden yüklenen videolar private kilitlenir |
| 3 | **MP4 kalıcı depolama** | Railway diski ephemeral. MP4'ler Postgres'te (asset tablosu) veya S3/R2'de tutulmalı — onay arayüzü videoyu oradan göstermeli |
| 4 | **Onay → yayın zinciri** | Review sayfası videoyu oynatıp "Onayla" ile YouTube'a yüklemeli; şu an onay yalnızca durum değiştiriyor |
| 5 | **Zamanlayıcı** | Günlük araştırma+üretim için cron (Railway Cron veya cron-job.org'dan auth'lu GET) dokümante edilmeli |
| 6 | `.env.example` güncelliği | YOUTUBE_API_KEY, CIVITAI_API_KEY, ELEVENLABS_* eksikti — güncellendi |

## 4. Railway Notları

- `fontconfig` + DejaVu kaldırılmış imajlarda bile render çalışsın diye font bundle edildi.
- MP4/Railway ephemeral disk: üretilen videoyu içerik onayından önce kaybetmemek için kalıcı depolama şart.
- Cron: Railway "Cron Jobs" ile `/api/automation/research` (sabah) ve üretim worker'ı için zamanlanmış çağrılar planlanacak. Her cron çağrısı `x-mira-key: $MIRA_AUTOMATION_SECRET` header'ı ile gelmeli.

## 5. Test Scriptleri

Kökteki test scriptleri (bu oturumda kullanıldı):
- `scripts/test-tts.cjs` — canlı Edge TTS + kelime zamanları
- `scripts/test-render.cjs` — uçtan uca render (3 görsel + gerçek ses + altyazı)

Çalıştırmak için: önce `npm run dev`, sonra `node scripts/test-render.cjs`.
