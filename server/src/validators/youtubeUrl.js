function isValidYoutubeUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    return false;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (hostname === 'youtu.be') {
    return parsedUrl.pathname.length > 1;
  }

  const allowedHosts = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com'
  ];

  if (!allowedHosts.includes(hostname)) {
    return false;
  }

  if (parsedUrl.pathname !== '/watch') {
    return false;
  }

  const videoId = parsedUrl.searchParams.get('v');

  return Boolean(videoId);
}

module.exports = {
  isValidYoutubeUrl
};
