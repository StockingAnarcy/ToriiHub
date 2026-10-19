import type { SourceDescriptor } from './types';

const MEDIA_EXT = /\.(mp4|webm|ogg|oga|mp3|m4a|wav|flac|opus)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|m4a|wav|flac|ogg|oga|opus)(\?|#|$)/i;

export function parseSource(rawUrl: string): SourceDescriptor | null {
  const url = rawUrl.trim();
  if (!url) return null;

  const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  let parsed: URL;
  try {
    parsed = new URL(withProto);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '');

  // YouTube
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0];
    return id ? { kind: 'youtube', videoId: id } : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id =
      parsed.searchParams.get('v') ??
      parsed.pathname.match(/^\/(?:embed|shorts|v)\/([^/?#]+)/)?.[1];
    return id ? { kind: 'youtube', videoId: id } : null;
  }

  // VK Video — требуем embed (video_ext.php), иначе iframe без js_api
  if (host === 'vk.com' || host === 'vkvideo.ru' || host.endsWith('.vk.com')) {
    // Уже embed
    if (parsed.pathname.includes('/video_ext.php')) {
      return { kind: 'vk', embedUrl: withProto };
    }

    // Страница видео: vkvideo.ru/video-XXXX_YYYY или vk.com/video-XXXX_YYYY
    // oid может быть отрицательным (сообщества) — учитываем в регулярке
    const m = parsed.pathname.match(/^\/video(-?\d+)_(\d+)\/?$/);
    if (m) {
      const [, oid, id] = m;
      return {
        kind: 'vk',
        embedUrl: `https://vkvideo.ru/video_ext.php?oid=${oid}&id=${id}&js_api=1`,
      };
    }

    return null;
  }

  // Rutube — автоконвертация /video/<id>/ → /play/embed/<id>
  if (host === 'rutube.ru' || host.endsWith('.rutube.ru')) {
    const videoMatch = parsed.pathname.match(/^\/video\/([a-f0-9]{32})\/?$/i);
    if (videoMatch) {
      return {
        kind: 'rutube',
        embedUrl: `https://rutube.ru/play/embed/${videoMatch[1]}`,
      };
    }
    return { kind: 'rutube', embedUrl: withProto };
  }

  // Прямой медиафайл
  if (MEDIA_EXT.test(parsed.pathname)) {
    const mediaType = AUDIO_EXT.test(parsed.pathname) ? 'audio' : 'video';
    return { kind: 'html5', url: withProto, mediaType };
  }

  return null;
}
