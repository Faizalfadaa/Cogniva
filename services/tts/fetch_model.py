r"""
Download model weights reliably, with resume and retries.

Both engines' own loaders fetch weights on first use, and both have stalled here
in practice: XTTS streams a 1.9 GB checkpoint with no resume at all, and a
Chatterbox download was left dead at 895 MB of 1007 MB with nothing retrying it.
This script pulls the same files through huggingface_hub, which continues a
partial file instead of starting over, and retries with backoff.

    .venv\Scripts\python.exe fetch_model.py                  # configured engine
    .venv\Scripts\python.exe fetch_model.py --engine xtts

Safe to re-run at any time: complete files are skipped, partial ones resume.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import time
from pathlib import Path

# Turn off Xet transfer before huggingface_hub is imported.
#
# hf_xet ships with chatterbox-tts and takes over downloads. Observed here: it
# ignored an existing 895 MB partial file, created a fresh 0-byte one beside it,
# and then transferred nothing at all. Plain HTTP resumes the partial correctly
# — it is how the XTTS weights were eventually fetched. Set
# COGNIVA_TTS_USE_XET=1 to opt back in if a future release fixes it.
if os.environ.get("COGNIVA_TTS_USE_XET", "") not in {"1", "true", "yes"}:
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

sys.path.insert(0, str(Path(__file__).parent))

from app import config  # noqa: E402

MAX_ATTEMPTS = 6

# Exactly what ChatterboxTTS.from_pretrained asks for, in its own order.
CHATTERBOX_REPO = "ResembleAI/chatterbox"
CHATTERBOX_FILES = [
    "ve.safetensors",
    "t3_cfg.safetensors",
    "s3gen.safetensors",
    "tokenizer.json",
    "conds.pt",
]

XTTS_REPO = "coqui/XTTS-v2"
XTTS_DIR_NAME = "tts_models--multilingual--multi-dataset--xtts_v2"
XTTS_FILES = ["config.json", "model.pth", "vocab.json", "speakers_xtts.pth"]


def with_retries(what: str, action):
    """Run `action`, retrying with backoff. Returns None if it never succeeds."""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return action()
        except Exception as err:
            print(f"    attempt {attempt}/{MAX_ATTEMPTS} failed: {type(err).__name__}: {err}")
            if attempt == MAX_ATTEMPTS:
                print(f"    giving up on {what}")
                return None
            backoff = min(60, 5 * attempt)
            print(f"    retrying in {backoff}s (partial data is kept and resumed)")
            time.sleep(backoff)
    return None


def download_resumable(url: str, dest: Path, chunk: int = 1 << 20) -> None:
    """
    Stream `url` to `dest`, continuing a partial file instead of restarting.

    Deliberately plain HTTP rather than huggingface_hub: on this machine the
    library opens a connection and then transfers nothing, while the same URL
    pulls at ~3.5 MB/s through requests. A `.part` file is promoted only once
    the server's declared length has actually arrived, so an interrupted run can
    never leave a truncated file that looks complete.
    """
    import requests

    part = dest.with_suffix(dest.suffix + ".part")
    have = part.stat().st_size if part.is_file() else 0
    headers = {"Range": f"bytes={have}-"} if have else {}

    with requests.get(url, stream=True, timeout=60, headers=headers) as response:
        if have and response.status_code == 200:
            # Server ignored the range and restarted the file; discard the head
            # we already had rather than concatenating two overlapping copies.
            have = 0
            part.unlink(missing_ok=True)
        response.raise_for_status()

        remaining = int(response.headers.get("Content-Length", 0))
        total = have + remaining
        if have:
            print(f"    resuming at {have/1e6:.0f} MB of {total/1e6:.0f} MB")

        written = have
        last_report = time.time()
        with part.open("ab") as handle:
            for block in response.iter_content(chunk):
                handle.write(block)
                written += len(block)
                if time.time() - last_report >= 15:
                    pct = f" ({100 * written / total:.0f}%)" if total else ""
                    print(f"    {written/1e6:.0f} MB{pct}")
                    last_report = time.time()

    if total and written < total:
        raise IOError(f"short read: {written} of {total} bytes")
    part.replace(dest)


def fetch_chatterbox() -> int:
    destination = config.MODELS_DIR / "chatterbox"
    destination.mkdir(parents=True, exist_ok=True)
    print(f"engine: chatterbox ({CHATTERBOX_REPO})")
    print(f"target: {destination}\n")

    reuse_from_hf_cache(destination)

    failed = []
    for name in CHATTERBOX_FILES:
        target = destination / name
        if target.is_file() and target.stat().st_size > 0:
            print(f"  {name}: already here ({target.stat().st_size/1e6:.0f} MB)")
            continue
        print(f"  {name}")
        url = f"https://huggingface.co/{CHATTERBOX_REPO}/resolve/main/{name}"
        if with_retries(name, lambda u=url, t=target: download_resumable(u, t) or True) is None:
            failed.append(name)
        else:
            print(f"    ok, {target.stat().st_size/1e6:.0f} MB")

    if failed:
        print(f"\nstill missing: {failed}. Re-run this script — it resumes.")
        return 1
    print(f"\nall Chatterbox weights present in {destination}")
    return 0


def reuse_from_hf_cache(destination: Path) -> None:
    """
    Copy anything an earlier huggingface_hub run already finished.

    Two of these files are over 2 GB combined; re-downloading them because they
    happen to sit in a different directory would be pure waste.
    """
    cache = Path.home() / ".cache" / "huggingface" / "hub"
    snapshots = cache / f"models--{CHATTERBOX_REPO.replace('/', '--')}" / "snapshots"
    if not snapshots.is_dir():
        return
    for name in CHATTERBOX_FILES:
        target = destination / name
        if target.is_file() and target.stat().st_size > 0:
            continue
        for candidate in snapshots.glob(f"*/{name}"):
            if candidate.is_file() and candidate.stat().st_size > 0:
                print(f"  {name}: reusing {candidate.stat().st_size/1e6:.0f} MB from the HF cache")
                shutil.copy2(candidate, target)
                break


def fetch_xtts() -> int:
    from huggingface_hub import snapshot_download
    from TTS.utils.manage import ModelManager

    destination = Path(ModelManager().output_prefix) / XTTS_DIR_NAME
    print(f"engine: xtts ({XTTS_REPO})")
    print(f"target: {destination}\n")

    complete = all(
        (destination / f).is_file() and (destination / f).stat().st_size > 0 for f in XTTS_FILES
    )
    if destination.exists() and not complete:
        # A half-finished directory is worse than none: coqui-tts sees the
        # folder, assumes the model is present, and fails at load time instead.
        print("removing incomplete previous download")
        shutil.rmtree(destination, ignore_errors=True)
    elif complete:
        print("model already present, nothing to do")
        return 0

    destination.mkdir(parents=True, exist_ok=True)
    result = with_retries(
        "xtts weights",
        lambda: snapshot_download(
            repo_id=XTTS_REPO,
            local_dir=str(destination),
            allow_patterns=XTTS_FILES,
            max_workers=4,
        ),
    )
    if result is None:
        return 1

    # coqui-tts writes this after its interactive licence prompt; creating it
    # here keeps the loader from asking about the Coqui Public Model License.
    (destination / "tos_agreed.txt").write_text(
        "I have read, understood and agreed to the Terms and Conditions.",
        encoding="utf-8",
    )
    print("\nall XTTS weights present")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--engine",
        choices=["chatterbox", "xtts"],
        default=config.ENGINE,
        help="which engine's weights to fetch (default: the configured one)",
    )
    args = parser.parse_args()
    return fetch_chatterbox() if args.engine == "chatterbox" else fetch_xtts()


if __name__ == "__main__":
    raise SystemExit(main())
