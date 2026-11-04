import {useState,useEffect,useRef,useMemo,useContext} from 'react';
import {EllipsisVertical,BookOpen,Bell,BellOff,Vibrate,VibrateOff,Timer,Languages,LogOut,Layers,Undo2,ArrowDownToLine,CirclePlus,Check,Crown,Bot,WifiOff,ArrowDown01,Palette,Trophy,Plus} from 'lucide-react';
import {T,analyze,key} from './game.js';
import {LangCtx,useT,tr} from './i18n.js';
import {getPrefs,setPref,canVibrate,unlockAudio,chime,buzz,notifyTurn,warn,tick,timeUp} from './notify.js';
import {Tile,Avatar,Modal} from './ui.jsx';

const CMP={num:(x,y)=>x.n-y.n||x.c-y.c,col:(x,y)=>x.c-y.c||x.n-y.n};
const orderRack=(r,m)=>m?[...r].sort((a,b)=>{const x=T(a),y=T(b);return (x.j?1:0)-(y.j?1:0)||CMP[m](x,y)}):r; // jokers last
const loadSort=()=>{try{return localStorage.rmkSort||null}catch(e){return null}};

export default function Game({s,net,toast,openRules,onLeave}){
  const t=useT(),{lang,setLang}=useContext(LangCtx),me=s.me,my=s.phase==='play'&&s.turn===me;
  const [d,setD]=useState(()=>({b:s.board,r:orderRack(s.rack,loadSort())})),[sel,setSel]=useState([]),[menu,setMenu]=useState(false),[sm,setSm]=useState(loadSort);
  const [pf,setPf]=useState(getPrefs),[now,setNow]=useState(Date.now()),seatsRef=useRef(null);
  const dirty=useRef(false);dirty.current=d.r.length!==s.rack.length;
  useEffect(()=>{setD({b:s.board,r:orderRack(s.rack,sm)});setSel([])},[s.seq,s.phase]); // new turn / draw: keep the chosen sort

  // ---- turn timer: host sends the time left; we count down locally from the moment each state arrives ----
  const dl=useMemo(()=>s.tl==null?null:Date.now()+s.tl,[s]);
  const timed=dl!=null;
  useEffect(()=>{if(!timed)return;const iv=setInterval(()=>setNow(Date.now()),200);return()=>clearInterval(iv)},[timed]);
  const ms=timed?Math.max(0,dl-now):null,secs=timed?Math.ceil(ms/1000):null;
  const hot=timed&&secs<=10,cls=!timed?'':secs>20?'ok':secs>10?'amber':'red';
  const ev=useRef({seq:-1,warn:0,sent:0});
  useEffect(()=>{
    if(!timed)return;
    if(ev.current.seq!==s.seq)ev.current={seq:s.seq,warn:0,sent:0};
    const e=ev.current;
    if(my&&secs>0&&secs<=10&&!e.warn){e.warn=1;warn()}
    if(my&&secs>0&&secs<=3)tick();
    if(my&&secs===0&&!e.sent){e.sent=1;net.send({t:'timeout',dirty:dirty.current})}
  },[secs,s.seq]);

  useEffect(()=>{ // on narrow screens keep the player whose turn it is visible in the seat row
    const el=seatsRef.current&&seatsRef.current.querySelector('.seat.act');
    el&&el.scrollIntoView&&el.scrollIntoView({inline:'nearest',block:'nearest',behavior:'smooth'});
  },[s.turn,s.phase]);

  // ---- alerts ----
  useEffect(()=>{if(my)notifyTurn()},[s.seq]);
  useEffect(()=>{
    const l=s.log;
    if(l&&l.k==='l.timeout'&&s.players[me]&&l.p.id===s.players[me].id){toast({k:'n.timeUp',p:{n:l.p.n}},'warn');timeUp()}
  },[s.seq]);
  useEffect(()=>{ // tab title when the tab is in the background
    const base='Rummikub Online',upd=()=>{document.title=my&&document.hidden
      ?(timed&&secs<=20?`⏱ ${secs}s · ${t('turnMine')}`:`● ${t('turnMine')} – ${base}`):base};
    upd();document.addEventListener('visibilitychange',upd);
    return()=>{document.removeEventListener('visibilitychange',upd);document.title=base};
  },[my,s.seq,secs]);
  useEffect(()=>{
    if(!menu)return;const h=e=>{if(!e.target.closest('.menuwrap'))setMenu(false)},k=e=>e.key==='Escape'&&setMenu(false);
    document.addEventListener('pointerdown',h);document.addEventListener('keydown',k);
    return()=>{document.removeEventListener('pointerdown',h);document.removeEventListener('keydown',k)};
  },[menu]);
  const flip=k=>{const v=!pf[k];setPref(k,v);setPf(getPrefs());if(v){if(k==='sound'){unlockAudio();chime()}else if(k==='vibe')buzz()}};

  // ---- table editing (tap to select, then tap a target) ----
  const norm=b=>b.filter(x=>x.length).map(x=>analyze(x).order);
  const strip=b=>b.map(x=>x.filter(i=>!sel.includes(i)));
  const toggle=id=>my&&setSel(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  const fromRack=r=>r.filter(i=>!sel.includes(i));
  const newSet=()=>{setD({b:norm([...strip(d.b),sel]),r:fromRack(d.r)});setSel([])};
  const addTo=k=>{const b=strip(d.b);b[k]=[...b[k],...sel];setD({b:norm(b),r:fromRack(d.r)});setSel([])};
  const back=()=>{const bk=sel.filter(i=>s.rack.includes(i)&&!d.r.includes(i));
    setD({b:norm(d.b.map(x=>x.filter(i=>!bk.includes(i)))),r:orderRack([...d.r,...bk],sm)});setSel([])};
  const reset=()=>{setD({b:s.board,r:orderRack(s.rack,sm)});setSel([])};
  const setSort=m=>{const v=sm===m?null:m;setSm(v); // tap the active option again to go back to manual order
    try{v?localStorage.rmkSort=v:localStorage.removeItem('rmkSort')}catch(e){}
    setD(x=>({...x,r:orderRack(x.r,v)}))};

  const info=d.b.map(analyze),oldK=new Set(s.board.map(key));
  const pts=d.b.reduce((a,x,j)=>a+(oldK.has(key(x))?0:info[j].val),0);
  const allOk=info.every(x=>x.ok),cur=s.players[s.turn],showAdd=my&&sel.length>0;
  const melded=s.players[me]&&s.players[me].melded;
  const ranked=s.result?[...s.players].sort((a,b)=>s.result.delta[b.id]-s.result.delta[a.id]):[];

  return <div className="game">
    <header className="top">
      <div className="seats" ref={seatsRef}>{s.players.map((p,i)=><div key={p.id} className={'seat'+(i===s.turn&&s.phase==='play'?' act':'')+(p.on===false?' off':'')}>
        <Avatar name={p.name} i={i} badge={p.n}/>
        <div className="si"><b>{p.name}{i===me&&<em> {t('you')}</em>}</b><small aria-label={t('ptsWins',{pts:s.scores[p.id],w:s.wins[p.id]})}>{s.scores[p.id]} pts · <Trophy size={11}/>{s.wins[p.id]}</small></div>
        {p.bot&&<Bot size={14} aria-label={t('bot')}/>}{p.on===false&&<WifiOff size={14} aria-label={t('off')}/>}{p.melded&&<Check size={14}/>}</div>)}</div>
      <span className="pill" title={t('pool',{n:s.pool})} aria-label={t('pool',{n:s.pool})}><Layers size={16}/>{s.pool}</span>
      <div className="menuwrap">
        <button className="icon" aria-label={t('menu')} aria-expanded={menu} onClick={()=>setMenu(v=>!v)}><EllipsisVertical size={20}/></button>
        {menu&&<div className="menu" role="menu">
          <button role="menuitem" onClick={()=>{setMenu(false);openRules()}}><BookOpen size={18}/>{t('rules')}</button>
          <button role="menuitem" onClick={()=>flip('sound')}>{pf.sound?<Bell size={18}/>:<BellOff size={18}/>}{t('snd')}<span className="sw">{pf.sound?'ON':'OFF'}</span></button>
          {canVibrate()&&<button role="menuitem" onClick={()=>flip('vibe')}>{pf.vibe?<Vibrate size={18}/>:<VibrateOff size={18}/>}{t('vib')}<span className="sw">{pf.vibe?'ON':'OFF'}</span></button>}
          {s.opts.timer&&<button role="menuitem" onClick={()=>flip('ticks')}><Timer size={18}/>{t('ticks')}<span className="sw">{pf.ticks?'ON':'OFF'}</span></button>}
          <button role="menuitem" onClick={()=>setLang(lang==='en'?'es':'en')}><Languages size={18}/>{t('lang')}<span className="sw">{lang==='en'?'EN':'ES'}</span></button>
          <hr/>
          <button role="menuitem" onClick={()=>{setMenu(false);onLeave()}}><LogOut size={18}/>{t('leave')}</button></div>}
      </div>
    </header>
    {timed&&<div className={'tbar '+cls+(hot?' hot':'')} role="progressbar" aria-valuemin={0} aria-valuemax={60} aria-valuenow={secs} aria-label="Timer">
      <i style={{width:(ms/600)+'%'}}/>{hot&&<b className={'tnum'+(my?' mine':'')} aria-hidden="true">{secs}</b>}</div>}
    <div className="sr" aria-live="assertive">{my&&secs===10?t('tenLeft'):''}</div>
    <div className="boardwrap">
      <main className="board">
        {d.b.map((_,k)=><div key={k} className={'set'+(info[k].ok?'':' bad')}>
          {info[k].order.map((id,j)=><Tile key={id} id={id} sel={sel.includes(id)} num={info[k].nums&&info[k].nums[j]} onClick={()=>toggle(id)}/>)}
          {showAdd&&<button className="plus badge" aria-label={t('addSet')} title={t('addSet')} onClick={()=>addTo(k)}><Plus size={18}/></button>}
        </div>)}
        {!d.b.length&&<p className="sub">{t('empty')}</p>}
      </main>
      {showAdd&&<button className="plus float" onClick={newSet}><Plus size={18}/>{t('newSet')}</button>}
    </div>
    <div className="bar">
      <div className="status"><b>{my?(melded?t('turnMine'):t('turnMeld',{pts})):t('turnOf',{name:cur.name})}</b>
        {my&&!melded&&<span className="meld" aria-hidden="true"><i style={{width:Math.min(100,pts/30*100)+'%'}}/></span>}
        <span className="log">{tr(t,s.log)}</span></div>
      {my&&<>
        <button disabled={!sel.length} onClick={back}><ArrowDownToLine size={18}/><span className="lbl">{t('toRack')}</span></button>
        <button onClick={reset}><Undo2 size={18}/><span className="lbl">{t('undo')}</span></button>
        <button onClick={()=>net.send({t:'draw'})}><CirclePlus size={18}/><span className="lbl">{s.pool?t('draw'):t('pass')}</span></button>
        <button className={'primary'+(hot?' pulse':'')} disabled={!allOk||d.r.length===s.rack.length} onClick={()=>net.send({t:'end',board:d.b,rack:d.r})}>
          <Check size={18}/>{t('end')}</button></>}
      {!my&&me===0&&s.phase==='play'&&cur.on===false&&<button onClick={()=>net.send({t:'skip'})}>{t('skip')}</button>}

    </div>
    <div className="rackwrap">
      <div className="rackbar"><span className="rcount">{t('rack')} · {d.r.length}</span>
        <div className="seg">
        <button aria-label={t('sort123')} title={t('sort123')} aria-pressed={sm==='num'} onClick={()=>setSort('num')}><ArrowDown01 size={18}/></button>
        <button aria-label={t('sortCol')} title={t('sortCol')} aria-pressed={sm==='col'} onClick={()=>setSort('col')}><Palette size={18}/></button></div></div>
      <div className="rack">{d.r.map(id=><Tile key={id} id={id} sel={sel.includes(id)} onClick={()=>toggle(id)}/>)}</div>
    </div>
    {s.phase==='over'&&<Modal title={t(s.result.blocked?'winsPool':'wins',{name:s.players[s.result.winner].name})}>
      <div className="center"><Trophy size={40} className="gold"/>
      <h2>{t(s.result.blocked?'winsPool':'wins',{name:s.players[s.result.winner].name})}</h2>
      <ul className="res">{ranked.map(p=>{const v=s.result.delta[p.id];return <li key={p.id}><b>{p.name}</b>
        <span className={v>0?'pos':'neg'}>{v>0?'+':''}{v}</span><small>{t('total')} {s.scores[p.id]}</small></li>})}</ul>
      {me===0?<button className="primary" data-autofocus onClick={()=>net.send({t:'start'})}>{t('next')}</button>:<p>{t('waitNext')}</p>}
      <button className="link" onClick={onLeave}><LogOut size={16}/>{t('leave')}</button></div></Modal>}
  </div>;
}
