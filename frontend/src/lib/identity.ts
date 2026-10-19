const CLIENT_ID_KEY = 'toriihub.clientId';
const NICKNAME_KEY = 'toriihub.nickname';

export function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) ?? '';
}

export function setNickname(name: string): void {
  localStorage.setItem(NICKNAME_KEY, name);
}
