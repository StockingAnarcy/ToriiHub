import { useState } from 'react';
import { parseSource } from './parseSource';
import type { SourceDescriptor } from './types';

interface Props {
  onLoad: (source: SourceDescriptor) => void;
  current: SourceDescriptor | null;
}

export function SourceInput({ onLoad, current }: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = parseSource(url);
    if (!parsed) {
      setError(
        'Не распознал ссылку. YouTube — любой формат; VK — только embed (video_ext.php); Rutube — страница видео или embed; медиа — прямой URL .mp4/.mp3.',
      );
      return;
    }
    setError(null);
    onLoad(parsed);
    setUrl('');
  };

  return (
    <div className="source-input">
      <div className="source-input__row">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="https://youtube.com/watch?v=…  |  vkvideo.ru/video_ext.php?…  |  rutube.ru/video/…"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          inputMode="url"
        />
        <button onClick={submit} disabled={!url.trim()}>
          Загрузить
        </button>
      </div>
      {error && <div className="source-input__error">{error}</div>}
      {current && (
        <div className="source-input__current">
          Сейчас: <code>{describeSource(current)}</code>
        </div>
      )}
    </div>
  );
}

function describeSource(s: SourceDescriptor): string {
  switch (s.kind) {
    case 'youtube':
      return `YouTube · ${s.videoId}`;
    case 'html5':
      return `${s.mediaType === 'audio' ? 'Аудио' : 'Видео'} · ${new URL(s.url).pathname.split('/').pop()}`;
    case 'vk':
      return 'VK Video';
    case 'rutube':
      return 'Rutube';
  }
}
