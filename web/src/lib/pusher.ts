import Pusher from 'pusher';

// Pusher 서버 인스턴스 (싱글톤)
let pusherInstance: Pusher | null = null;

export function getPusher(): Pusher {
  if (!pusherInstance) {
    pusherInstance = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER || 'ap3',
      useTLS: true
    });
  }
  return pusherInstance;
}

// 채널 및 이벤트 이름
export const CHAT_CHANNEL = 'chat';
export const CHAT_EVENT = 'new-message';
