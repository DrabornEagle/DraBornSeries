/** Only this app's progressive R2 media uses the Android Chromium engine. */
export function isBrowserR2Source(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      url.hostname === "drabornseries.draborneagle.workers.dev" &&
      url.port === "" && url.pathname.startsWith("/media/") && /\.(mp4|m4v|webm)$/i.test(url.pathname);
  } catch { return false; }
}

// JSON is data, never executable text. Also escape HTML's script end delimiter.
export const scriptData = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
export type BrowserVideoOptions = { id: string; url: string; time: number; muted: boolean; loop: boolean; playing: boolean; fit: "contain" | "cover" };
export function browserVideoDocument(options: BrowserVideoOptions) {
  if (!isBrowserR2Source(options.url)) throw Error("INVALID_R2_MEDIA");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src https://drabornseries.draborneagle.workers.dev; script-src 'nonce-dbs-video'; style-src 'unsafe-inline'"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#05020a}video{width:100%;height:100%;object-fit:${options.fit}}</style></head><body><video id="video" playsinline preload="auto" disablepictureinpicture></video><script nonce="dbs-video">
(() => {
  const config = ${scriptData(options)}, video = document.getElementById('video');
  let wanted = config.playing, seek = config.time, framed = false;
  const send = (type, data = {}) => window.ReactNativeWebView.postMessage(JSON.stringify({id:config.id,type,...data}));
  const report = () => send('time', {time:video.currentTime});
  const play = () => { if (wanted) video.play().catch(error => { if (error.name !== 'AbortError') send('error',{code:error.name === 'NotAllowedError' ? 'AUTOPLAY' : 'NETWORK'}); }); };
  const position = () => { if (Number.isFinite(video.duration) && video.duration > 0) { video.currentTime = Math.min(Math.max(0,seek), Math.max(0,video.duration - .05)); } };
  video.muted = config.muted; video.loop = config.loop;
  video.addEventListener('loadedmetadata', () => { position(); send('metadata',{duration:video.duration,width:video.videoWidth,height:video.videoHeight}); });
  video.addEventListener('canplay', () => { send('status',{status:'readyToPlay'}); play(); });
  video.addEventListener('playing', () => { send('status',{status:'readyToPlay'}); send('playing',{playing:true}); });
  video.addEventListener('pause', () => { report(); send('playing',{playing:false}); });
  video.addEventListener('waiting', () => send('status',{status:'loading'}));
  video.addEventListener('timeupdate', report);
  video.addEventListener('seeked', report);
  video.addEventListener('ended', () => { wanted = false; report(); send('ended'); });
  video.addEventListener('loadeddata', () => { if (!framed) { framed = true; send('frame'); } });
  video.addEventListener('error', () => send('error',{code:({1:'ABORTED',2:'NETWORK',3:'DECODE',4:'FORMAT'})[video.error?.code] || 'UNKNOWN'}));
  window.dbsVideoCommand = (command) => {
    switch(command.type) {
      case 'play': wanted = true; play(); break;
      case 'pause': wanted = false; video.pause(); break;
      case 'seek': seek = command.time; if(video.readyState > 0) position(); break;
      case 'mute': video.muted = command.muted; break;
      case 'fit': video.style.objectFit = command.fit; break;
      case 'loop': video.loop = command.loop; break;
      case 'load':
        wanted = false; framed = false; seek = 0; video.pause(); video.src = command.url; video.load(); break;
    }
  };
  video.src = config.url; video.load(); send('attached'); play();
})();true;</script></body></html>`;
}
