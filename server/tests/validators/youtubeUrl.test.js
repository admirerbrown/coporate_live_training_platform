import { describe, it, expect } from 'vitest';

const { isValidYoutubeUrl } = require('../../src/validators/youtubeUrl');

describe('isValidYoutubeUrl', () => {
  it('Y1: accepts a standard YouTube URL', () => {
    expect(
      isValidYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    ).toBe(true);
  });

  it('Y2: accepts a YouTube URL without www', () => {
    expect(
      isValidYoutubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')
    ).toBe(true);
  });

  it('Y3: accepts a YouTube short URL', () => {
    expect(
      isValidYoutubeUrl('https://youtu.be/dQw4w9WgXcQ')
    ).toBe(true);
  });

  it('Y4: accepts a mobile YouTube URL', () => {
    expect(
      isValidYoutubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')
    ).toBe(true);
  });

  it('Y5: rejects a valid URL from the wrong host', () => {
    expect(
      isValidYoutubeUrl('https://vimeo.com/12345')
    ).toBe(false);
  });

  it('Y6: rejects a string that is not a URL', () => {
    expect(
      isValidYoutubeUrl('not a url')
    ).toBe(false);
  });

  it('Y7: rejects a YouTube watch URL without a video ID', () => {
    expect(
      isValidYoutubeUrl('https://www.youtube.com/watch')
    ).toBe(false);
  });

  it('Y8: rejects an empty string', () => {
    expect(
      isValidYoutubeUrl('')
    ).toBe(false);
  });

  it('Y9: rejects null', () => {
    expect(
      isValidYoutubeUrl(null)
    ).toBe(false);
  });

  it('Y10: rejects a YouTube URL with an empty video ID', () => {
    expect(
      isValidYoutubeUrl('https://www.youtube.com/watch?v=')
    ).toBe(false);
  });
});