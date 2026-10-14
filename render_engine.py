import os, sys, math, time, subprocess, json
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont

# Set up paths
FONT_ARCHIVO = '/home/user/fonts/ArchivoBlack-Regular.ttf'
FONT_INTER = '/home/user/fonts/Inter-VariableFont.ttf'

def process_audio(vo_path, out_wav_path, cta_duration=4.5):
    data, sr = sf.read(vo_path)
    if len(data.shape) > 1:
        data = data[:, 0]

    # Energy & silence detection
    hop = int(sr * 0.01) # 10ms
    win = int(sr * 0.025)
    n_frames = (len(data) - win) // hop + 1
    rms = np.array([np.sqrt(np.mean(data[i*hop : i*hop + win]**2) + 1e-12) for i in range(n_frames)])
    db = 20 * np.log10(rms + 1e-9)

    thresh = -30.0
    is_pause = db < thresh

    min_pause_frames = 8
    min_speech_frames = 6

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
        if is_p and dur < min_pause_frames:
            smoothed.append((False, s, e))
        elif (not is_p) and dur < min_speech_frames:
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
    speech_spans = []
    curr_t = 0.0

    for is_p, s, e in merged:
        chunk = data[s * hop : min(len(data), e * hop)]
        if is_p:
            new_len = max(int(len(chunk) * 0.72), int(sr * 0.04))
            if len(chunk) > 0:
                idx = np.linspace(0, len(chunk) - 1, new_len).astype(int)
                comp_chunk = chunk[idx]
            else:
                comp_chunk = chunk
            tightened_chunks.append(comp_chunk)
            dur_chunk = len(comp_chunk) / sr
        else:
            tightened_chunks.append(chunk)
            dur_chunk = len(chunk) / sr
            speech_spans.append((curr_t, curr_t + dur_chunk))
        curr_t += dur_chunk

    tightened_vo = np.concatenate(tightened_chunks)
    total_dur = len(tightened_vo) / sr

    # Minimal gerilim beat synthesis:
    t = np.linspace(0, total_dur, len(tightened_vo))

    # 55Hz drone (A1 note 55 Hz + harmonics)
    drone_55 = np.sin(2 * np.pi * 55 * t)
    drone_110 = 0.28 * np.sin(2 * np.pi * 110 * t)
    drone_165 = 0.12 * np.sin(2 * np.pi * 165 * t)
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.25 * t)
    drone = (drone_55 + drone_110 + drone_165) * lfo * 0.07

    # Pulse at ~65 BPM (0.923s)
    pulse_period = 0.923
    pulse = np.zeros_like(t)
    pulse_decay = np.exp(-np.linspace(0, 14, int(sr * 0.22)))
    pulse_kernel = np.sin(2 * np.pi * 60 * np.linspace(0, 0.22, len(pulse_decay))) * pulse_decay
    for p_time in np.arange(0.2, total_dur - cta_duration, pulse_period):
        p_idx = int(p_time * sr)
        if p_idx + len(pulse_kernel) < len(pulse):
            pulse[p_idx : p_idx + len(pulse_kernel)] += pulse_kernel * 0.10

    # CTA riser in the last cta_duration seconds
    riser = np.zeros_like(t)
    cta_start_t = max(0, total_dur - cta_duration)
    cta_mask = t >= cta_start_t
    if np.any(cta_mask):
        t_cta = t[cta_mask] - cta_start_t
        cta_len = total_dur - cta_start_t
        norm_t = t_cta / cta_len
        freq = 90 * (7.0 ** norm_t)
        phase = 2 * np.pi * np.cumsum(freq) / sr
        sweep = np.sin(phase) * (norm_t ** 1.8) * 0.22
        noise = (np.random.rand(len(t_cta)) * 2 - 1) * (norm_t ** 2) * 0.08
        riser[cta_mask] = sweep + noise

    beat = drone + pulse + riser

    # Sidechain ducking
    vo_abs = np.abs(tightened_vo)
    env_win = int(sr * 0.05)
    vo_env = np.convolve(vo_abs, np.ones(env_win)/env_win, mode='same')
    duck_gain = 0.70 - 0.45 * np.clip(vo_env / 0.12, 0, 1)
    ducked_beat = beat * duck_gain

    # Mix
    mixed = tightened_vo * 0.94 + ducked_beat

    # Dynamic loudness shaping to ensure LRA > 2.0 (Hook slightly louder, body natural, CTA riser punch)
    dyn_gain = np.ones_like(t)
    dyn_gain[t < 4.5] = 1.12
    dyn_gain[(t >= 4.5) & (t < total_dur - 5.5)] = 0.90
    dyn_gain[t >= total_dur - 5.5] = 1.20
    mixed = mixed * dyn_gain

    # int16 scaling: (mixed * 32767).astype(np.int16)
    peak = np.max(np.abs(mixed))
    if peak > 0.95:
        mixed = mixed / peak * 0.92
    wav_int16 = (np.clip(mixed, -1.0, 1.0) * 32767).astype(np.int16)

    raw_wav_path = out_wav_path.replace('.wav', '_raw.wav')
    sf.write(raw_wav_path, wav_int16, sr, subtype='PCM_16')

    # Master with loudnorm
    cmd = [
        'ffmpeg', '-y', '-i', raw_wav_path,
        '-af', 'loudnorm=I=-14:TP=-1.5:LRA=9',
        '-ar', '44100', '-ac', '2', out_wav_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    if os.path.exists(raw_wav_path):
        os.remove(raw_wav_path)

    # Check ebur128 metrics
    probe_cmd = ['ffmpeg', '-i', out_wav_path, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-']
    res = subprocess.run(probe_cmd, capture_output=True, text=True)
    i_lufs, lra = None, None
    for line in res.stderr.split('\n'):
        if 'I:' in line and 'LUFS' in line:
            parts = line.split()
            for idx, p in enumerate(parts):
                if p == 'I:':
                    i_lufs = float(parts[idx+1])
        if 'LRA:' in line and 'LU' in line:
            parts = line.split()
            for idx, p in enumerate(parts):
                if p == 'LRA:':
                    lra = float(parts[idx+1])

    print(f"[{out_wav_path}] Dur: {total_dur:.2f}s | I: {i_lufs} LUFS | LRA: {lra} LU")
    return total_dur, speech_spans, i_lufs, lra

def prepare_background(img_path):
    img = Image.open(img_path).convert('RGB')
    img = img.resize((1080, 1920), Image.Resampling.LANCZOS)
    arr = np.array(img, dtype=np.float32)

    # Cold tone: R * 0.90, G * 0.98, B * 1.08
    arr[:, :, 0] *= 0.90
    arr[:, :, 1] *= 0.98
    arr[:, :, 2] *= 1.08

    # Vignette
    y, x = np.ogrid[:1920, :1080]
    cx, cy = 540, 960
    dist = np.sqrt((x - cx)**2 + (y - cy)**2)
    max_dist = np.sqrt(540**2 + 960**2)
    vignette = 1.0 - 0.45 * (dist / max_dist)**1.8
    for c in range(3):
        arr[:, :, c] = np.clip(arr[:, :, c] * vignette, 0, 255)

    # Film grain
    grain = np.random.normal(0, 3.5, (1920, 1080, 1))
    arr = np.clip(arr + grain, 0, 255).astype(np.uint8)
    bg = Image.fromarray(arr).convert('RGBA')

    # Top & bottom black gradients
    grad = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0))
    draw_g = ImageDraw.Draw(grad)
    for i in range(460):
        alpha = int(225 * (1.0 - (i / 460.0)**1.2))
        draw_g.line([(0, i), (1080, i)], fill=(0, 0, 0, alpha))
    for i in range(1340, 1920):
        alpha = int(240 * ((i - 1340) / 580.0)**1.2)
        draw_g.line([(0, i), (1080, i)], fill=(0, 0, 0, alpha))

    return Image.alpha_composite(bg, grad)

def build_word_timeline(text, total_dur, emphasis_words):
    words = text.split()
    total_chars = sum(len(w) for w in words)
    t_start = 0.20
    t_end = total_dur - 0.20
    usable = t_end - t_start

    # Group into chunks of 3-5 words
    chunks = []
    curr = []
    for w in words:
        curr.append(w)
        if len(curr) >= 4 or w.endswith(('.', '!', '?', ';')):
            chunks.append(curr)
            curr = []
    if curr:
        chunks.append(curr)

    word_items = []
    chunk_time = t_start
    for c_idx, c_words in enumerate(chunks):
        c_chars = sum(len(w) for w in c_words)
        c_dur = usable * (c_chars / total_chars)
        
        # Allocate time per word inside chunk
        w_time = chunk_time
        for w in c_words:
            w_dur = c_dur * (len(w) / c_chars)
            clean_w = w.strip('.,!?:;\'"').lower()
            is_emph = any(ew.lower() in clean_w for ew in emphasis_words)
            word_items.append({
                'word': w,
                'start': w_time,
                'end': w_time + w_dur,
                'chunk_idx': c_idx,
                'is_emphasis': is_emph
            })
            w_time += w_dur
        chunk_time += c_dur

    return chunks, word_items

def render_short_video(cfg):
    vo_path = cfg['vo_path']
    wav_path = cfg['wav_path']
    mp4_path = cfg['mp4_path']
    img1_path = cfg['img1_path']
    img2_path = cfg['img2_path']
    title_lines = cfg['title_lines']
    source_text = cfg['source_text']
    text = cfg['text']
    emphasis_words = cfg['emphasis_words']

    # 1. Audio Processing
    dur, speech_spans, i_lufs, lra = process_audio(vo_path, wav_path)

    # 2. Backgrounds
    bg1 = prepare_background(img1_path)
    bg2 = prepare_background(img2_path)
    arr_bg1 = np.array(bg1, dtype=np.float32)
    arr_bg2 = np.array(bg2, dtype=np.float32)

    # 3. Word timeline
    chunks, word_items = build_word_timeline(text, dur, emphasis_words)

    # 4. Fonts
    font_tag = ImageFont.truetype(FONT_ARCHIVO, 24, layout_engine=ImageFont.Layout.BASIC)
    # Auto-scale title font if needed
    font_title_size = 56
    font_title = ImageFont.truetype(FONT_ARCHIVO, font_title_size, layout_engine=ImageFont.Layout.BASIC)
    max_title_w = max(font_title.getlength(line) for line in title_lines)
    while max_title_w > 940 and font_title_size > 36:
        font_title_size -= 2
        font_title = ImageFont.truetype(FONT_ARCHIVO, font_title_size, layout_engine=ImageFont.Layout.BASIC)
        max_title_w = max(font_title.getlength(line) for line in title_lines)

    font_sub = ImageFont.truetype(FONT_ARCHIVO, 44, layout_engine=ImageFont.Layout.BASIC)
    font_inter = ImageFont.truetype(FONT_INTER, 22)
    font_inter_bold = ImageFont.truetype(FONT_INTER, 24)

    # Static elements pre-drawing
    # A. Top progress bar coordinates
    p_bar_x, p_bar_y, p_bar_w, p_bar_h = 60, 50, 960, 6

    # B. Sol ust BILGI DOZU neon badge
    badge_img = Image.new('RGBA', (210, 52), (0, 0, 0, 0))
    d_badge = ImageDraw.Draw(badge_img)
    d_badge.rounded_rectangle([0, 0, 206, 48], radius=8, fill=(15, 22, 16, 215), outline=(212, 255, 63, 230), width=2)
    d_badge.text((22, 11), 'BİLGİ DOZU', font=font_tag, fill=(212, 255, 63, 255))

    # C. Source and brand signature
    source_brand_img = Image.new('RGBA', (1080, 120), (0, 0, 0, 0))
    d_sb = ImageDraw.Draw(source_brand_img)
    sw = font_inter.getlength(source_text)
    brand_text = 'BİLGİ DOZU  •  BİLİM VE KEŞİF'
    bw = font_inter_bold.getlength(brand_text)
    d_sb.text(((1080 - sw)/2, 20), source_text, font=font_inter, fill=(160, 160, 160, 220))
    d_sb.text(((1080 - bw)/2, 58), brand_text, font=font_inter_bold, fill=(125, 125, 125, 200))

    # Pre-render title image with animation support
    fps = 30
    total_frames = int(dur * fps)
    mid_frame = total_frames // 2
    trans_len = int(1.0 * fps) # 1.0s transition in the middle

    # Start ffmpeg pipe
    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-f', 'rawvideo', '-vcodec', 'rawvideo',
        '-s', '1080x1920', '-pix_fmt', 'rgb24', '-r', str(fps),
        '-i', '-',
        '-i', wav_path,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        '-shortest', mp4_path
    ]
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    print(f"Rendering {mp4_path} ({total_frames} frames)...")
    t0 = time.time()

    for f in range(total_frames):
        t_sec = f / fps

        # Fast Background Selection
        if f < (mid_frame - trans_len // 2):
            frame = bg1.copy()
        elif f > (mid_frame + trans_len // 2):
            frame = bg2.copy()
        else:
            alpha = (f - (mid_frame - trans_len // 2)) / float(trans_len)
            frame = Image.blend(bg1, bg2, alpha)
        draw = ImageDraw.Draw(frame)

        # 1. Progress Bar
        draw.rounded_rectangle([p_bar_x, p_bar_y, p_bar_x + p_bar_w, p_bar_y + p_bar_h], radius=3, fill=(55, 55, 55, 180))
        prog = min(1.0, t_sec / dur)
        cur_w = int(p_bar_w * prog)
        if cur_w > 0:
            draw.rounded_rectangle([p_bar_x, p_bar_y, p_bar_x + cur_w, p_bar_y + p_bar_h], radius=3, fill=(212, 255, 63, 255))

        # 2. Top-left neon badge
        frame.alpha_composite(badge_img, (60, 85))

        # 3. Title with line slide-in entrance
        # Line 0 enters 0.0 - 0.4s
        # Line 1 enters 0.3 - 0.7s
        # Line 2 enters 0.6 - 1.0s
        t_y = 185
        line_spacing = font_title_size + 14
        for l_idx, line in enumerate(title_lines):
            l_start = l_idx * 0.28
            l_end = l_start + 0.40
            if t_sec < l_start:
                continue
            elif t_sec < l_end:
                progress = (t_sec - l_start) / 0.40
                y_offset = (1.0 - progress) * 20
                alpha_val = int(255 * progress)
            else:
                y_offset = 0
                alpha_val = 255

            is_last = (l_idx == len(title_lines) - 1)
            color = (212, 255, 63, alpha_val) if is_last else (255, 255, 255, alpha_val)
            shadow_color = (0, 0, 0, int(alpha_val * 0.85))

            draw.text((63, t_y + y_offset + 3), line, font=font_title, fill=shadow_color)
            draw.text((60, t_y + y_offset), line, font=font_title, fill=color)
            t_y += line_spacing

        # 4. Word-by-word synchronized subtitles
        # Find active word
        active_w_item = None
        for wi in word_items:
            if wi['start'] <= t_sec <= wi['end']:
                active_w_item = wi
                break
        if active_w_item is None:
            # Check closest preceding
            prec = [wi for wi in word_items if wi['end'] < t_sec]
            if prec:
                active_w_item = prec[-1]
            elif word_items:
                active_w_item = word_items[0]

        if active_w_item is not None:
            c_idx = active_w_item['chunk_idx']
            c_words = chunks[c_idx]

            # Measure width
            c_items = [wi for wi in word_items if wi['chunk_idx'] == c_idx]
            total_sub_w = sum(font_sub.getlength(wi['word'] + ' ') for wi in c_items)
            sub_x = (1080 - total_sub_w) / 2
            sub_y = 1380

            for wi in c_items:
                w_str = wi['word'] + ' '
                is_active = (wi == active_w_item)
                is_emph = wi['is_emphasis']

                if is_active:
                    fill_col = (255, 225, 74, 255) # Bright Yellow
                    # Glow / shadow
                    draw.text((sub_x + 3, sub_y + 3), w_str, font=font_sub, fill=(0, 0, 0, 255))
                    draw.text((sub_x, sub_y), w_str, font=font_sub, fill=fill_col)
                elif is_emph:
                    fill_col = (255, 225, 74, 230) # Persistent yellow emphasis
                    draw.text((sub_x + 2, sub_y + 2), w_str, font=font_sub, fill=(0, 0, 0, 220))
                    draw.text((sub_x, sub_y), w_str, font=font_sub, fill=fill_col)
                else:
                    fill_col = (240, 240, 240, 240) # White/light grey
                    draw.text((sub_x + 2, sub_y + 2), w_str, font=font_sub, fill=(0, 0, 0, 200))
                    draw.text((sub_x, sub_y), w_str, font=font_sub, fill=fill_col)

                sub_x += font_sub.getlength(w_str)

        # 5. Bottom Source & Brand
        frame.alpha_composite(source_brand_img, (0, 1740))

        # Convert to RGB and write to ffmpeg pipe
        rgb_frame = frame.convert('RGB')
        try:
            proc.stdin.write(rgb_frame.tobytes())
        except (BrokenPipeError, IOError) as e:
            print(f"Broken pipe at frame {f} of {total_frames}: {e}")
            break

    proc.stdin.close()
    proc.wait()
    t1 = time.time()
    print(f"Finished {mp4_path} in {t1-t0:.2f}s!")

