export function calculateEffectivePosition({
  position,
  isPlaying,
  updatedAt,
  serverTime,
}) {
  const numericPosition = Number(position);

  if (!isPlaying) {
    return numericPosition;
  }

  const updatedTime = new Date(updatedAt).getTime();
  const currentTime = new Date(serverTime).getTime();

  const elapsedSeconds =
    (currentTime - updatedTime) / 1000;

  if (!Number.isFinite(elapsedSeconds)) {
    return numericPosition;
  }

  const safeElapsed = Math.max(0, elapsedSeconds);

  return numericPosition + safeElapsed;
}