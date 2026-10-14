import os, sys, math, time, subprocess, json
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont

FONT_ARCHIVO = '/home/user/fonts/ArchivoBlack-Regular.ttf'
FONT_INTER = '/home/user/fonts/Inter-VariableFont.ttf'

def process_long_audio(vo_a_path, vo_b_path, out_wav_path, cta_duration=5.0):
    # Load and concatenate A and B
    da, sr = sf.read(vo_a_path)
    db, _ = sf.read(vo_b_path)
    if len(da.shape) > 1: da = da[:, 0]
    if len(db.shape) > 1: db = db[:, 0]
    raw_data = np.concatenate([da, db])

    # Pause tightening x0.72
    hop = int(sr * 0.01)
    win = int(sr * 0.025)
    n_frames = (len(raw_data) - win) // hop + 1
    rms = np.array([np.sqrt(np.mean(raw_data[i*hop : i*hop + win]**2) + 1e-12) for i in range(n_frames)])
    db_energy = 20 * np.log10(rms + 1e-9)
    thresh = -30.0
    is_pause = db_energy < thresh

    regions = []
    curr = is_pause[0]
    start = 0
    for i in range(1, len(is_pause)):
        if is_pause[i] != curr:
            regions.append((curr, start, i))
            curr = is_pause[i]
            start = i
    regions.append((curr, start, len(is_pause)))

    smoothed = []
    for is_p, s, e in regions:
        dur = e - s
        if is_p and dur < 8:
            smoothed.append((False, s, e))
        elif (not is_p) and dur < 6:
            smoothed.append((True, s, e))
        else:
            smoothed.append((is_p, s, e))

    merged = []
    for is_p, s, e in smoothed:
        if merged and merged[-1][0] == is_p:
            merged[-1] = (is_p, merged[-1][1], e)
        else:
            merged.append((is_p, s, e))

    tightened_chunks = []
    for is_p, s, e in merged:
        chunk = raw_data[s * hop : min(len(raw_data), e * hop)]
        if is_p:
            new_len = max(int(len(chunk) * 0.72), int(sr * 0.05))
            if len(chunk) > 0:
                idx = np.linspace(0, len(chunk) - 1, new_len).astype(int)
                chunk = chunk[idx]
        tightened_chunks.append(chunk)

    vo = np.concatenate(tightened_chunks)
    total_dur = len(vo) / sr
    t = np.linspace(0, total_dur, len(vo))

    # Beat: 55Hz drone + rhythmic pulse at 65 BPM + CTA riser
    drone_55 = np.sin(2 * np.pi * 55 * t)
    drone_110 = 0.25 * np.sin(2 * np.pi * 110 * t)
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.2 * t)
    drone = (drone_55 + drone_110) * lfo * 0.06

    pulse_period = 0.923
    pulse = np.zeros_like(t)
    pulse_decay = np.exp(-np.linspace(0, 14, int(sr * 0.22)))
    pulse_kernel = np.sin(2 * np.pi * 60 * np.linspace(0, 0.22, len(pulse_decay))) * pulse_decay
    for p_time in np.arange(0.2, total_dur - cta_duration, pulse_period):
        p_idx = int(p_time * sr)
        if p_idx + len(pulse_kernel) < len(pulse):
            pulse[p_idx : p_idx + len(pulse_kernel)] += pulse_kernel * 0.09

    riser = np.zeros_like(t)
    cta_start_t = max(0, total_dur - cta_duration)
    cta_mask = t >= cta_start_t
    if np.any(cta_mask):
        t_cta = t[cta_mask] - cta_start_t
        norm_t = t_cta / cta_duration
        freq = 90 * (6.5 ** norm_t)
        phase = 2 * np.pi * np.cumsum(freq) / sr
        sweep = np.sin(phase) * (norm_t ** 1.8) * 0.18
        noise = (np.random.rand(len(t_cta)) * 2 - 1) * (norm_t ** 2) * 0.06
        riser[cta_mask] = sweep + noise

    beat = drone + pulse + riser

    # Sidechain ducking
    vo_abs = np.abs(vo)
    env_win = int(sr * 0.05)
    vo_env = np.convolve(vo_abs, np.ones(env_win)/env_win, mode='same')
    duck_gain = 0.65 - 0.45 * np.clip(vo_env / 0.12, 0, 1)
    ducked_beat = beat * duck_gain

    mixed = vo * 0.94 + ducked_beat

    # Dynamic gain for LRA > 2
    gain = np.ones(len(mixed)) * 1.25
    gain[t < 4.5] *= 1.15
    gain[(t >= 4.5) & (t < total_dur - 5.5)] *= 0.90
    gain[t >= total_dur - 5.5] *= 1.20
    mixed = mixed * gain

    peak = np.max(np.abs(mixed))
    if peak > 0.96:
        mixed = mixed / peak * 0.95

    wav_int16 = (mixed * 32767).astype(np.int16)
    sf.write(out_wav_path, wav_int16, sr, subtype='PCM_16')

    # Loudnorm master to -14 LUFS
    master_wav = out_wav_path.replace('.wav', '_norm.wav')
    subprocess.run([
        'ffmpeg', '-y', '-i', out_wav_path,
        '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9',
        '-ar', '44100', '-ac', '2', master_wav
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    os.replace(master_wav, out_wav_path)

    print(f"Long audio ready: {out_wav_path} ({total_dur:.2f}s)")
    return total_dur

def prepare_16x9_image(img_path):
    img = Image.open(img_path).convert('RGB')
    img = img.resize((1280, 720), Image.Resampling.LANCZOS)
    arr = np.array(img, dtype=np.float32)
    # Cold tone
    arr[:, :, 0] *= 0.92
    arr[:, :, 2] *= 1.06
    # Vignette
    y, x = np.ogrid[:720, :1280]
    dist = np.sqrt((x - 640)**2 + (y - 360)**2)
    max_d = np.sqrt(640**2 + 360**2)
    vig = 1.0 - 0.40 * (dist / max_d)**1.6
    for c in range(3):
        arr[:, :, c] = np.clip(arr[:, :, c] * vig, 0, 255)
    bg = Image.fromarray(arr.astype(np.uint8)).convert('RGBA')

    # Top & bottom cinematic gradients
    grad = Image.new('RGBA', (1280, 720), (0, 0, 0, 0))
    d_g = ImageDraw.Draw(grad)
    for i in range(120):
        a = int(200 * (1.0 - i/120.0))
        d_g.line([(0, i), (1280, i)], fill=(0, 0, 0, a))
    for i in range(580, 720):
        a = int(220 * ((i - 580)/140.0))
        d_g.line([(0, i), (1280, i)], fill=(0, 0, 0, a))
    return Image.alpha_composite(bg, grad)

def render_16x9_video(cfg):
    mp4_path = cfg['mp4_path']
    wav_path = cfg['wav_path']
    vo_a = cfg['vo_a']
    vo_b = cfg['vo_b']
    images = cfg['images']
    main_title = cfg['main_title']
    chapters = cfg['chapters']
    full_text = cfg['text']
    source_text = cfg['source_text']

    dur = process_long_audio(vo_a, vo_b, wav_path)

    # Prepare backgrounds
    bgs = [prepare_16x9_image(p) for p in images]

    # Subtitle word chunks
    words = full_text.split()
    total_chars = sum(len(w) for w in words)
    usable_dur = dur - 0.5
    chunks = []
    cur_c = []
    for w in words:
        cur_c.append(w)
        if len(cur_c) >= 5 or w.endswith(('.', '!', '?', ';')):
            chunks.append(cur_c)
            cur_c = []
    if cur_c: chunks.append(cur_c)

    word_items = []
    cur_time = 0.25
    for c_idx, c_words in enumerate(chunks):
        c_chars = sum(len(w) for w in c_words)
        c_dur = usable_dur * (c_chars / total_chars)
        w_time = cur_time
        for w in c_words:
            w_dur = c_dur * (len(w) / c_chars)
            word_items.append({
                'word': w,
                'start': w_time,
                'end': w_time + w_dur,
                'chunk_idx': c_idx
            })
            w_time += w_dur
        cur_time += c_dur

    # Fonts
    font_badge = ImageFont.truetype(FONT_ARCHIVO, 18, layout_engine=ImageFont.Layout.BASIC)
    font_title = ImageFont.truetype(FONT_ARCHIVO, 24, layout_engine=ImageFont.Layout.BASIC)
    font_sub = ImageFont.truetype(FONT_ARCHIVO, 28, layout_engine=ImageFont.Layout.BASIC)
    font_source = ImageFont.truetype(FONT_INTER, 15)

    # Static Badge
    badge_img = Image.new('RGBA', (280, 36), (0, 0, 0, 0))
    d_b = ImageDraw.Draw(badge_img)
    d_b.rounded_rectangle([0, 0, 276, 32], radius=6, fill=(12, 18, 14, 210), outline=(212, 255, 63, 220), width=2)
    d_b.text((16, 7), '⚡ BİLGİ DOZU  |  DERİN DOSYA', font=font_badge, fill=(212, 255, 63, 255))

    fps = 30
    total_frames = int(dur * fps)
    num_scenes = len(bgs)
    frames_per_scene = total_frames / num_scenes

    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-f', 'rawvideo', '-vcodec', 'rawvideo',
        '-s', '1280x720', '-pix_fmt', 'rgb24', '-r', str(fps),
        '-i', '-',
        '-i', wav_path,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        '-shortest', mp4_path
    ]
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"Rendering {mp4_path} (1280x720 16:9, {total_frames} frames)...")
    t0 = time.time()

    for f in range(total_frames):
        t_sec = f / fps

        # Determine active scene & smooth crossfade
        scene_float = f / frames_per_scene
        scene_idx = int(scene_float)
        scene_idx = min(scene_idx, num_scenes - 1)
        sub_progress = scene_float - scene_idx

        # 1-second crossfade near scene boundary
        trans_frames = 30
        frames_to_next = int(frames_per_scene * (scene_idx + 1)) - f
        if 0 < frames_to_next <= trans_frames and scene_idx < num_scenes - 1:
            alpha = 1.0 - (frames_to_next / float(trans_frames))
            frame = Image.blend(bgs[scene_idx], bgs[scene_idx + 1], alpha)
        else:
            frame = bgs[scene_idx].copy()

        draw = ImageDraw.Draw(frame)

        # 1. Top neon badge
        frame.alpha_composite(badge_img, (30, 20))

        # 2. Main Title & Chapter Banner
        cur_chap = chapters[min(scene_idx, len(chapters)-1)]
        draw.text((323, 25), main_title, font=font_title, fill=(0, 0, 0, 220))
        draw.text((320, 22), main_title, font=font_title, fill=(255, 255, 255, 240))

        # Chapter pill
        draw.rounded_rectangle([30, 65, 30 + font_title.getlength(cur_chap) + 24, 98], radius=5, fill=(0,0,0,160))
        draw.text((42, 69), cur_chap, font=font_title, fill=(212, 255, 63, 240))

        # 3. Subtitles (Bottom center)
        active_item = None
        for wi in word_items:
            if wi['start'] <= t_sec <= wi['end']:
                active_item = wi
                break
        if not active_item:
            prec = [wi for wi in word_items if wi['end'] < t_sec]
            if prec: active_item = prec[-1]

        if active_item:
            c_idx = active_item['chunk_idx']
            c_words = [wi for wi in word_items if wi['chunk_idx'] == c_idx]
            sub_w = sum(font_sub.getlength(wi['word'] + ' ') for wi in c_words)
            sub_x = (1280 - sub_w) / 2
            sub_y = 610

            for wi in c_words:
                w_str = wi['word'] + ' '
                if wi == active_item:
                    draw.text((sub_x + 2, sub_y + 2), w_str, font=font_sub, fill=(0, 0, 0, 255))
                    draw.text((sub_x, sub_y), w_str, font=font_sub, fill=(255, 225, 74, 255))
                else:
                    draw.text((sub_x + 2, sub_y + 2), w_str, font=font_sub, fill=(0, 0, 0, 220))
                    draw.text((sub_x, sub_y), w_str, font=font_sub, fill=(240, 240, 240, 240))
                sub_x += font_sub.getlength(w_str)

        # 4. Source text at bottom left
        draw.text((30, 680), source_text, font=font_source, fill=(150, 150, 150, 220))

        # Write to ffmpeg
        rgb_frame = frame.convert('RGB')
        try:
            proc.stdin.write(rgb_frame.tobytes())
        except (BrokenPipeError, IOError):
            break

    proc.stdin.close()
    proc.wait()
    t1 = time.time()
    print(f"Finished {mp4_path} in {t1-t0:.2f}s!")

