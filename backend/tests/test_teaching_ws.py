"""End-to-end WebSocket teaching-loop test (Architecture Document §5.1, §7.2).

Drives the real app: create -> start -> teach one turn over WebSocket, using the
deterministic fallback Learner (no API key needed) so CI never hits the network.
This is the M1 deliverable in miniature: "one full teaching turn runs."
"""

import app.orchestrator as orchestrator
from fastapi.testclient import TestClient

from app.main import app


def _use_fallback_orchestrator():
    # Force the LLM-free orchestrator so the turn is deterministic and offline.
    orchestrator._orchestrator = orchestrator.build_orchestrator(use_config=False)


def test_one_full_teaching_turn_over_ws():
    _use_fallback_orchestrator()
    client = TestClient(app)

    topics = client.get("/api/topics").json()
    sid = client.post(
        "/api/sessions", json={"topicId": topics[0]["topicId"]}
    ).json()["sessionId"]
    assert client.post(f"/api/sessions/{sid}/start").json()["status"] == "TEACHING"

    with client.websocket_connect(f"/ws/sessions/{sid}") as ws:
        assert ws.receive_json() == {"type": "state_update", "status": "TEACHING"}

        ws.send_json(
            {
                "type": "teaching_input",
                "image": "",
                "typedText": "Plants take in carbon dioxide and water and make glucose.",
            }
        )

        vision = ws.receive_json()
        assert vision["type"] == "vision_result"
        assert "carbon dioxide" in vision["interpretation"]["transcribedText"]

        learner = ws.receive_json()
        assert learner["type"] == "learner_message"
        assert learner["response"]["type"] in {
            "question",
            "confusion",
            "acknowledgment",
            "paraphrase",
        }
        assert learner["response"]["text"].strip()

    # The turn was recorded on the session.
    assert client.get(f"/api/sessions/{sid}").json()["turnCount"] == 1


def test_teaching_input_rejected_before_start():
    _use_fallback_orchestrator()
    client = TestClient(app)

    topics = client.get("/api/topics").json()
    sid = client.post(
        "/api/sessions", json={"topicId": topics[0]["topicId"]}
    ).json()["sessionId"]

    # Session is in SETUP, not TEACHING -> teaching_input is rejected.
    with client.websocket_connect(f"/ws/sessions/{sid}") as ws:
        assert ws.receive_json()["status"] == "SETUP"
        ws.send_json({"type": "teaching_input", "image": "", "typedText": "hi"})
        reply = ws.receive_json()
        assert reply["type"] == "error"
        assert "TEACHING" in reply["message"]
