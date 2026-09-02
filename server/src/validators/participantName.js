function isValidParticipantName(name) {
  if (typeof name !== 'string') {
    return false;
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    return false;
  }

  if (trimmedName.length > 100) {
    return false;
  }

  return true;
}

module.exports = {
  isValidParticipantName
};