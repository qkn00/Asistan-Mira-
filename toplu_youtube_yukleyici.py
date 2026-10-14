# ==============================================================================
# BİLGİ DOZU — YouTube Shorts Otomatik Toplu Yükleme ve Zamanlama Şablonu
# ==============================================================================
# Bu betik, 'bilgi_dozu_data.json' dosyasındaki 15 videonun başlık, açıklama ve
# etiketlerini okur. google-api-python-client kullanarak otomatik yükleme yapar.
#
# Kurulum (kendi bilgisayarınızda):
#   pip install google-api-python-client google-auth-oauthlib
# ==============================================================================

import json
import os
import time

DATA_FILE = "bilgi_dozu_data.json"

def main():
    if not os.path.exists(DATA_FILE):
        print(f"Hata: {DATA_FILE} bulunamadı!")
        return

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        shorts_list = json.load(f)

    print(f"Toplam {len(shorts_list)} adet Shorts videosu yüklenecek.\n")

    for item in shorts_list:
        v_id = item['id']
        file_path = item['file']
        title = item['title']
        description = item['description']
        tags = item['tags']

        print("--------------------------------------------------")
        print(f"[{v_id}/15] Dosya: {file_path}")
        print(f"Başlık: {title}")
        print(f"Etiketler: {', '.join(tags)}")
        print(f"Kaynak: {item['source']}")

        if os.path.exists(file_path):
            file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
            print(f"Durum: Dosya mevcut ({file_size_mb:.2f} MB) - Yüklemeye hazır.")
        else:
            print(f"Uyarı: {file_path} yerel dizinde bulunamadı!")

        # Not: Google YouTube Data API v3 kodlarınızı buraya entegre edebilirsiniz:
        # youtube.videos().insert(part="snippet,status", body={...}, media_body=file_path).execute()

    print("\nTüm meta veriler başarıyla kontrol edildi! 🚀")

if __name__ == "__main__":
    main()
