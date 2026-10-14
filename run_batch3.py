import render_engine, subprocess, os, json, time
import soundfile as sf, numpy as np

videos_batch3 = [
    {
        'id': 11,
        'title': "ELMAS YAĞAN GEZEGENLER: NEPTÜN VE URANÜS",
        'title_lines': ["GÖKTEN DEV SAF", "ELMASLAR YAĞIYOR:", "NEPTÜN VE URANÜS!"],
        'source_text': "Kaynak: Nature Astronomy / Kraus et al. (2017)",
        'vo_path': 'audio/vo_11.mp3',
        'wav_path': 'audio/master_11.wav',
        'mp4_path': 'video_11.mp4',
        'img1_path': 'images/bg_11_1.png',
        'img2_path': 'images/bg_11_2.png',
        'text': "Gökten su damlaları yerine dev elmasların yağdığı bir dünya hayal edebiliyor musunuz? Bu bir bilim kurgu değil; Neptün ve Uranüs'te tam olarak bu yaşanıyor. Gezegenlerin derin atmosferinde basınç ve sıcaklık o kadar akılalmaz boyutlara ulaşır ki, metan gazındaki karbon ve hidrojen bağları parçalanır. Serbest kalan karbon atomları sıkışarak saf elmas kristallerine dönüşür ve gezegenin çekirdeğine doğru gökten adeta elmas dolusu yağar. Evrenin zenginliği hayal gücümüzün çok ötesinde. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['elmasların', 'Neptün', 'Uranüs\'te', 'basınç', 'sıcaklık', 'karbon', 'saf', 'kristallerine', 'zenginliği', 'takip']
    },
    {
        'id': 12,
        'title': "TARDİGRADLAR UZAY BOŞLUĞUNDA YAŞAYABİLİYOR",
        'title_lines': ["ÖLÜMÜ YENEN CANLI:", "UZAYDA BİLE YAŞAYAN", "TARDİGRADLAR!"],
        'source_text': "Kaynak: Current Biology / Jönsson et al. (2008)",
        'vo_path': 'audio/vo_12.mp3',
        'wav_path': 'audio/master_12.wav',
        'mp4_path': 'video_12.mp4',
        'img1_path': 'images/bg_12_1.png',
        'img2_path': 'images/bg_12_2.png',
        'text': "Bu gezegende öyle bir canlı yaşıyor ki, nükleer bir savaş çıksa bile kılını kıpırdatmaz. Mikroskobik su ayıları yani tardigradlar, eksi iki yüz yetmiş iki dereceden artı yüz elli dereceye kadar hayatta kalabilir. Hatta uzayın dondurucu vakumuna ve ölümcül kozmik radyasyonuna maruz bırakıldıklarında bile ölmediler. Vücutlarındaki tüm suyu atıp metabolizmalarını sıfıra indirerek bir nevi ölüm uykusuna yatıyorlar ve su bulduklarında yeniden canlanıyorlar. Belki de uzaylılar çoktan aramızdadır. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['nükleer', 'tardigradlar', 'eksi', 'dereceye', 'uzayın', 'ölümcül', 'ölmediler', 'uykusuna', 'canlanıyorlar', 'uzaylılar', 'takip']
    },
    {
        'id': 13,
        'title': "GÖZ BEBEKLERİN BİRİNE ODAKLANINCA BÜYÜR",
        'title_lines': ["BİRİNE ODAKLANINCA", "GÖZ BEBEKLERİN", "BÜYÜR!"],
        'source_text': "Kaynak: Science / Hess & Polt (1960)",
        'vo_path': 'audio/vo_13.mp3',
        'wav_path': 'audio/master_13.wav',
        'mp4_path': 'video_13.mp4',
        'img1_path': 'images/bg_13_1.png',
        'img2_path': 'images/bg_13_2.png',
        'text': "Birisinin sizden gerçekten hoşlanıp hoşlanmadığını veya ne düşündüğünü anlamanın en kesin yolu nedir biliyor musunuz? Göz bebeklerine bakın. Beynimiz aşırı ilgi duyduğu, heyecanlandığı veya çok odaklandığı bir şeyle karşılaştığında otonom sinir sistemi anında devreye girer. Bu durum göz bebeklerinizin istemsizce normal boyutunun yüzde kırk beşine kadar büyümesine neden olur. İnsanlar sözleriyle yalan söyleyebilir ama göz bebekleri beyninizin en dürüst sırdaşıdır. Bir dahaki sefere dikkatli bakın. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['hoşlanıp', 'Göz', 'bebeklerine', 'otonom', 'istemsizce', 'yüzde', 'büyümesine', 'yalan', 'dürüst', 'sırdaşıdır', 'takip']
    },
    {
        'id': 14,
        'title': "DÜNYANIN EN YAŞLI CANLISI 80000 YAŞINDAKİ ORMAN",
        'title_lines': ["DÜNYANIN EN YAŞLI", "CANLISI: 80.000 YAŞINDA", "TEK BİR ORMAN!"],
        'source_text': "Kaynak: W. N. Am. Naturalist / DeWoody et al. (2008)",
        'vo_path': 'audio/vo_14.mp3',
        'wav_path': 'audio/master_14.wav',
        'mp4_path': 'video_14.mp4',
        'img1_path': 'images/bg_14_1.png',
        'img2_path': 'images/bg_14_2.png',
        'text': "Dünyanın yaşayan en yaşlı canlısı sandığınız gibi bir kaplumbağa ya da tek bir ağaç değil; devasa bir ormandır. Utah'ta bulunan Pando ormanı, dışarıdan bakıldığında kırk yedi bin farklı ağaçtan oluşuyor gibi görünür. Fakat yerin altında hepsi birbirine bağlı tek bir kök sistemine sahiptir. Yani genetik olarak tamamen özdeş, tek bir dev organizmadır. Tam seksen bin yıldır hayattadır ve altı bin tonluk ağırlığıyla gezegenin en ağır canlısıdır. Doğa sandığımızdan çok daha derin bağlara sahip. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['yaşlı', 'Pando', 'kırk', 'kök', 'özdeş', 'seksen', 'altı', 'ağır', 'canlısıdır', 'bağlara', 'takip']
    },
    {
        'id': 15,
        'title': "YILDIRIMLAR AŞAĞIDAN YUKARIYA ÇAKAR",
        'title_lines': ["BEYNİNİN YANILSAMASI:", "YILDIRIMLAR AŞAĞIDAN", "YUKARI ÇAKAR!"],
        'source_text': "Kaynak: Scientific American / Lightning Physics (2014)",
        'vo_path': 'audio/vo_15.mp3',
        'wav_path': 'audio/master_15.wav',
        'mp4_path': 'video_15.mp4',
        'img1_path': 'images/bg_15_1.png',
        'img2_path': 'images/bg_15_2.png',
        'text': "Şimdiye kadar gördüğünüz her yıldırım görüntüsü aslında beyninizin size oynadığı bir yanılsamadır. Gözlerimiz yıldırımı gökten yere düşen bir ok gibi algılar. Ancak fiziksel gerçek tam tersidir. Buluttan aşağıya doğru inen görünmez elektrik kanalı yere ulaştığı anda, asıl devasa ışık patlaması yerden gökyüzüne doğru fırlar. Saniyede yüz bin kilometre hızla yukarı doğru tırmanan bu akım, göz açıp kapayıncaya kadar gerçekleştiği için bize aşağı iniyormuş gibi gelir. Algılarımıza her zaman güvenemeyiz. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['yıldırım', 'yanılsamadır', 'tersidir', 'görünmez', 'ışık', 'patlaması', 'fırlar', 'yüz', 'akım', 'güvenemeyiz', 'takip']
    }
]

def calibrate_and_remux(mp4_path, v_id):
    temp_wav = f"audio/temp_remux_{v_id}.wav"
    subprocess.run(['ffmpeg', '-y', '-i', mp4_path, '-vn', '-acodec', 'pcm_s16le', temp_wav], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    data, sr = sf.read(temp_wav)
    dur = len(data) / sr
    t = np.linspace(0, dur, len(data))
    gain = np.ones(len(data)) * 1.25
    gain[t < 4.5] *= 1.15
    gain[(t >= 4.5) & (t < dur - 5.5)] *= 0.90
    gain[t >= dur - 5.5] *= 1.20
    data_adj = data * gain[:, None]
    peak = np.max(np.abs(data_adj))
    if peak > 0.96:
        data_adj = data_adj / peak * 0.95
    wav_int16 = (data_adj * 32767).astype(np.int16)
    cal_wav = f"audio/calibrated_{v_id}.wav"
    sf.write(cal_wav, wav_int16, sr, subtype='PCM_16')
    
    temp_mp4 = f"temp_{mp4_path}"
    subprocess.run([
        'ffmpeg', '-y', '-i', mp4_path, '-i', cal_wav,
        '-c:v', 'copy', '-map', '0:v:0', '-map', '1:a:0',
        '-c:a', 'aac', '-b:a', '192k', '-shortest', temp_mp4
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    os.replace(temp_mp4, mp4_path)
    if os.path.exists(temp_wav): os.remove(temp_wav)
    if os.path.exists(cal_wav): os.remove(cal_wav)

if __name__ == '__main__':
    for v in videos_batch3:
        print(f"\n================ STARTING VIDEO {v['id']}: {v['title']} ================")
        render_engine.render_short_video(v)
        calibrate_and_remux(v['mp4_path'], v['id'])
        if os.path.exists(v['wav_path']): os.remove(v['wav_path'])
        print(f"Video {v['id']} finished successfully!")

    print("\nALL 5 VIDEOS OF SERİ 3 COMPLETED!")
