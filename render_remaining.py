import render_engine, subprocess, os, json, time
import soundfile as sf, numpy as np

remaining = [
    {
        'id': 8,
        'title': "DÜNYADAKİ TÜM KARINCALAR İNSANLARDAN DAHA AĞIR",
        'title_lines': ["DÜNYADAKİ TÜM", "KARINCALAR İNSANLARDAN", "DAHA AĞIR!"],
        'source_text': "Kaynak: PNAS / Schultheiss et al. (2022)",
        'vo_path': 'audio/vo_8.mp3',
        'wav_path': 'audio/master_8.wav',
        'mp4_path': 'video_8.mp4',
        'img1_path': 'images/bg_8_1.png',
        'img2_path': 'images/bg_8_2.png',
        'text': "Ayağınızın altında dolaşan minik canlıların, tüm insanlığı tartıda yenebileceğini hiç düşündünüz mü? Bilim insanlarının yaptığı son küresel araştırmaya göre, Dünya üzerinde tam yirmi katrilyon karınca yaşıyor. Bu, gezegendeki her bir insana yaklaşık iki buçuk milyon karınca düştüğü anlamına gelir. Bütün bu karıncaların toplam kuru biyokütle ağırlığı, Dünya üzerindeki tüm insanların ve yabani memelilerin toplam ağırlığından daha fazladır. Biz bu gezegenin hakimi olduğumuzu sanırken, asıl imparatorluk yerin altında kurulmuş. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['tartıda', 'yirmi', 'katrilyon', 'karınca', 'milyon', 'biyokütle', 'insanların', 'fazladır', 'imparatorluk', 'takip']
    },
    {
        'id': 9,
        'title': "JÜPİTER'İN UYDUSU EUROPA'DA DÜNYA'DAN ÇOK SU VAR",
        'title_lines': ["BU UYDUDAN İKİ KAT", "DAHA FAZLA OKYANUS", "ÇIKTI: EUROPA!"],
        'source_text': "Kaynak: NASA JPL / Galileo Mission (2000)",
        'vo_path': 'audio/vo_9.mp3',
        'wav_path': 'audio/master_9.wav',
        'mp4_path': 'video_9.mp4',
        'img1_path': 'images/bg_9_1.png',
        'img2_path': 'images/bg_9_2.png',
        'text': "Güneş sistemindeki en çok su nerede diye sorsam, muhtemelen Dünya dersiniz. Ancak bu cevap yanlış. Jüpiter'in buzla kaplı uydusu Europa, bizim Ay'ımızdan bile daha küçüktür. Fakat kilometrelerce kalınlıktaki o buz kabuğunun altında, yüz kilometre derinliğinde tuzlu bir okyanus gizlidir. Europa'daki bu tek yeraltı okyanusu, Dünya'daki bütün okyanusların, denizlerin ve göllerin toplam su miktarının tam iki katına sahiptir. Üstelik hidrotermal bacalar sayesinde burada uzaylı mikrobiyal yaşam olma ihtimali çok yüksektir. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['Dünya', 'yanlış', 'Jüpiter\'in', 'Europa', 'buz', 'yüz', 'okyanus', 'iki', 'hidrotermal', 'yaşam', 'takip']
    },
    {
        'id': 10,
        'title': "2000 YILLIK ROMA BETONU KENDİ KENDİNİ ONARIYORDU",
        'title_lines': ["2000 YILLIK ROMA", "BETONU KENDİ KENDİNİ", "YAMIYORDU!"],
        'source_text': "Kaynak: Science Advances / Seymour et al. (2023)",
        'vo_path': 'audio/vo_10.mp3',
        'wav_path': 'audio/master_10.wav',
        'mp4_path': 'video_10.mp4',
        'img1_path': 'images/bg_10_1.png',
        'img2_path': 'images/bg_10_2.png',
        'text': "İki bin yıllık Roma panteonu ve limanları dimdik ayaktayken, modern betonların neden elli yılda çatladığını hiç merak ettiniz mi? MIT bilim insanları antik Roma betonunun gizemini sonunda çözdü. Romalılar harcı kararken 'sıcak kireç' kırıntıları bırakıyordu. Beton zamanla çatlayıp içeriye yağmur suyu sızdığında, bu su kireç kırıntılarıyla anında tepkimeye giriyordu. Çözünen kalsiyum, çatlakların içinde yeniden kristalleşerek binanın yarasını kendi kendine kapatıyordu. Yani Roma betonu canlı bir organizma gibi kendini iyileştiriyordu. Daha fazla bilgi dozu için takip etmeyi unutma!",
        'emphasis_words': ['panteonu', 'elli', 'Roma', 'sıcak', 'kireç', 'su', 'kalsiyum', 'kristalleşerek', 'kapatıyordu', 'iyileştiriyordu', 'takip']
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

for v in remaining:
    print(f"\n================ STARTING VIDEO {v['id']}: {v['title']} ================")
    render_engine.render_short_video(v)
    calibrate_and_remux(v['mp4_path'], v['id'])
    if os.path.exists(v['wav_path']): os.remove(v['wav_path'])
    print(f"Video {v['id']} fully finished and calibrated!")

print("\nALL 5 VIDEOS OF BATCH 2 COMPLETED!")
