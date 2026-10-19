let ytApiPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    window.onYouTubeIframeAPIReady = () => resolve();
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.head.appendChild(tag);
  });

  return ytApiPromise;
}
