import type { IVideoProvider, SourceDescriptor } from './types';
import { YouTubeProvider } from './providers/youtubeProvider';
import { Html5Provider } from './providers/html5Provider';
import { VkProvider } from './providers/vkProvider';
import { RutubeProvider } from './providers/rutubeProvider';

export function createProvider(source: SourceDescriptor): IVideoProvider {
  switch (source.kind) {
    case 'youtube':
      return new YouTubeProvider();
    case 'html5':
      return new Html5Provider();
    case 'vk':
      return new VkProvider();
    case 'rutube':
      return new RutubeProvider();
  }
}
