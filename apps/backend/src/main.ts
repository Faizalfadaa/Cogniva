import "dotenv/config";

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { runLearnerTurn } from "./agents/learner/learner.agent";
import { createInitialLearnerState } from "./agents/learner/learner.state";
import { LearnerState } from "./agents/learner/learner.types";

type LearnerTurnRequest = {
  sessionId?: string;
  turnIndex?: number;
  teachingText?: string;
  currentState?: LearnerState;
};

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "POST" && request.url === "/api/learner/turn") {
    await handleLearnerTurn(request, response);
    return;
  }

  sendJson(response, 404, {
    error: "Route tidak ditemukan"
  });
});

server.listen(port, () => {
  console.log(`Cogniva backend listening on http://localhost:${port}`);
  console.log(`Learner API ready at POST http://localhost:${port}/api/learner/turn`);
});

async function handleLearnerTurn(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const body = await readJsonBody<LearnerTurnRequest>(request);
    const teachingText = body.teachingText?.trim();

    if (!teachingText) {
      sendJson(response, 400, {
        error: "teachingText wajib diisi"
      });
      return;
    }

    const sessionId = body.sessionId?.trim() || "ses_api_demo";
    const currentState =
      body.currentState ?? createInitialLearnerState(sessionId);
    const turnIndex =
      body.turnIndex ?? Math.max(currentState.updatedAtTurn + 1, 1);

    const output = await runLearnerTurn({
      sessionId,
      turnIndex,
      teachingText,
      currentState
    });

    sendJson(response, 200, output);
  } catch (error) {
    console.error("[API] Failed to handle learner turn:", error);
    sendJson(response, 500, {
      error: "Gagal menjalankan Learner Agent"
    });
  }
}

function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk;

      if (rawBody.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body terlalu besar"));
      }
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(rawBody || "{}") as T);
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
