"""Exercise queue progress without downloading models or publishing fixture captions."""
import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("captions", "scripts/auto-subtitles.py")
captions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(captions)


class QueueTests(unittest.TestCase):
    def test_blocked_video_does_not_hold_up_following_jobs(self):
        jobs = [{"id": "blocked", "lease": "lease-1"}, {"id": "next", "lease": "lease-2"}]
        finished = []
        whisper = types.SimpleNamespace(WhisperModel=lambda *_args, **_kwargs: object())
        torch = types.SimpleNamespace(set_num_threads=lambda _number: None)
        with tempfile.TemporaryDirectory() as directory:
            job_file = Path(directory) / "job.json"
            job_file.write_text(json.dumps(jobs[0]))

            def process(job, _model):
                if job["id"] == "blocked":
                    raise captions.MediaAccessBlocked("R2_DOWNLOAD_BLOCKED")
                return "WEBVTT\n\n00:00.000 --> 00:01.000\nMerhaba.\n", "en", 2

            def api(action, **values):
                if action == "caption-jobs":
                    return {"job": jobs[1] if len(finished) == 1 else None}
                self.assertEqual(action, "caption-complete")
                finished.append(values)
                return {"status": values["outcome"]}

            with patch.dict(sys.modules, {"faster_whisper": whisper, "torch": torch}), patch.object(captions, "JOB_FILE", job_file), patch.object(captions, "process", process), patch.object(captions, "api", api):
                with self.assertRaisesRegex(RuntimeError, "1 caption job"):
                    captions.run()
                self.assertIsNone(json.loads(job_file.read_text()))
        self.assertEqual([(item["id"], item["lease"], item["outcome"]) for item in finished], [("blocked", "lease-1", "failed"), ("next", "lease-2", "completed")])
        self.assertEqual(finished[0]["cause"], "R2_DOWNLOAD_BLOCKED")
        self.assertIn("Merhaba", finished[1]["vtt"])


if __name__ == "__main__":
    unittest.main()
