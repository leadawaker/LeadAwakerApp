// The state of an ElevenLabs browser test call (useElevenTestCall), as a pure
// reducer so the transitions are tested without React or the SDK.

export type ElevenTestStatus = "idle" | "connecting" | "listening" | "speaking" | "ended" | "error";

export interface ElevenTestLine { role: "user" | "agent"; text: string }

/** voiceTab `test.eleven.error.<key>`. */
export type ElevenTestError = "busy" | "notEleven" | "notSetUp" | "badCaller" | "eleven" | "mic" | "dropped" | "generic";

export interface ElevenTestState {
  status: ElevenTestStatus;
  lines: ElevenTestLine[];
  error: ElevenTestError | null;
}

export type ElevenTestAction =
  | { type: "start" }
  | { type: "connected" }
  | { type: "mode"; mode: "speaking" | "listening" }
  | { type: "message"; role: "user" | "agent"; text: string }
  | { type: "disconnected" }
  | { type: "error"; error: ElevenTestError };

export const initialElevenTestState: ElevenTestState = { status: "idle", lines: [], error: null };

const LIVE: ElevenTestStatus[] = ["connecting", "listening", "speaking"];

export function elevenTestReducer(state: ElevenTestState, action: ElevenTestAction): ElevenTestState {
  switch (action.type) {
    case "start":
      return { status: "connecting", lines: [], error: null };
    case "connected":
      return state.status === "connecting" ? { ...state, status: "listening" } : state;
    case "mode":
      return LIVE.includes(state.status) ? { ...state, status: action.mode } : state;
    case "message": {
      const text = action.text.trim();
      if (!text) return state;
      return { ...state, lines: [...state.lines, { role: action.role, text }] };
    }
    case "disconnected":
      return { ...state, status: "ended" };
    case "error":
      return { ...state, status: "error", error: action.error };
  }
}

/** The engine's status (passed through by /api/voice/eleven-test) as an error key. */
export function errorKeyForStatus(status: number): ElevenTestError {
  switch (status) {
    case 429: return "busy";
    case 403: return "notEleven";
    case 409: return "notSetUp";
    case 422: return "badCaller";
    case 502: return "eleven";
    default: return "generic";
  }
}
