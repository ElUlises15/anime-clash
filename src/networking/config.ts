import type { PeerOptions } from 'peerjs';
export function getPeerOptions(): PeerOptions {
  const env = import.meta.env;
  const iceServers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  const urls = env.VITE_TURN_URL?.split(',').map(s => s.trim()).filter(Boolean);
  if (urls?.length) iceServers.push({ urls, username: env.VITE_TURN_USER, credential: env.VITE_TURN_PASS });
  const port = Number(env.VITE_PEER_PORT || 443);
  return { host: env.VITE_PEER_HOST || '0.peerjs.com', port: Number.isFinite(port) && port > 0 ? port : 443,
    path: env.VITE_PEER_PATH || '/', secure: (env.VITE_PEER_SECURE || 'true') === 'true',
    key: env.VITE_PEER_KEY || 'peerjs', debug: 1, config: { iceServers } };
}
