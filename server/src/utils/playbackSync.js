function calculateEffectivePosition({
  position,
  isPlaying,
  updatedAt,
  serverTime,
}) {
  const numericPosition = Number(position);

  // A paused session should always use its persisted position.
  if (!isPlaying) {
    return numericPosition;
  }

  const updatedTime = new Date(updatedAt).getTime();
  const currentTime = new Date(serverTime).getTime();

  const elapsedSeconds = (currentTime - updatedTime) / 1000;

  // Invalid timestamps should fall back to the persisted position.
  if (!Number.isFinite(elapsedSeconds)) {
    return numericPosition;
  }

  // Protect against clock skew between servers.
  const safeElapsed = Math.max(0, elapsedSeconds);

  return numericPosition + safeElapsed;
}

module.exports = {
  calculateEffectivePosition,
};