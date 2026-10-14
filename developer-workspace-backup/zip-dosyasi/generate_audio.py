import numpy as np
import soundfile as sf
import scipy.signal
import subprocess, json, os

def build_audio_for_video(vo_path, out_wav_path, cta_duration=4.5):
    # Load audio
    data, sr = sf.read(vo_path)
    if len(data.shape) > 1:
        data = data[:, 0]

    # 1. Energy detection & pause tightening
    hop = int(sr * 0.01) # 10ms
    win = int(sr * 0.025)
    n_frames = (len(data) - win) // hop + 1
    rms = np.array([np.sqrt(np.mean(data[i*hop : i*hop + win]**2) + 1e-12) for i in range(n_frames)])
    db = 20 * np.log10(rms + 1e-9)

    thresh = -30.0 # dB
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
    time_mapping = []
    speech_spans_in_tightened = []
    curr_new_time = 0.0

    for is_p, s, e in merged:
        t_start = (s * hop) / sr
        t_end = min(len(data), e * hop) / sr
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
            speech_spans_in_tightened.append((curr_new_time, curr_new_time + dur_chunk))

        time_mapping.append((t_start, curr_new_time, t_end, curr_new_time + dur_chunk))
        curr_new_time += dur_chunk

    tightened_vo = np.concatenate(tightened_chunks)
    total_dur = len(tightened_vo) / sr

    # 2. Minimal gerilim beat synthesis:
    # 55Hz drone + pulse + CTA riser
    t = np.linspace(0, total_dur, len(tightened_vo))

    # 55Hz drone (A1 note 55 Hz + harmonics)
    drone_55 = np.sin(2 * np.pi * 55 * t)
    drone_110 = 0.3 * np.sin(2 * np.pi * 110 * t)
    drone_165 = 0.12 * np.sin(2 * np.pi * 165 * t)
    # Slow LFO modulation (0.25 Hz)
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.25 * t)
    drone = (drone_55 + drone_110 + drone_165) * lfo * 0.08

    # Pulse: rhythmic heartbeat at ~65 BPM (~0.923s)
    pulse_period = 0.923
    pulse = np.zeros_like(t)
    pulse_decay = np.exp(-np.linspace(0, 12, int(sr * 0.22)))
    pulse_kernel = np.sin(2 * np.pi * 60 * np.linspace(0, 0.22, len(pulse_decay))) * pulse_decay
    for p_time in np.arange(0.2, total_dur - cta_duration, pulse_period):
        p_idx = int(p_time * sr)
        if p_idx + len(pulse_kernel) < len(pulse):
            pulse[p_idx : p_idx + len(pulse_kernel)] += pulse_kernel * 0.12

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
        sweep = np.sin(phase) * (norm_t ** 1.8) * 0.20
        noise = (np.random.rand(len(t_cta)) * 2 - 1) * (norm_t ** 2) * 0.10
        riser[cta_mask] = sweep + noise

    beat = drone + pulse + riser

    # Sidechain ducking:
    vo_abs = np.abs(tightened_vo)
    env_win = int(sr * 0.05)
    vo_env = np.convolve(vo_abs, np.ones(env_win)/env_win, mode='same')
    duck_gain = 0.70 - 0.45 * np.clip(vo_env / 0.12, 0, 1) # ducking between 0.25 and 0.70
    ducked_beat = beat * duck_gain

    # Mix VO + ducked beat
    mixed = tightened_vo * 0.92 + ducked_beat

    # int16 scaling: (mixed * 32767).astype(np.int16)
    peak = np.max(np.abs(mixed))
    if peak > 0.95:
        mixed = mixed / peak * 0.92
    wav_int16 = (np.clip(mixed, -1.0, 1.0) * 32767).astype(np.int16)

    raw_wav_path = out_wav_path.replace('.wav', '_raw.wav')
    sf.write(raw_wav_path, wav_int16, sr, subtype='PCM_16')

    # Master to -14 LUFS, TP -1.5 dB using ffmpeg
    cmd = [
        'ffmpeg', '-y', '-i', raw_wav_path,
        '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7',
        '-ar', '44100', '-ac', '2', out_wav_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    os.remove(raw_wav_path)

    # Measure final LUFS, LRA and duration
    probe_cmd = [
        'ffmpeg', '-i', out_wav_path,
        '-af', 'ebur128=framelog=quiet',
        '-f', 'null', '-'
    ]
    res = subprocess.run(probe_cmd, capture_output=True, text=True)
    
    # Parse ebur128 output
    i_lufs = None
    lra = None
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

    print(f"File {out_wav_path}: Duration={total_dur:.2f}s, I={i_lufs} LUFS, LRA={lra} LU")
    return total_dur, speech_spans_in_tightened

# Run for all 5 audios
for i in range(1, 6):
    build_audio_for_video(f'audio/vo_{i}.mp3', f'audio/master_{i}.wav')
