import render_long_videos, os, subprocess

videos = [
    {
        'id': 1,
        'mp4_path': 'uzun_video_1.mp4',
        'wav_path': 'audio/long_master_1.wav',
        'vo_a': 'audio/long_vo_1_a.mp3',
        'vo_b': 'audio/long_vo_1_b.mp3',
        'images': ['images/long_img_1_1.png', 'images/long_img_1_2.png', 'images/long_img_1_3.png'],
        'main_title': "FİZİK KURALLARINI ÇÖPE ATAN 3 GEZEGEN",
        'chapters': [
            "BÖLÜM 1: VENÜS — ZAMANIN TERS AKTIĞI DÜNYA",
            "BÖLÜM 2: NEPTÜN — GÖKTEN SAF ELMAS YAĞAN GEZEGEN",
            "BÖLÜM 3: EUROPA — DÜNYA'DAN İKİ KAT FAZLA SU"
        ],
        'source_text': "Kaynaklar: NASA Planetary Data • Nature Astronomy (2017) • Galileo Mission",
        'text': "Evrenin tüm kurallarını bildiğimizi sanıyoruz. Gezegenler saat yönünün tersine döner, gökyüzünden su damlaları düşer ve bir gün her zaman bir yıldan daha kısadır. Peki ya size, fizik kurallarının tamamen çöpe atıldığı, gökten tonlarca ağırlıkta dev elmasların yağdığı ve zaman kavramının altüst olduğu dünyalar olduğunu söylesem? Bugün, evrenin en akılalmaz üç gezegenine doğru derin bir yolculuğa çıkıyoruz. İlk durağımız, Güneş sisteminin en huysuz gezegeni Venüs. Venüs, kuralları tanımaz; Güneş sistemindeki hemen hemen tüm gezegenlerin aksine saat yönünde ters döner. Üstelik kendi ekseni etrafında o kadar yavaş döner ki, bir tam turu iki yüz kırk üç Dünya günü sürer. Fakat Güneş etrafındaki bir yılını sadece iki yüz yirmi beş günde tamamlar. Yani Venüs'te bir gün, bir yıldan daha uzundur. Dört yüz yetmiş derecelik yüzey sıcaklığıyla Venüs, fizik yasalarının ilk büyük başkaldırısıdır. İkinci durağımız, buz devleri Neptün ve Uranüs. Bu gezegenlerin binlerce kilometre derinliğindeki atmosferinde aşırı basınç ve binlerce derecelik sıcaklık hüküm sürer. Bilim insanları laboratuvarda bu koşulları yeniden ürettiğinde şok edici bir gerçeği kanıtladı: Aşırı basınç, metandaki karbon ve hidrojen bağlarını parçalıyor. Serbest kalan karbon atomları saf elmas kristallerine dönüşüyor ve gezegenin çekirdeğine doğru adeta gökten dev elmaslar yağıyor. Son durağımız ise Jüpiter'in uydusu Europa. Ay'ımızdan bile küçük olan bu gök cismi dışarıdan buz çölü gibi görünür. Fakat kilometrelerce kalınlıktaki buz kabuğunun altında, yüz kilometre derinliğinde tuzlu dev bir okyanus gizlidir. Europa'daki bu tek yeraltı okyanusu, Dünya'daki bütün okyanusların toplam su miktarının tam iki katına sahiptir. Evren bizim küçük penceremizden çok daha gizemli. Daha fazla bilgi dozu için takip etmeyi unutmayın."
    },
    {
        'id': 2,
        'mp4_path': 'uzun_video_2.mp4',
        'wav_path': 'audio/long_master_2.wav',
        'vo_a': 'audio/long_vo_2_a.mp3',
        'vo_b': 'audio/long_vo_2_b.mp3',
        'images': ['images/long_img_2_1.png', 'images/long_img_2_2.png', 'images/long_img_2_3.png'],
        'main_title': "DOĞANIN İNSAN AKLINI AŞAN 3 GİZLİ DEHASI",
        'chapters': [
            "BÖLÜM 1: KARGALAR — NESİLLER BOYU SÜREN İNTİKAM",
            "BÖLÜM 2: BAL ARILARI — SIFIR VE MATEMATİK DEHALARI",
            "BÖLÜM 3: PANDO — DÜNYANIN EN YAŞLI CANLISI (80.000 YIL)"
        ],
        'source_text': "Kaynaklar: PNAS (2012) • Science (2018) • W. N. Am. Naturalist (2008)",
        'text': "Biz insanlar, kendimizi bu gezegenin en zeki ve en gelişmiş canlıları olarak görmeye bayılırız. Şehirler inşa ettik, matematiği bulduk ve doğayı kontrol altına aldığımızı sandık. Ancak modern biyoloji öyle kanıtlar ortaya koydu ki, kibrimiz yerle bir oldu. Bugün doğanın insan aklını çoktan geride bıraktığı üç inanılmaz gerçeğin dosyasını açıyoruz. İlk durağımız kargalar. Washington Üniversitesi'nde bilim insanları özel maskeler takarak kargaları yakaladı. Kargalar kendilerine zarar veren o maskeli yüzü tam beş yıl boyunca unutmadı. Dahası, o maskeyi gören kargalar tüm sürüye haber verdi ve doğan yeni yavrular bile o yüze saldırmaya başladı. Kargalar tehlikeli gördükleri yüzleri yeni nesillere kültürel bir miras gibi aktarıyor. Yani kargalar, kuşlar aleminin en organize istihbarat ağına sahip. İkinci durağımız minik dehalar: Bal arıları. İnsanlık sıfır sayısını ve hiçlik kavramını binlerce yıllık medeniyet birikimiyle keşfedebildi. Ancak susam tanesi büyüklüğünde beyne sahip bal arıları bu soyut kavramı doğuştan anlıyor. Deneylerde arılar, sıfırın birden daha küçük bir miktar olduğunu kavradı ve basit toplama çıkarma işlemlerini başarıyla çözdü. Primatlar dışında bu soyut zekaya sahip başka hiçbir canlı bilinmiyor. Son durağımız ise Utah'taki Pando ormanı. Dışarıdan kırk yedi bin farklı ağaç gibi görünen bu orman, yerin altında tek bir kök sistemine bağlı, genetik olarak tamamen özdeş tek bir dev canlıdır. Tam seksen bin yıldır hayattadır ve altı bin tonluk ağırlığıyla Dünya'nın en ağır organizmasıdır. Doğa sandığımızdan çok daha derin bir zekaya sahip. Daha fazla bilgi dozu için takip etmeyi unutmayın."
    },
    {
        'id': 3,
        'mp4_path': 'uzun_video_3.mp4',
        'wav_path': 'audio/long_master_3.wav',
        'vo_a': 'audio/long_vo_3_a.mp3',
        'vo_b': 'audio/long_vo_3_b.mp3',
        'images': ['images/long_img_3_1.png', 'images/long_img_3_2.png', 'images/long_img_3_3.png'],
        'main_title': "BEYNİNİN SENDEN SAKLADIĞI 3 YANILSAMA",
        'chapters': [
            "BÖLÜM 1: KAPI EŞİĞİ ETKİSİ — ODADA HAFIZA SIFIRLAMA",
            "BÖLÜM 2: GÖRÜNMEZ GORİL — SEÇİCİ KÖRLÜK",
            "BÖLÜM 3: ÖZGÜR İRADE İLLÜZYONU — 7 SANİYE ÖNCEKİ KARAR"
        ],
        'source_text': "Kaynaklar: Quart. J. Exp. Psychol. (2011) • Perception (1999) • Nature Neuro (2008)",
        'text': "Şu anda bu videoyu kendi özgür iradenizle izlediğinizi düşünüyorsunuz, değil mi? Gözlerinizin her şeyi tam gördüğünü, hafızanızın geçmişi kusursuz kaydettiğini ve zihninizin kontrolünün sizde olduğunu sanıyorsunuz. Ne yazık ki yanılıyorsunuz. Kafatasımızın içindeki o bir buçuk kiloluk et parçası, dünyayı sürekli sansürler ve gerçekliği yeniden yazar. İlk yanılsama: Kapı Eşiği Etkisi. Bir odaya hızla girip ne için geldiğinizi unuttuğunuz oldu mu? Notre Dame Üniversitesi araştırmasına göre beynimiz dünyayı bölümler halinde kaydeder. Bir kapıdan geçtiğinizde zihniniz eski ortamın dosyasını kapatır ve yeni ortama odaklanmak için hafızayı anlık olarak sıfırlar. Yani unuttuğunuz şey dalgınlık değil; beyninizin yeni bir hayatta kalma sahnesine geçiş yapmasıdır. İkinci yanılsama: Görünmez Goril Deneyi. Harvard Üniversitesi'nin ünlü deneyinde deneklere paslaşan insanların videosu izletildi ve pasları saymaları istendi. Sahneye goril kostümlü bir adam girip göğsünü yumrukladı ve dokuz saniye sonra çıktı. İzleyicilerin yarısından fazlası o koca gorili kesinlikle görmedi. Beynimiz aşırı odaklandığında devasa nesneleri bile filtreleyerek bilince ulaştırmaz. Son yanılsama ise Özgür İrade İllüzyonu. Yapılan modern beyin taramalarında, bir insan bir butona basmaya karar vermeden tam yedi saniye önce beynin motor korteksinde hazırlık başladığı kanıtlandı. Yani bilinçaltınız kararı çoktan veriyor, yedi saniye sonra bilincinize sahte bir sahiplenme hissi gönderiyor. Kendi zihniniz bile sizden sırlar saklıyor. Daha fazla bilgi dozu için takip etmeyi unutmayın."
    }
]

if __name__ == '__main__':
    for v in videos:
        print(f"\n>>> PRODUCING LONG 16:9 VIDEO {v['id']}: {v['main_title']} <<<")
        render_long_videos.render_16x9_video(v)
        if os.path.exists(v['wav_path']):
            os.remove(v['wav_path'])

    print("\nALL 3 LONG 16:9 VIDEOS RENDERED SUCCESSFULLY!")
