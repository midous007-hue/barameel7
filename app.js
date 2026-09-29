/* BARAMEEL WORLD — MASTER BUILD V19
   Presentation/scanner client. Production source of truth remains the backend.
   ONE printed gameplay QR: BARAMEEL-UNIVERSAL.
*/
(() => {
  const VERSION='20260929-19';
  const STORAGE='barameel.world.player.v17';
  const LEGACY_STORAGES=['barameel.world.player.v16','barameel.world.player.v15'];
  const API_BASE=String(window.BARAMEEL_API_BASE||'').replace(/\/$/,'');
  const RUNNERS=['rookie','skater','brona','racer','chiller','dreamer'];
  const RUNNER_NAMES={rookie:'THE ROOKIE',skater:'THE SKATER',brona:'BRONA',racer:'THE RACER',chiller:'THE CHILLER',dreamer:'THE DREAMER'};
  const DEFAULTS={playerId:null,playerCode:null,nickname:'',runner:'brona',points:0,weeklyPoints:0,rank:null,playerCount:0,checkpoints:[],collected:{collection01:{}},totalScans:0,lastReward:null,lastSeen:null};
  let state=loadState();
  if(!state.playerId){state.playerId=(crypto.randomUUID?crypto.randomUUID():`p-${Date.now()}-${Math.random().toString(36).slice(2)}`);saveState();}
  function loadState(){try{const cur=JSON.parse(localStorage.getItem(STORAGE)||'null');if(cur)return {...DEFAULTS,...cur};for(const key of LEGACY_STORAGES){const old=JSON.parse(localStorage.getItem(key)||'null');if(old){const m={...DEFAULTS,...old};localStorage.setItem(STORAGE,JSON.stringify(m));return m;}}}catch{}return {...DEFAULTS};}
  function saveState(){state.lastSeen=Date.now();localStorage.setItem(STORAGE,JSON.stringify(state));}
  function patchState(p){state={...state,...p};saveState();return state;}
  function setNickname(v){patchState({nickname:String(v||'').trim().slice(0,24)});}
  function setRunner(v){if(RUNNERS.includes(v))patchState({runner:v});}
  function selected(){return state.runner||'brona';}
  function pieces(c='collection01',i='image01'){return(state.collected?.[c]?.[i]||[]).map(Number).sort((a,b)=>a-b);}
  function hasPiece(c,i,p){return pieces(c,i).includes(Number(p));}
  function count(c,i){return pieces(c,i).length;}
  function mergePlayer(p){if(!p)return state;state={...state,...p};if(p.collected)state.collected=p.collected;saveState();return state;}

  // APPROVED CLASSIC ARCADE AUDIO BANK — use the original V9–V12 files only.
  const SOUND_FILES={tap:'./audio/tap.wav',select:'./audio/select.wav',confirm:'./audio/confirm.wav',back:'./audio/back.wav',scan:'./audio/scan.wav',error:'./audio/error.wav',completion:'./audio/completion-arcade.wav',levelup:'./audio/reward-levelup.mp3'};
  const soundBank={};let soundUnlocked=false,soundPrimed=false;
  function primeSounds(){if(soundPrimed)return;soundPrimed=true;Object.entries(SOUND_FILES).forEach(([name,src])=>{const a=new Audio(src);a.preload='auto';a.playsInline=true;a.setAttribute('playsinline','');a.volume=.76;soundBank[name]=a;try{a.load()}catch{}});}
  function unlockAudio(){primeSounds();soundUnlocked=true;}
  function ensureGestureAudio(){if(!soundUnlocked)unlockAudio();}
  function play(type,rate=1){primeSounds();ensureGestureAudio();const a=soundBank[type];if(!a)return null;try{a.pause();a.currentTime=0;a.playbackRate=rate;a.volume=type==='completion'?.9:type==='levelup'?.82:type==='scan'?.78:.72;const pr=a.play();if(pr?.catch)pr.catch(()=>{});return a}catch{return null}}
  function playSelect(runner=selected()){
    // Character-specific variation is the approved select.wav arcade sample, pitch-shifted — no generated oscillator tones.
    const rates={rookie:.88,skater:.94,brona:1.00,racer:1.06,chiller:1.12,dreamer:1.18};
    return play('select',rates[runner]||1);
  }
  function playCompletionSound(){return play('completion')}
  function playRewardJingle(){return play('levelup')||play('confirm')}
  function playPointsCountUp(amount,duration=2200){
    // Sparse, quiet arcade ticks; finish with the approved reward asset.
    const start=performance.now(),step=Math.max(260,duration/7);let next=0;
    function tick(now){if(now-start<duration){if(now>=next){play('tap');next=now+step}requestAnimationFrame(tick)}else play('levelup');}
    requestAnimationFrame(tick);
  }
  primeSounds();
  ['pointerdown','touchstart','mousedown','keydown'].forEach(e=>window.addEventListener(e,unlockAudio,{capture:true,passive:true}));

  function go(url){location.href=url;}
  function goAfter(url,sound='tap',delay=180){if(sound)play(sound);setTimeout(()=>go(url),delay);}
  function idle(fn){if('requestIdleCallback'in window)requestIdleCallback(fn,{timeout:900});else setTimeout(fn,80);}
  function preload(src){const i=new Image();i.decoding='async';i.src=src;return i;}
  function preloadAll(xs){xs.forEach(preload);}
  function flash(target=document.body){let el=target.querySelector?.('.barameel-flash');if(!el){el=document.createElement('div');el.className='barameel-flash';target.appendChild(el)}el.classList.remove('on');void el.offsetWidth;el.classList.add('on');}

  async function api(path,body,method='POST'){if(!API_BASE)return{ok:false,code:'BACKEND_NOT_CONFIGURED',error:'BACKEND_NOT_CONFIGURED'};try{const r=await fetch(API_BASE+path,{method,headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined,credentials:'include',cache:'no-store'});const data=await r.json().catch(()=>({}));if(!r.ok)return{ok:false,...data,error:data.error||`HTTP_${r.status}`};return data}catch{return{ok:false,code:'NETWORK_ERROR',error:'NETWORK_ERROR'}}}
  async function track(event,meta={}){return api('/analytics',{player_id:state.playerId,event,meta,path:location.pathname,ts:Date.now()});}
  async function syncPlayer(){const r=await api('/player',{player_id:state.playerId,nickname:state.nickname,runner:state.runner});if(r?.player)mergePlayer(r.player);return r;}
  async function scanUniversal({ticketId=null}={}){const r=await api('/scan',{player_id:state.playerId,qr_token:'BARAMEEL-UNIVERSAL',ticket_id:ticketId,idempotency_key:'scan-'+(crypto.randomUUID?crypto.randomUUID():Date.now())});if(r?.player)mergePlayer(r.player);const rw=r?.reward;if(r?.ok&&rw){const c=rw.collection_id||rw.collection,i=rw.image_id||rw.image,piece=Number(rw.piece_number||rw.piece);if(c&&i&&piece>=1&&piece<=9&&!rw.duplicate){state.collected ||= {};state.collected[c] ||= {};state.collected[c][i] ||= [];if(!state.collected[c][i].map(Number).includes(piece))state.collected[c][i].push(piece);}if(rw.points!=null)state.points=Number(state.points||0)+Number(rw.points||0);state.totalScans=Number(state.totalScans||0)+1;state.lastReward=rw;saveState();}return r;}
  async function duoLink(otherPlayerCode){const r=await api('/duo-link',{player_id:state.playerId,other_player_code:String(otherPlayerCode||'').trim(),idempotency_key:'duo-'+(crypto.randomUUID?crypto.randomUUID():Date.now())});if(r?.player)mergePlayer(r.player);return r;}
  async function fetchCollection(id='collection01'){const key='barameel.collection.'+id;try{const c=sessionStorage.getItem(key);if(c)return JSON.parse(c)}catch{}const r=await fetch(`./assets/collections/${id}/collection.json`,{cache:'force-cache'});if(!r.ok)throw Error('COLLECTION_UNAVAILABLE');const d=await r.json();try{sessionStorage.setItem(key,JSON.stringify(d))}catch{}return d;}
  function parseUniversalQR(raw){let s=String(raw||'').trim();try{s=decodeURIComponent(s)}catch{}s=s.trim();if(/^BARAMEEL[-_:]?UNIVERSAL$/i.test(s))return{type:'universal',token:'BARAMEEL-UNIVERSAL'};try{const u=new URL(s,location.href);if((u.searchParams.get('qr')||'').toUpperCase()==='BARAMEEL-UNIVERSAL')return{type:'universal',token:'BARAMEEL-UNIVERSAL'}}catch{}if(/(?:^|[?&])qr=BARAMEEL-UNIVERSAL(?:&|$)/i.test(s))return{type:'universal',token:'BARAMEEL-UNIVERSAL'};return null;}
  window.BR={VERSION,RUNNERS,RUNNER_NAMES,get state(){return state},setNickname,setRunner,selected,pieces,hasPiece,count,mergePlayer,play,playSelect,playCompletionSound,playPointsCountUp,playRewardJingle,go,goAfter,idle,preload,preloadAll,flash,api,track,syncPlayer,scanUniversal,duoLink,fetchCollection,parseUniversalQR,saveState,API_BASE};
})();
