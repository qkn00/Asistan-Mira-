# Mira — Phase 2: Voice + hands-free interaction

This package contains the Phase 2 voice work built directly into the Next.js project.

## Included
- Turkish `SpeechSynthesis` TTS (`tr-TR`) with voice selection from installed browser voices.
- Natural-rate/pitch controls already stored in the settings API.
- Word-boundary driven subtitle highlighting.
- Audio-style mouth amplitude driver (`ampRef`) used for subtle avatar micro-motion and waveform animation.
- Best-effort automatic microphone start when the page opens.
- Automatic return to listening after Mira finishes speaking.
- iPhone/Safari fallback: if the browser blocks microphone autoplay, the microphone button remains available for the required user gesture/permission.
- Microphone cleanup on unmount.

## Important browser limitation
Web Speech APIs are browser/OS dependent. iOS Safari may require a user gesture before microphone capture is allowed, and available Turkish voices depend on the voices installed by iOS. The code therefore does not pretend that a browser can bypass those restrictions.

## AI backend
`/api/chat` and `src/lib/brain.ts` are already wired. If `OPENAI_API_KEY` is absent, the project falls back to its local rule-based Turkish responses. If the key is present, the server can use the configured model.

## Next phase
Phase 3 should move long-running work out of the browser: persistent backend, n8n jobs, operation logs, YouTube/TikTok automation, trend monitoring, and reminders.
