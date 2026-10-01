"""Generate Turkish captions for R2 uploads. No paid transcription API or stored runner credential."""
import argparse
import base64
import html
import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://xpdiwyxnnrmyvpcqwuyb.supabase.co/functions/v1/dbs-api"
AUDIENCE = "drabornseries-subtitles"
MODEL_TR = "Helsinki-NLP/opus-mt-tc-big-en-tr"
WORKER = "https://drabornseries.draborneagle.workers.dev"
JOB_FILE = Path(os.environ.get("RUNNER_TEMP", tempfile.gettempdir())) / "dbs-caption-job.json"


def oidc_token():
    url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    url += ("&" if "?" in url else "?") + urllib.parse.urlencode({"audience": AUDIENCE})
    request = urllib.request.Request(url, headers={"Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)["value"]


def api(action, **values):
    payload = json.dumps({"action": action, **values}, ensure_ascii=False).encode()
    token = oidc_token()
    request = urllib.request.Request(API, data=payload, headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=75) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Never log a token, media link, or transcript.
        if error.code == 401:
            segment = token.split(".")[1]
            claims = json.loads(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))
            fields = ["iss", "aud", "repository", "repository_id", "ref", "sub", "workflow_ref", "workflow", "event_name", "iat", "nbf", "exp"]
            print("Runner validation context: " + json.dumps({key: claims.get(key) for key in fields}))
            response = json.loads(error.read())
            print("Runner rejection: " + str(response.get("error", response.get("code", "HTTP401"))))
        raise RuntimeError("Caption service HTTP " + str(error.code)) from None


def claim():
    job = api("caption-jobs")["job"]
    JOB_FILE.write_text(json.dumps(job), encoding="utf-8")
    if "GITHUB_OUTPUT" in os.environ:
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as out:
            out.write("pending=" + str(bool(job)).lower() + "\n")
    print("Caption job ready." if job else "No pending caption jobs.")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("Unexpected media redirect")


def download(url, target):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme + "://" + parsed.netloc != WORKER or not parsed.path.startswith("/media/") or parsed.username or parsed.password:
        raise RuntimeError("Unexpected media origin")
    opener = urllib.request.build_opener(NoRedirect)
    total = 0
    with opener.open(url, timeout=120) as response, target.open("wb") as output:
        if not response.headers.get("Content-Type", "").startswith("video/"):
            raise RuntimeError("Unexpected media type")
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > 3 * 1024 ** 3:
                raise RuntimeError("Video exceeds processing limit")
            output.write(chunk)


def timestamp(seconds):
    value = max(0, int(round(seconds * 1000)))
    hour, remainder = divmod(value, 3600000)
    minute, remainder = divmod(remainder, 60000)
    second, millis = divmod(remainder, 1000)
    return f"{hour:02}:{minute:02}:{second:02}.{millis:03}"


def build_vtt(segments, duration):
    note = "NOTE Automatically generated Turkish captions. Whisper (MIT). Translation model: Helsinki-NLP/opus-mt-tc-big-en-tr (CC BY 4.0), https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-en-tr . Translation output may contain errors."
    blocks = ["WEBVTT", note]
    previous = 0
    for start, end, text in segments:
        start, end = max(previous, start), min(duration, end)
        text = html.escape(" ".join(text.split()), quote=False)
        if not text or end <= start:
            continue
        # Split long speech stretches into readable cues, retaining their time interval.
        words = text.split()
        chunks, line = [], []
        for word in words:
            if line and len(" ".join(line + [word])) > 84:
                chunks.append(" ".join(line)); line = []
            line.append(word)
        if line:
            chunks.append(" ".join(line))
        for index, chunk in enumerate(chunks):
            begin = start + (end - start) * index / len(chunks)
            finish = start + (end - start) * (index + 1) / len(chunks)
            if round(finish * 1000) <= round(begin * 1000):
                continue
            blocks.append(timestamp(begin) + " --> " + timestamp(finish) + "\n" + chunk)
        previous = start
    return "\n\n".join(blocks) + "\n" if len(blocks) > 2 else None


def process(job, model):
    import torch
    from transformers import MarianMTModel, MarianTokenizer
    duration = float(job["duration"])
    with tempfile.TemporaryDirectory(prefix="dbs-caption-") as folder:
        video, audio = Path(folder) / "video.mp4", Path(folder) / "audio.wav"
        download(job["url"], video)
        probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", str(video)], capture_output=True, check=True, timeout=60)
        metadata = json.loads(probe.stdout)
        duration = float(metadata.get("format", {}).get("duration", duration))
        if not 0 < duration <= 7200:
            raise RuntimeError("Unsupported video duration")
        streams = metadata.get("streams", [])
        if not any(stream["codec_type"] == "audio" for stream in streams):
            return None, "", duration
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", str(audio)], capture_output=True, check=True, timeout=600)
        segments, info = model.transcribe(str(audio), task="transcribe", beam_size=5, vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500}, condition_on_previous_text=False, hallucination_silence_threshold=2)
        speech = [(part.start, part.end, part.text) for part in segments if part.no_speech_prob < 0.65 and part.avg_logprob > -1.0 and part.text.strip()]
        if not speech:
            return None, info.language, duration
        if info.language != "tr":
            if info.language != "en":
                segments, _ = model.transcribe(str(audio), language=info.language, task="translate", beam_size=5, vad_filter=True,
                    condition_on_previous_text=False, hallucination_silence_threshold=2)
                speech = [(part.start, part.end, part.text) for part in segments if part.no_speech_prob < 0.65 and part.avg_logprob > -1.0 and part.text.strip()]
            tokenizer = MarianTokenizer.from_pretrained(MODEL_TR)
            translator = MarianMTModel.from_pretrained(MODEL_TR).eval()
            translated = []
            for offset in range(0, len(speech), 8):
                batch = speech[offset:offset + 8]
                encoded = tokenizer([item[2] for item in batch], return_tensors="pt", padding=True, truncation=True, max_length=512)
                with torch.inference_mode():
                    generated = translator.generate(**encoded, max_new_tokens=512, num_beams=4)
                for item, text in zip(batch, tokenizer.batch_decode(generated, skip_special_tokens=True)):
                    translated.append((item[0], item[1], text))
            speech = translated
            del translator
        return build_vtt(speech, duration), info.language, duration


def finish(job, outcome, **values):
    result = api("caption-complete", id=job["id"], lease=job["lease"], outcome=outcome, **values)
    print("Caption job " + result["status"] + ".")
    JOB_FILE.write_text("null", encoding="utf-8")


def run():
    from faster_whisper import WhisperModel
    import torch
    torch.set_num_threads(2)
    model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=2, num_workers=1)
    # Claim the next job only after finishing the first, so its lease remains fresh.
    for index in range(3):
        job = json.loads(JOB_FILE.read_text(encoding="utf-8"))
        if not job:
            break
        try:
            vtt, language, duration = process(job, model)
            finish(job, "completed" if vtt else "no_speech", language=language, duration=duration, **({"vtt": vtt} if vtt else {}))
        except Exception as error:
            print("Caption generation failed (" + type(error).__name__ + ").")
            finish(job, "failed")
            raise RuntimeError("Caption generation failed") from None
        if index < 2:
            claim()


def selftest():
    from faster_whisper import WhisperModel
    import shutil
    synthesizer = shutil.which("espeak-ng") or shutil.which("espeak")
    if not synthesizer:
        raise RuntimeError("Speech fixture synthesizer unavailable")
    with tempfile.TemporaryDirectory(prefix="dbs-speech-test-") as folder:
        audio = Path(folder) / "speech.wav"
        subprocess.run([synthesizer, "-v", "en-us", "-s", "140", "-w", str(audio), "Hello. I am testing automatic Turkish subtitles. Thank you for watching."], check=True, capture_output=True)
        metadata = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(audio)], check=True, capture_output=True)
        duration = float(json.loads(metadata.stdout)["format"]["duration"])
        # Exercise the same real recognition/translation path without publishing a fixture.
        global download
        original_download = download
        download = lambda _url, target: shutil.copyfile(audio, target)
        try:
            model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=2)
            vtt, language, _ = process({"url": "fixture", "duration": duration}, model)
            if not vtt or language != "en" or not any(word in vtt.lower() for word in ["merhaba", "türkçe", "izledi", "teşekkür"]):
                raise RuntimeError("Speech recognition / Turkish translation smoke test failed")
            print("Speech fixture recognized and translated to Turkish; no fixture published.")
        finally:
            download = original_download


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["claim", "run", "fail", "selftest"])
    args = parser.parse_args()
    if args.mode == "claim":
        claim()
    elif args.mode == "run":
        run()
    elif args.mode == "selftest":
        selftest()
    elif JOB_FILE.exists():
        job = json.loads(JOB_FILE.read_text(encoding="utf-8"))
        if job:
            finish(job, "failed")
