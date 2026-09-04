import {
  calculateEffectivePosition,
} from "../../../shared/playbackSync";

const INITIAL_PLAYBACK_STATE = {
  position: 0,
  isPlaying: false,
  version: -1,
  updatedAt: null,
  serverTime: null,
};

export function createInitialPlaybackState() {
  return {
    ...INITIAL_PLAYBACK_STATE,
  };
}

export function applyPlaybackState(
  currentState,
  message,
) {
  if (!isValidPlaybackStateMessage(message)) {
    return currentState;
  }

  if (message.version <= currentState.version) {
    return currentState;
  }

  const position = calculateEffectivePosition(message);

  return {
    position,
    isPlaying: message.isPlaying,
    version: message.version,
    updatedAt: message.updatedAt,
    serverTime: message.serverTime,
  };
}

function isValidPlaybackStateMessage(message) {
  if (
    message === null ||
    typeof message !== "object" ||
    Array.isArray(message)
  ) {
    return false;
  }

  if (message.type !== "playback:state") {
    return false;
  }

  if (
    typeof message.position !== "number" ||
    !Number.isFinite(message.position)
  ) {
    return false;
  }

  if (typeof message.isPlaying !== "boolean") {
    return false;
  }

  if (
    !Number.isInteger(message.version) ||
    message.version < 0
  ) {
    return false;
  }

  if (
    typeof message.updatedAt !== "string" ||
    typeof message.serverTime !== "string"
  ) {
    return false;
  }

  return true;
}