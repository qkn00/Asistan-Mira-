import render_engine, subprocess, os, json

videos = [
    {
        'id': 1,
        'title': "VENÜS'TE BİR GÜN BİR YILDAN UZUN",
        'title_lines': ["VENÜS'TE BİR GÜN", "BİR YILDAN DAHA", "UZUN!"],
        'source_text': "Kaynak: NASA Planetary Science (1962)",
        'vo_path': 'audio/vo_1.mp3',
        'wav_path': 'audio/master_1.wav',
        'mp4_path': 'video_1.mp4',
        'img1_path': 'images/bg_1_1.png',
        'img2_path': 'images/bg_1_2.png',
        'text': "Kendi doğum gününüzün, bir tam günden daha kısa sürdüğünü hayal edebiliyor musunuz? Venüs'te tam olarak bu yaşanıyor. Venüs kendi ekseni etrafında o kadar yavaş döner ki, bir tam turu iki yüz kırk üç Dünya günü sürer. Fakat Güneş'in etrafındaki bir yılını sadece iki yüz yirmi beş günde tamamlar. Yani Venüs'te bir gün, bir yıldan daha uzundur. Üstelik gezegen Güneş sistemindeki hemen hemen her gezegenin aksine, ters yönde döner. Zaman algınızı tamamen altüst eden bu evrende, bildiğimiz hiçbir kural geçerli değil. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['doğum', 'Venüs\'te', 'iki', 'Güneş\'in', 'uzundur', 'ters', 'altüst', 'takip']
    },
    {
        'id': 2,
        'title': "KARGALAR YÜZÜNÜ ASLA UNUTMAZ",
        'title_lines': ["KARGALAR YÜZÜNÜ", "ASLA UNUTMAZ VE", "KİN TUTAR!"],
        'source_text': "Kaynak: PNAS / Marzluff et al. (2012)",
        'vo_path': 'audio/vo_2.mp3',
        'wav_path': 'audio/master_2.wav',
        'mp4_path': 'video_2.mp4',
        'img1_path': 'images/bg_2_1.png',
        'img2_path': 'images/bg_2_2.png',
        'text': "Bir kargaya haksızlık yaptıysanız, hayatınızın en büyük hatasını yapmış olabilirsiniz. Washington Üniversitesi'nde bilim insanları korkunç bir deney yaptı ve özel bir maske takarak kargaları yakaladı. Kargalar o yüzü tam beş yıl boyunca unutmadı. Dahası, o maskeyi gören kargalar durumu sürüdeki diğer kuşlara anlattı ve doğan yavrular bile o yüze saldırmaya başladı. Yani kargalar sadece yüzleri hatırlamakla kalmıyor, nesiller boyu süren bir kin besleyip bunu çocuklarına öğretiyor. Şehirdeki gölgelere dikkat edin. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['haksızlık', 'Washington', 'korkunç', 'beş', 'sürüdeki', 'yavrular', 'kin', 'gölgelere', 'takip']
    },
    {
        'id': 3,
        'title': "YEDİĞİN MUZ ASLINDA RADYOAKTİF",
        'title_lines': ["YEDİĞİN MUZ", "ASLINDA NÜKLEER", "RADYOAKTİF!"],
        'source_text': "Kaynak: Physics World / BED Metric (1995)",
        'vo_path': 'audio/vo_3.mp3',
        'wav_path': 'audio/master_3.wav',
        'mp4_path': 'video_3.mp4',
        'img1_path': 'images/bg_3_1.png',
        'img2_path': 'images/bg_3_2.png',
        'text': "Her sabah yediğiniz masum bir meyvenin, aslında nükleer bir ışıma kaynağı olduğunu biliyor muydunuz? Muzlar, doğadaki en zengin potasyum kaynaklarından biridir. Ancak bu potasyumun küçük bir kısmı, doğal olarak radyoaktif olan Potasyum kırk izotopudur. Bu yüzden her muz, saniyede yaklaşık on beş kez pozitron yani antimadde parçacığı yayar. Nükleer fizikte buna 'Muz Eşdeğer Dozu' denir ve radyasyon ölçümlerinde resmi bir birim olarak kullanılır. Merak etmeyin, size zarar vermez ama vücudunuz şu an parlıyor olabilir. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['nükleer', 'ışıma', 'potasyum', 'Potasyum', 'pozitron', 'antimadde', 'Muz', 'parlıyor', 'takip']
    },
    {
        'id': 4,
        'title': "AĞAÇLAR BİRBİRİYLE KONUŞUYOR",
        'title_lines': ["ORMANIN ALTINDA", "GİZLİ İNTERNET:", "WOOD WIDE WEB!"],
        'source_text': "Kaynak: Nature / Simard et al. (1997)",
        'vo_path': 'audio/vo_4.mp3',
        'wav_path': 'audio/master_4.wav',
        'mp4_path': 'video_4.mp4',
        'img1_path': 'images/bg_4_1.png',
        'img2_path': 'images/bg_4_2.png',
        'text': "Ormanda yürürken sessizliğe aldanmayın; ayaklarınızın altında devasa bir internet ağı çalışıyor. Ağaçlar köklerindeki mikorizal mantar ağlarını kullanarak birbirleriyle doğrudan iletişim kurar. Bilim insanları buna 'Wood Wide Web' adını verdi. Bir ağaç böcek saldırısına uğradığında, bu mantar kabloları üzerinden komşularına kimyasal sinyaller göndererek savunmalarını hazırlamalarını sağlar. Hatta yaşlı ana ağaçlar, ölmeden önce depoladıkları besinleri bu ağla genç fidelere aktarır. Orman tek tek ağaçlar değil, tek bir dev organizmadır. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['sessizliğe', 'internet', 'mantar', 'Wood', 'böcek', 'kimyasal', 'ana', 'tek', 'takip']
    },
    {
        'id': 5,
        'title': "SEN BİR YILDIZ TOZUSUN",
        'title_lines': ["VÜCUDUNDAKİ ATOM:", "PATLAYAN DEV BİR", "SÜPERNOVA!"],
        'source_text': "Kaynak: Nature Astronomy / Sagan Thesis (2017)",
        'vo_path': 'audio/vo_5.mp3',
        'wav_path': 'audio/master_5.wav',
        'mp4_path': 'video_5.mp4',
        'img1_path': 'images/bg_5_1.png',
        'img2_path': 'images/bg_5_2.png',
        'text': "Aynaya baktığınızda sadece bir insan görmüyorsunuz; milyarlarca yıl önce patlamış yıldızların kalıntılarına bakıyorsunuz. Evrenin başlangıcında sadece hidrojen ve helyum vardı. Kanınızdaki demir, kemiklerinizdeki kalsiyum ve soluduğunuz oksijen Dünya'da oluşmadı. Bu ağır elementlerin tamamı, ömrünü tamamlayıp süpernova olarak patlayan dev yıldızların çekirdeklerinde dövüldü ve uzaya saçıldı. Yani vücudunuzdaki sol elinizle sağ elinizdeki atomlar, muhtemelen iki farklı yıldızdan geldi. Sen evrenin ta kendisisin. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['insan', 'yıldızların', 'demir', 'kalsiyum', 'oksijen', 'süpernova', 'çekirdeklerinde', 'iki', 'kendisisin', 'takip']
    }
]

# Render all 5 videos
for v in videos:
    print(f"\n================ STARTING VIDEO {v['id']}: {v['title']} ================")
    render_engine.render_short_video(v)

