#!/usr/bin/env python3
"""
Generate the voice preview clips for the account Voice tab play buttons.

The receptionist voices (FEMALE and MALE below, mirroring the engine's
FEMININE_VOICES and MASCULINE_VOICES) only exist on OpenAI's
`gpt-live-1`, which accepts nothing but a WebRTC transport (no /v1/audio/speech, no Realtime websocket). So this
script opens one short WebRTC session per clip with aiortc, sends a silent mic,
asks her to say one fixed line, records her audio track, and encodes it to mp3.

Output: client/public/voice-samples/{voice}-{lang}.mp3

Needs: python3 with `aiortc httpx` (pip install aiortc httpx), ffmpeg/ffprobe,
and OPENAI_API_KEY (read from the env, else /home/gabriel/automations/.env).
Never set OPENAI_PROJECT_ID: the key lives outside that project and it 401s.

Usage:
  python3 script/gen-voice-samples.py                 # all 75 clips
  python3 script/gen-voice-samples.py gleam-nl tempo  # only matching clips
  python3 script/gen-voice-samples.py --force         # overwrite existing
Each live session is billable, so existing files are skipped unless --force.
"""

import asyncio
import json
import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import httpx
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.mediastreams import AudioStreamTrack, MediaStreamError

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "client" / "public" / "voice-samples"
LIVE_URL = "https://api.openai.com/v1/live/sessions"
MODEL = "gpt-live-1"

FEMALE = ["marin", "gleam", "willow", "bossa", "nuri", "juni", "brise", "nira", "harema", "noeul", "quartz", "delta", "coral", "sage", "shimmer"]
MALE = ["vesper", "stone", "meridian", "ripple", "tempo", "flitz", "sillage", "shida", "beacon", "cinder"]
MALE_NAMES = {"en": "Harry", "nl": "Daan", "pt": "Pedro"}

LINES = {
    "en": "Hi, thanks for calling. This is {name}. How can I help you today?",
    "nl": "Hoi, fijn dat je belt. Je spreekt met {name}. Waarmee kan ik je helpen?",
    "pt_f": "Oi, obrigada por ligar. Aqui é a {name}. Como posso te ajudar hoje?",
    "pt_m": "Oi, obrigado por ligar. Aqui é o {name}. Como posso te ajudar hoje?",
}

# Written in the clip's own language: an English instruction pulls the accent.
INSTRUCTIONS = {
    "en": (
        "You are a friendly receptionist answering the phone. Say exactly this "
        "sentence, in English, and nothing else, then stop: \"{line}\" "
        "Say it warmly, with a smile in your voice, at a natural pace."
    ),
    "nl": (
        "Je bent een vriendelijke receptionist die de telefoon opneemt. Zeg "
        "precies deze zin, in het Nederlands, en verder niets, stop daarna: "
        "\"{line}\" Zeg het hartelijk, met een glimlach in je stem, in een "
        "gewoon gesprekstempo, als een Nederlander."
    ),
    "pt": (
        "Você é {art} recepcionista simpátic{suf} atendendo o telefone. Fale "
        "exatamente esta frase, em português do Brasil, e mais nada, depois "
        "pare: \"{line}\" Fale com carinho, com um sorriso na voz, num ritmo "
        "de conversa normal, com sotaque brasileiro."
    ),
}
CUE = {"en": "Say the sentence now.", "nl": "Zeg de zin nu.", "pt": "Fale a frase agora."}


def api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        return key
    for line in Path("/home/gabriel/automations/.env").read_text().splitlines():
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("OPENAI_API_KEY not found")


def clip_text(voice: str, lang: str) -> tuple[str, str]:
    male = voice in MALE
    name = MALE_NAMES[lang] if male else "Sara"
    if lang == "pt":
        line = LINES["pt_m" if male else "pt_f"].format(name=name)
        instr = INSTRUCTIONS["pt"].format(line=line, art="um" if male else "uma", suf="o" if male else "a")
    else:
        line = LINES[lang].format(name=name)
        instr = INSTRUCTIONS[lang].format(line=line)
    return line, instr


async def record(voice: str, lang: str, wav_path: Path, key: str) -> str:
    """One live session: returns her output transcript, writes the received PCM as WAV."""
    line, instructions = clip_text(voice, lang)
    pc = RTCPeerConnection()
    pc.addTrack(AudioStreamTrack())  # base class yields silence: a quiet mic
    dc = pc.createDataChannel("oai-events")
    frames: list[bytes] = []
    fmt = {"ch": 2, "rate": 48000}
    transcript: list[str] = []
    state = {"last": None, "started": False, "closed": False}
    loop = asyncio.get_running_loop()

    @pc.on("track")
    def on_track(track):
        async def pull():
            while True:
                try:
                    f = await track.recv()
                except MediaStreamError:
                    return
                # Packed s16 from the Opus decoder; ffmpeg downmixes later.
                ch = len(f.layout.channels)
                fmt["ch"], fmt["rate"] = ch, f.sample_rate
                frames.append(bytes(f.planes[0])[: f.samples * ch * 2])
        asyncio.ensure_future(pull())

    @dc.on("message")
    def on_msg(raw):
        ev = json.loads(raw)
        t = ev.get("type")
        if t == "session.started":
            dc.send(json.dumps({"type": "session.instructions.append", "delegation_id": None, "content": CUE[lang]}))
        elif t == "session.output_transcript.delta":
            transcript.append(ev.get("delta", ""))
            state["last"] = loop.time()
        elif t == "error":
            print(f"  [{voice}-{lang}] error: {ev.get('error')}", file=sys.stderr)
        elif t == "session.closed":
            state["closed"] = True

    await pc.setLocalDescription(await pc.createOffer())
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            LIVE_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "transport": {"type": "webrtc", "sdp": pc.localDescription.sdp},
                "session": {"model": MODEL, "instructions": instructions, "audio": {"output": {"voice": voice}}},
            },
        )
    if r.status_code >= 400:
        await pc.close()
        raise RuntimeError(f"OpenAI {r.status_code}: {r.text[:300]}")
    await pc.setRemoteDescription(RTCSessionDescription(sdp=r.json()["transport"]["sdp"], type="answer"))

    t0 = loop.time()
    # Done once the transcript has been quiet 2.5s (audio trails the text), or 25s.
    while loop.time() - t0 < 25 and not state["closed"]:
        await asyncio.sleep(0.25)
        if state["last"] and loop.time() - state["last"] > 2.5:
            break
    try:
        if dc.readyState == "open":
            dc.send(json.dumps({"type": "session.close"}))
            await asyncio.sleep(0.3)
    finally:
        await pc.close()

    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(fmt["ch"])
        w.setsampwidth(2)
        w.setframerate(fmt["rate"])
        w.writeframes(b"".join(frames))
    return "".join(transcript).strip()


def encode(wav: Path, mp3: Path) -> None:
    # Trim the silent lead-in and tail, then 24 kHz mono 64 kbps mp3.
    af = (
        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
        "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse,"
        "afade=t=in:d=0.02"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af", af,
         "-ac", "1", "-ar", "24000", "-codec:a", "libmp3lame", "-b:a", "64k", str(mp3)],
        check=True,
    )


def probe(mp3: Path) -> tuple[float, float]:
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(mp3)],
        capture_output=True, text=True, check=True).stdout.strip() or 0)
    vd = subprocess.run(["ffmpeg", "-i", str(mp3), "-af", "volumedetect", "-f", "null", "-"],
                        capture_output=True, text=True).stderr
    mean = next((float(l.split(":")[1].split()[0]) for l in vd.splitlines() if "mean_volume" in l), -99.0)
    return dur, mean


async def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    key = api_key()
    OUT.mkdir(parents=True, exist_ok=True)
    clips = [(v, l) for v in FEMALE + MALE for l in ("en", "nl", "pt")]
    if args:
        clips = [(v, l) for v, l in clips if any(a in f"{v}-{l}" for a in args)]
    failed = []
    with tempfile.TemporaryDirectory() as tmp:
        for voice, lang in clips:
            mp3 = OUT / f"{voice}-{lang}.mp3"
            if mp3.exists() and not force:
                print(f"skip {mp3.name} (exists)")
                continue
            ok = False
            for attempt in (1, 2):  # one retry max: each attempt is billable
                wav = Path(tmp) / f"{voice}-{lang}.wav"
                try:
                    said = await record(voice, lang, wav, key)
                    encode(wav, mp3)
                    dur, mean = probe(mp3)
                except Exception as e:  # noqa: BLE001
                    print(f"FAIL {voice}-{lang} attempt {attempt}: {e}")
                    continue
                ok = 2.0 <= dur <= 8.0 and mean > -40
                print(f"{'ok  ' if ok else 'BAD '} {mp3.name} {dur:.2f}s mean {mean:.1f}dB "
                      f"{mp3.stat().st_size // 1024}KB | {said}")
                if ok:
                    break
            if not ok:
                failed.append(f"{voice}-{lang}")
                mp3.unlink(missing_ok=True)  # so a plain re-run retries it
    if failed:
        print("FAILED:", ", ".join(failed))


if __name__ == "__main__":
    asyncio.run(main())
