# YouTube Upload Kurulumu — Adım Adım

Mira'nın onayladığın videoları kanalına yüklemesi için Google tarafında
tek seferlik ~15 dakikalık kurulum gerekir. Hiç API kullanmadıysan bile aynen takip et.

## 1. Google Cloud Projesi

1. [console.cloud.google.com](https://console.cloud.google.com) → üstte proje seçici → **New Project**
2. Ad: `Mira YouTube` → **Create**

## 2. YouTube Data API'yi Etkinleştir

1. Sol menü → **APIs & Services** → **Library**
2. `YouTube Data API v3` ara → **Enable**

## 3. OAuth Consent Screen

1. **APIs & Services** → **OAuth consent screen** → **External** → **Create**
2. App name: `Mira` (ad kullanıcıya gözükür) → User support email: kendi Gmail'in
3. Developer contact: kendi Gmail'in → **Save and Continue**
4. **Scopes** sayfası: **Add or Remove Scopes** → aşağıdakileri bul ve işaretle:
   - `.../auth/youtube.upload`
   - `.../auth/youtube.readonly`
5. **Test users** sayfası: **Add Users** → YouTube kanalının bağlı olduğu Gmail adresini ekle
   (bu çok önemli — test user eklenmezse bağlanma reddedilir)

## 4. OAuth Client Oluştur

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
2. Application type: **Web application**, Name: `Mira Web`
3. **Authorized redirect URIs** → ekle:
   ```
   https://aimira.up.railway.app/api/youtube/auth/callback
   ```
   (Railway'in belirsiz değilse `<senin-domain>/api/youtube/auth/callback` — 
   `NEXT_PUBLIC_MIRA_BASE_URL` ile aynı domain olmalı)
4. **Create** → çıkan **Client ID** ve **Client Secret** değerlerini kopyala

## 5. Railway'e Anahtarları Gir

Railway → Mira servisi → **Variables**:

```
YOUTUBE_CLIENT_ID=<kopyaladığın client id>
YOUTUBE_CLIENT_SECRET=<kopyaladığın client secret>
YOUTUBE_DEFAULT_PRIVACY=private
```

Deploy tetiklenir, 1-2 dk bekle.

## 6. Kanalı Bağla

1. Mira'ya site şifrenle giriş yap
2. Aynı tarayıcıdan aç: `https://aimira.up.railway.app/api/youtube/auth`
3. Google izin ekranı gelir → YouTube kanalının Gmail'ini seç → izinleri onayla
4. "YouTube bağlı! 🎉" sayfasını görmelisin
5. Doğrula: `https://aimira.up.railway.app/api/youtube/status?check=channel`
   → `"channelLive": {"channelTitle": "Senin Kanalın"}` dönmeli

## 7. Sınırlar ve Önemli Notlar

- **Günlük kota:** varsayılan 10.000 birim → `videos.insert` 1600 birim → **günde ~6 video**.
  3–4 video hedefin buna uyuyor; artırmak istersen Google Cloud'dan kota artışı talebi gerekir.
- **Private kilidi:** Google, doğrulanmamış (unaudited) uygulamalardan yüklenen videoları
  **private olarak kilitler**. Yani ilk aşamada Mira'nın yüklediği videolar kanalında gizli
  görünür; sen YouTube Studio'dan public yaparsın. Otomatik public için ileride Google'a
  **OAuth doğrulama (app verification)** başvurusu yapılır — anlık değil, haftalar sürebilir;
  onay/görünürlük iş akışı pratikte aynı kaldığı için engel değildir.
- **Test kullanıcısı:** Consent screen "Testing" modundayken yalnızca eklediğin Gmail'ler bağlanabilir.
  Bu modda refresh token süresiz çalışır (Production mod 7 günde süresinin dolduğu
  iddiası yalnızca consent screen'in kendisiyle ilgilidir; Testing'de de sorunsuzdur).

## 8. Kullanım

```
# Video hazır olduktan sonra (onay ekranındaki Yayınla butonu da bunu çağırır):
POST /api/youtube/upload
{"contentId": 123, "privacy": "private"}

# Durum:
GET /api/youtube/status
```

## Sorun Giderme

| Hata | Çözüm |
|---|---|
| `redirect_uri_mismatch` | Google client'a eklediğin URI, hata mesajındakiyle BİREBİR aynı olmalı (sonda `/` yok!) |
| `access_denied` | Test users'a kendi Gmail'ini ekle |
| `Google refresh token vermedi` | Consent'te tüm izinleri onayla; `prompt=consent` zaten gönderiyoruz |
| Video kanalda görünmüyor | Private — YouTube Studio → Content'te bul (filtre: Gizlilik=Özel) |
