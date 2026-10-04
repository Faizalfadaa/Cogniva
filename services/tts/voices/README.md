# Reference recordings

Drop one audio file here per character. The filename is the voice id:

```
voices/yuzuki.wav
voices/reina.wav
voices/akira.wav
```

These are the clips XTTS clones from. A voice with no file here still speaks —
it falls back to a built-in XTTS speaker — so the app works before you record
anything.

**Need the words to say?** [`PROMPTS.md`](PROMPTS.md) has a voice-design prompt,
a ready-to-read reference script, and delivery notes for each of the three
characters — plus why the scripts are shaped the way they are.

**Nothing in this folder is committed.** `.gitignore` excludes every audio file,
because a recording of someone's voice is personal data.

## Only clone a voice you have permission to clone

Your own voice, or one whose owner has agreed to this specific use. Cloning a
real person's voice without their consent is the one way this feature causes
actual harm, and it is also the easiest thing to get right: ask first.

## What makes a good reference clip

| | |
|---|---|
| **Length** | 6–30 seconds. Longer rarely helps; under 6s sounds unstable. |
| **Content** | Normal speaking, varied intonation, complete sentences. |
| **Quality** | Clean and close-mic'd. No music, no other voices, no echo. |
| **Format** | Mono WAV, 22050 Hz or higher. `.mp3`, `.flac`, `.ogg` also work. |

The clone copies whatever it hears, so room reverb and background hiss are
copied too. A quiet room with a phone held close beats a noisy room with a good
microphone.

## Converting a recording

```bash
# Any input -> mono 22.05 kHz WAV, trimming to the best 20 seconds
ffmpeg -i raw.m4a -ss 00:00:05 -t 20 -ac 1 -ar 22050 yuzuki.wav
```

Strip leading and trailing silence too — XTTS treats it as part of the voice:

```bash
ffmpeg -i yuzuki.wav -af "silenceremove=start_periods=1:start_silence=0.1:start_threshold=-45dB" yuzuki_trimmed.wav
```

## Checking a voice took

With the service running:

```bash
curl http://localhost:8020/voices

curl -X POST http://localhost:8020/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Wait, so the oxygen comes from the water, not the carbon dioxide?","voice":"yuzuki"}' \
  --output test.wav
```

The response header `X-TTS-Cloned: 1` confirms your clip was used rather than
the built-in speaker. Replacing a file invalidates its cached audio
automatically, so you can iterate on a recording and hear the difference.
