function isValidSessionName(name) {
  if (typeof name !== 'string') {
    return false;
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 3) {
    return false;
  }

  if (trimmedName.length > 200) {
    return false;
  }

  return true;
}

module.exports = {
  isValidSessionName
};