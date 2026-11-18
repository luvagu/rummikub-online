import { useState, useEffect, useEffectEvent, useRef, useMemo, useContext } from "react";
import {
  EllipsisVertical,
  BookOpen,
  Bell,
  BellOff,
  Vibrate,
  VibrateOff,
  Timer,
  Languages,
  Grid3x3,
  LogOut,
  Layers,
  Undo2,
  ArrowDownToLine,
  CopyPlus,
  Check,
  Crown,
  Bot,
  WifiOff,
  ArrowDown01,
  Palette,
  Trophy,
  Plus,
  Smile,
  SmilePlus,
  Flag,
} from "lucide-react";
import { T, analyze, key } from "./game.js";
import { LangCtx, useT, tr } from "./i18n.js";
import {
  getPrefs,
  setPref,
  canVibrate,
  unlockAudio,
  chime,
  buzz,
  notifyTurn,
  warn,
  tick,
  timeUp,
  dealRound,
  dealCard,
  drawSlide,
  sfx,
  reactPop,
} from "./notify.js";
import { REACTIONS, RCOOL } from "./reactions.js";
import { Tile, Avatar, Modal, Invite, Popup, hidePopup } from "./ui.jsx";
import { Seats } from "./Seats.jsx";
import { local, session } from "./store.js";

const CMP = {
  num: (x, y) => x.n - y.n || x.c - y.c,
  col: (x, y) => x.c - y.c || x.n - y.n,
};
const orderRack = (r, m) =>
  m
    ? r.toSorted((a, b) => {
        const x = T(a),
          y = T(b);
        return (x.j ? 1 : 0) - (y.j ? 1 : 0) || CMP[m](x, y);
      })
    : r; // jokers last
// One live MediaQueryList (its .matches always reflects the current preference) instead of a new one per call.
const REDUCED_MQ = matchMedia("(prefers-reduced-motion: reduce)");
const reduced = () => REDUCED_MQ.matches;
const sb = () => (reduced() ? "auto" : "smooth");
const DEAL_FLY = 560; // ms a dealt tile is in the air
const dealGap = (np) => Math.max(50, 140 - 20 * np); // ms per tile: 100 (2 players), 80 (3), 60 (4)
// Fly one face-down tile between two points on a fixed overlay (Web Animations API, self-removing).
// a, b: centres; w, h: the tile's size when it lands (it starts smaller, like leaving the deck).
const flyTile = (layer, a, b, delay, onEnd, w = 28, h = 38) => {
  if (!layer) return;
  const el = document.createElement("div");
  el.className = "fly-tile";
  el.style.width = w + "px";
  el.style.height = h + "px";
  el.style.left = a.x - w / 2 + "px";
  el.style.top = a.y - h / 2 + "px";
  layer.appendChild(el);
  const rot = (Math.random() * 16 - 8).toFixed(1),
    dx = b.x - a.x,
    dy = b.y - a.y;
  const an = el.animate(
    [
      { transform: "translate(0,0) rotate(-14deg) scale(.55)", opacity: 0 },
      { opacity: 1, offset: 0.1 },
      { transform: `translate(${dx * 0.55}px,${dy * 0.55 - 26}px) rotate(${rot}deg) scale(.95)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(1)`, opacity: 1, offset: 0.96 },
      { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(1)`, opacity: 0 },
    ],
    { duration: DEAL_FLY, delay, easing: "cubic-bezier(.3,.6,.35,1)", fill: "both" },
  );
  an.onfinish = () => {
    el.remove();
    onEnd && onEnd();
  };
};
const SIGNED = new Intl.NumberFormat("en", { signDisplay: "exceptZero", useGrouping: false }); // +12 / -5 / 0
const DND_MQ = "(hover: hover) and (pointer: fine) and (min-width: 900px)";
const BGS = 10; // table patterns (CSS classes bg0..bg9)
const loadBg = () =>
  Math.min(BGS - 1, Math.max(0, parseInt(local.get("rmkBg")) || 0));
const loadSort = () => local.get("rmkSort") || null;

export default function Game({
  s,
  net,
  toast,
  reacts,
  copy,
  share,
  tut,
  openRules,
  onLeave,
}) {
  const t = useT(),
    { lang, setLang } = useContext(LangCtx),
    me = s.me,
    my = s.phase === "play" && s.turn === me;
  const [d, setD] = useState(() => ({
      b: s.board,
      r: orderRack(s.rack, loadSort()),
    })),
    [sel, setSel] = useState([]),
    [menu, setMenu] = useState(false),
    [sm, setSm] = useState(loadSort),
    [bg, setBg] = useState(loadBg);
  const [pf, setPf] = useState(getPrefs),
    seatsRef = useRef(null);
  // tell the host how many tiles are in my working rack so IT decides the timeout penalty (1 vs 3 tiles)
  const draftSent = useRef({ seq: -1, n: -1 });
  useEffect(() => {
    if (!my) return;
    const n = d.r.length,
      x = draftSent.current;
    if (x.seq === s.seq && x.n === n) return;
    draftSent.current = { seq: s.seq, n };
    net.send({ t: "draft", n });
  }, [my, s.seq, d.r.length]);
  // NB: in solo/host mode s.rack is the engine's live array (mutated in place by draw), so keep a COPY to diff against
  const prev = useRef({
      rack: [...s.rack],
      phase: s.phase,
      board: s.board.flat(),
      turn: s.turn,
      pn: s.players.map((p) => p.n),
    }),
    [fresh, setFresh] = useState([]),
    [enter, setEnter] = useState(true),
    etm = useRef(0),
    ftm = useRef(0),
    [placed, setPlaced] = useState([]),
    ptm = useRef(0);
  const flyRef = useRef(null),
    ftimers = useRef([]),
    [dealt, setDealt] = useState(() => (!reduced() && freshDeal() ? 0 : null)), // tiles dealt so far while the dealer animation runs (null = not dealing)
    [bump, setBump] = useState(0);
  const later = (fn, ms) => ftimers.current.push(setTimeout(fn, ms));
  // A deal is animated once per round: reloading, or a resize that remounts the screen, must not replay it. The
  // round is identified by room + round number + move counter, remembered for this tab.
  function dealMark(st) {
    return `${net.code}:${st.games ?? 0}:${st.seq}`;
  }
  function freshDeal() {
    return s.phase === "play" && s.players.every((p) => p.n === 14) && session.get("rmkDealt") !== dealMark(s);
  }
  const pt = (el, fallback) => {
    // centre of an element (clamped into the visible seat row if it is scrolled out)
    if (!el) return fallback;
    const b = el.getBoundingClientRect();
    let x = b.left + b.width / 2;
    const sr = seatsRef.current && el.closest(".seats") && seatsRef.current.getBoundingClientRect();
    if (sr) x = Math.min(Math.max(x, sr.left + 16), sr.right - 16);
    return { x, y: b.top + b.height / 2 };
  };
  const poolPt = () =>
    pt(document.querySelector(".top .pill"), { x: window.innerWidth / 2, y: 20 });
  const seatPt = (pid) =>
    pt(seatsRef.current && seatsRef.current.querySelector('[data-pid="' + pid + '"] .av, [data-pid="' + pid + '"]'), poolPt());
  const rackPt = () =>
    pt(document.querySelector(".rack"), { x: window.innerWidth / 2, y: window.innerHeight - 60 });
  // Dealer: round-robin, one tile at a time from the pool to every seat; ours land in the rack slot by slot.
  const deal = (players) => {
    session.set("rmkDealt", dealMark(s));
    const np = players.length,
      N = 14 * np,
      gap = dealGap(np);
    if (reduced()) {
      setDealt(null);
      dealRound(N, gap / 1000, DEAL_FLY / 1000);
      return;
    }
    setDealt(0);
    setEnter(false);
    clearTimeout(etm.current);
    // Read phase: measure everything first. Reading geometry inside the loop below would force a layout per tile
    // (the fly tiles it appends invalidate layout), so the write phase must not touch layout at all.
    const from = poolPt(),
      slots = [...document.querySelectorAll(".rack .tile")].map((el) => el.getBoundingClientRect()),
      seatPts = players.map((p) => seatPt(p.id)); // once per player, not once per tile
    const targets = Array.from({ length: N }, (_, j) => {
      const r = Math.floor(j / np),
        i = j % np,
        sl = i === me && slots[r];
      return sl
        ? {
            to: {
              x: Math.min(Math.max(sl.left + sl.width / 2, 16), window.innerWidth - 16),
              y: sl.top + sl.height / 2,
            },
            w: sl.width,
            h: sl.height,
            mine: true,
          }
        : { to: seatPts[i], w: 24, h: 32, mine: i === me };
    });
    // Write phase: create the flying tiles and schedule the sounds / counters.
    targets.forEach((t, j) => {
      flyTile(flyRef.current, from, t.to, j * gap, undefined, t.w, t.h);
      dealCard(j * gap + DEAL_FLY, t.mine);
      later(() => setDealt(j + 1), j * gap + DEAL_FLY);
    });
    later(() => setDealt(null), N * gap + DEAL_FLY + 80);
  };
  // Someone else drew: tiles fly from the pool to their seat.
  const drawFly = (pid, n) => {
    drawSlide(n);
    if (reduced()) return;
    const from = poolPt(),
      to = seatPt(pid);
    for (let k = 0; k < Math.min(n, 3); k++)
      flyTile(flyRef.current, from, to, k * 120, k === Math.min(n, 3) - 1 ? () => {
        setBump(pid);
        later(() => setBump(0), 450);
      } : undefined);
  };
  useEffect(() => {
    // first render: a freshly dealt round (everyone on 14 tiles) gets the dealer animation; a rejoin mid-game does not
    if (freshDeal()) later(() => deal(s.players), 150);
    return () => ftimers.current.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    etm.current = setTimeout(() => setEnter(false), 500);
    return () => {
      clearTimeout(ftm.current);
      clearTimeout(ptm.current);
      clearTimeout(etm.current);
    };
  }, []);
  useEffect(() => {
    setD({ b: s.board, r: orderRack(s.rack, sm) });
    setSel([]); // new turn / draw: keep the chosen sort
    const p = prev.current,
      p0 = p,
      add =
        p.phase === s.phase && s.phase === "play"
          ? s.rack.filter((i) => !p.rack.includes(i))
          : []; // tiles drawn since last state (not the deal / a new round)
    const bd = s.board.flat(),
      same = p.phase === s.phase && s.phase === "play",
      put = same && p.turn !== me ? bd.filter((i) => !p.board.includes(i)) : []; // tiles an opponent just added to the table (moved ones were already there)
    if (!same) {
      setEnter(true);
      clearTimeout(etm.current);
      etm.current = setTimeout(() => setEnter(false), 500);
      if (s.phase === "play") {
        if (!reduced()) setDealt(0);
        later(() => deal(s.players), 120);
      }
    } // deal / new round: tiles pop in
    else
      s.players.forEach((p, i) => {
        // a player (not us) whose tile count went up drew from the pool (playing tiles only lowers it)
        const was = (p0.pn || [])[i];
        if (i !== me && was != null && p.n > was) drawFly(p.id, p.n - was);
      });
    prev.current = {
      rack: [...s.rack],
      phase: s.phase,
      board: bd,
      turn: s.turn,
      pn: s.players.map((x) => x.n),
    };
    if (put.length) {
      setPlaced(put);
      clearTimeout(ptm.current);
      ptm.current = setTimeout(() => setPlaced([]), 2600);
    } else if (!same) setPlaced([]);
    if (add.length) {
      setFresh(add);
      clearTimeout(ftm.current);
      ftm.current = setTimeout(() => setFresh([]), 2200);
    } // later states (e.g. the bot's move) must not cut it short
    else if (p.phase !== s.phase || s.rack.length < p.rack.length) setFresh([]);
  }, [s.seq, s.phase]);
  useEffect(() => {
    // busy tables scroll too: bring what the opponent just played into view
    if (!placed.length) return;
    const el = document.querySelector(".board .tile.placed");
    el &&
      el.scrollIntoView &&
      el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: sb(),
      });
  }, [placed]);
  useEffect(() => {
    // busy racks scroll: bring the new tile into view
    if (!fresh.length) return;
    const el = document.querySelector(".rack .tile.fresh");
    el &&
      el.scrollIntoView &&
      el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: sb(),
      });
  }, [fresh]);

  // ---- turn timer: host sends the time left; we count down locally from the moment each state arrives ----
  const dl = useMemo(() => (s.tl == null ? null : Date.now() + s.tl), [s]);
  const timed = dl != null;
  // Only the whole-second value is React state, so Game re-renders about once a second (not 5x/s). The tick is
  // scheduled for the moment the displayed second changes. The bar itself is a CSS animation (see .tbar i).
  const [secsState, setSecs] = useState(() => dl == null ? null : Math.ceil(Math.max(0, dl - Date.now()) / 1000));
  useEffect(() => {
    if (dl == null) return setSecs(null);
    let id;
    const tickTo = () => {
      const left = Math.max(0, dl - Date.now());
      setSecs(Math.ceil(left / 1000));
      if (left > 0) id = setTimeout(tickTo, left % 1000 || 1000);
    };
    tickTo();
    return () => clearTimeout(id);
  }, [dl]);
  const secs = timed ? secsState : null;
  const tot = s.opts.timer || 60,
    redAt = Math.min(10, Math.max(5, Math.ceil(tot * 0.17))), // warning threshold scales with the turn length
    amberAt = Math.ceil(tot / 3);
  const hot = timed && secs <= redAt,
    cls = !timed ? "" : secs > amberAt ? "ok" : secs > redAt ? "amber" : "red";
  const ev = useRef({ seq: -1, warn: 0, sent: 0 });
  // An Effect Event always sees the latest my/redAt/net, while the effect below re-runs only when the countdown
  // second or the turn changes (the explicit intent that the old, incomplete dependency list only implied).
  const onCountdown = useEffectEvent(() => {
    if (!timed) return;
    if (ev.current.seq !== s.seq) ev.current = { seq: s.seq, warn: 0, sent: 0 };
    const e = ev.current;
    if (my && secs > 0 && secs <= redAt && !e.warn) {
      e.warn = 1;
      warn();
    }
    if (my && secs > 0 && secs <= 3) tick();
    if (my && secs === 0 && !e.sent) {
      e.sent = 1;
      net.send({ t: "timeout" });
    }
  });
  useEffect(() => {
    onCountdown();
  }, [secs, s.seq]);

  useEffect(() => {
    // on narrow screens keep the player whose turn it is visible in the seat row
    const el = seatsRef.current && seatsRef.current.querySelector(".seat.act");
    el &&
      el.scrollIntoView &&
      el.scrollIntoView({
        inline: "nearest",
        block: "nearest",
        behavior: sb(),
      });
  }, [s.turn, s.phase]);

  // ---- alerts ----
  useEffect(() => {
    if (my) notifyTurn();
  }, [s.seq]);
  useEffect(() => {
    const l = s.log;
    if (
      l &&
      l.k === "l.timeout" &&
      s.players[me] &&
      l.p.id === s.players[me].id
    ) {
      toast({ k: "n.timeUp", p: { n: l.p.n } }, "warn");
      timeUp();
    }
  }, [s.seq]);
  useEffect(() => {
    // tab title when the tab is in the background
    const base = "Rummikub Online",
      upd = () => {
        document.title =
          my && document.hidden
            ? timed && secs <= amberAt
              ? `⏱ ${secs}s · ${t("turnMine")}`
              : `● ${t("turnMine")} – ${base}`
            : base;
      };
    upd();
    document.addEventListener("visibilitychange", upd);
    return () => {
      document.removeEventListener("visibilitychange", upd);
      document.title = base;
    };
  }, [my, s.seq, secs]);
  useEffect(() => {
    tut && tut(sel, d);
  }, [tut, sel, d]); // tutorial: tell the coach what the player has selected / placed so far
  // ---- reactions: emoji bubbles over the sender's seat (fixed layer: the seat row scrolls/clips) ----
  const [pk, setPk] = useState(false),
    [cool, setCool] = useState(false),
    [bub, setBub] = useState({}),
    meId = useRef();
  meId.current = s.players[me] && s.players[me].id;
  useEffect(() => {
    if (!reacts) return;
    const to = {};
    const off = reacts((r) => {
      const mine = r.from === meId.current;
      if (!mine && !getPrefs().reacts) return;
      const el =
        seatsRef.current &&
        seatsRef.current.querySelector('[data-pid="' + r.from + '"]');
      if (!el) return;
      const b = el.getBoundingClientRect(),
        sr = seatsRef.current.getBoundingClientRect(); // a seat scrolled out of the row: clamp to the visible row
      setBub((v) => ({
        ...v,
        [r.from]: {
          k: r.k,
          id: r.id,
          x: Math.min(
            Math.max(b.left + b.width / 2, sr.left + 24),
            sr.right - 24,
          ),
          y: sr.bottom + 12, // below the timer bar, not over the seat chips
        },
      }));
      reactPop(r.k);
      clearTimeout(to[r.from]);
      to[r.from] = setTimeout(
        () =>
          setBub((v) => {
            const n = { ...v };
            delete n[r.from];
            return n;
          }),
        2600,
      );
    });
    return () => {
      off();
      Object.values(to).forEach(clearTimeout);
    };
  }, [reacts]);
  const sendR = (k) => {
    if (cool) return;
    net.send({ t: "react", k });
    hidePopup("react-picker");
    setCool(true);
    setTimeout(() => setCool(false), RCOOL);
  };
  const flip = (k) => {
    const v = !pf[k];
    setPref(k, v);
    setPf(getPrefs());
    if (v) {
      if (k === "sound") {
        unlockAudio();
        chime();
      } else if (k === "vibe") buzz();
    }
  };

  // ---- table editing (tap to select, then tap a target) ----
  const norm = (b) => b.filter((x) => x.length).map((x) => analyze(x).order);
  const strip = (b, ids) => b.map((x) => x.filter((i) => !ids.includes(i)));
  const toggle = (id) => {
    if (!my) return;
    sfx(sel.includes(id) ? "deselect" : "select");
    setSel((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  };
  const fromRack = (r, ids) => r.filter((i) => !ids.includes(i));
  const newSet = (ids = sel) => {
    if (my) sfx("newSet");
    setSay(t("a.new", { n: ids.length }));
    setD({ b: norm([...strip(d.b, ids), ids]), r: fromRack(d.r, ids) });
    setSel([]);
  };
  const addTo = (k, ids = sel) => {
    if (my) sfx("addTo");
    setSay(t("a.set", { n: ids.length, k: k + 1 }));
    const b = strip(d.b, ids);
    b[k] = [...b[k], ...ids];
    setD({ b: norm(b), r: fromRack(d.r, ids) });
    setSel([]);
  };
  const back = (ids = sel) => {
    const bk = ids.filter((i) => s.rack.includes(i) && !d.r.includes(i));
    if (!bk.length) return setSel([]);
    setSay(t("a.rack", { n: bk.length }));
    setD({
      b: norm(d.b.map((x) => x.filter((i) => !bk.includes(i)))),
      r: orderRack([...d.r, ...bk], sm),
    });
    setSel([]);
  };
  const reset = () => {
    setD({ b: s.board, r: orderRack(s.rack, sm) });
    setSel([]);
  };
  const setSort = (m) => {
    const v = sm === m ? null : m;
    setSm(v); // tap the active option again to go back to manual order
    if (v) local.set("rmkSort", v);
    else local.remove("rmkSort");
    setD((x) => ({ ...x, r: orderRack(x.r, v) }));
  };

  // ---- drag & drop with Pointer Events (mouse/pen on large screens; tap-to-select works everywhere) ----
  // Tiles carry no handlers (so React.memo can skip them): everything is delegated from the game root.
  const [canDnd, setCanDnd] = useState(() => matchMedia(DND_MQ).matches),
    [over, setOver] = useState(null), // zone under the pointer while dragging: "n" (new set), "r" (rack) or a set index
    [gh, setGh] = useState([]), // tiles being dragged (dimmed in place)
    [say, setSay] = useState(""), // polite announcement of the last move, for screen readers
    actions = useRef(),
    suppressClick = useRef(false),
    abortDrag = useRef(null);
  useEffect(() => {
    const m = matchMedia(DND_MQ),
      f = () => setCanDnd(m.matches);
    m.addEventListener("change", f);
    return () => {
      m.removeEventListener("change", f);
      abortDrag.current?.();
    };
  }, []);
  const dnd = my && canDnd;
  actions.current = { newSet, addTo, back }; // the latest closures: the drop outlives the render that started the drag
  const onTilePointerDown = (e) => {
    if (!dnd || e.button !== 0 || e.pointerType === "touch") return;
    const tile = e.target.closest(".tile");
    if (!tile) return;
    const id = +tile.dataset.id,
      pid = e.pointerId, // follow exactly one pointer: a second one can neither start nor end this drag
      x0 = e.clientX,
      y0 = e.clientY,
      ac = new AbortController(),
      sig = { signal: ac.signal };
    let drag = null,
      raf = 0,
      last = { x: x0, y: y0 };
    const zoneAt = (x, y) => document.elementFromPoint(x, y)?.closest("[data-zone]")?.dataset.zone ?? null,
      track = () => {
        drag.pv.style.translate = `${last.x - drag.w / 2}px ${last.y - drag.h / 2}px`;
        setOver(zoneAt(last.x, last.y));
      },
      // auto-scroll the rack/board while the pointer is near its top or bottom edge
      autoscroll = () => {
        const sc = document.elementFromPoint(last.x, last.y)?.closest(".board, .rack");
        if (sc && sc.scrollHeight > sc.clientHeight) {
          const r = sc.getBoundingClientRect(),
            edge = 36,
            v = last.y < r.top + edge ? last.y - (r.top + edge) : last.y > r.bottom - edge ? last.y - (r.bottom - edge) : 0;
          if (v) {
            sc.scrollTop += Math.sign(v) * Math.min(18, Math.abs(v) / 2 + 2);
            track();
          }
        }
        raf = requestAnimationFrame(autoscroll);
      },
      end = (drop) => {
        ac.abort();
        cancelAnimationFrame(raf);
        abortDrag.current = null;
        if (!drag) return; // never moved far enough: it was a plain click, which proceeds normally
        const z = drop ? zoneAt(last.x, last.y) : null;
        drag.pv.remove();
        document.documentElement.classList.remove("dragging");
        setGh([]);
        setOver(null);
        suppressClick.current = true; // the click that follows a drag must not also toggle a tile
        setTimeout(() => (suppressClick.current = false), 0);
        const a = actions.current;
        if (z === "n") a.newSet(drag.ids);
        else if (z === "r") a.back(drag.ids);
        else if (z != null) a.addTo(+z, drag.ids);
      };
    window.addEventListener(
      "pointermove",
      (ev) => {
        if (ev.pointerId !== pid) return;
        last = { x: ev.clientX, y: ev.clientY };
        if (!drag) {
          if (Math.hypot(last.x - x0, last.y - y0) < 5) return;
          const r = tile.getBoundingClientRect(),
            pv = tile.cloneNode(true),
            ids = sel.includes(id) ? sel : [id];
          pv.className = "tile drag-preview";
          for (const a of ["data-id", "aria-label", "aria-pressed"]) pv.removeAttribute(a);
          pv.setAttribute("aria-hidden", "true");
          pv.tabIndex = -1;
          pv.style.setProperty("--tw", r.width + "px"); // the preview lives outside the board, which may override --tw
          pv.style.width = r.width + "px";
          if (ids.length > 1) pv.dataset.count = ids.length;
          document.body.append(pv);
          document.documentElement.classList.add("dragging");
          drag = { ids, pv, w: r.width, h: r.height };
          setGh(ids);
          tile.setPointerCapture?.(pid); // keep receiving moves/up even if the pointer leaves the window
          raf = requestAnimationFrame(autoscroll);
        }
        track();
      },
      sig,
    );
    window.addEventListener("pointerup", (ev) => ev.pointerId === pid && end(true), sig);
    window.addEventListener("pointercancel", (ev) => ev.pointerId === pid && end(false), sig);
    window.addEventListener("keydown", (ev) => ev.key === "Escape" && end(false), sig); // Escape cancels the drag
    abortDrag.current = () => end(false);
  };
  const onTileClick = (e) => {
    const tile = e.target.closest(".tile");
    if (tile && !suppressClick.current) toggle(+tile.dataset.id);
  };

  // ---- keyboard: each tile group (rack, table) is a single tab stop; arrow keys move between its tiles ----
  const [rk, setRk] = useState(null),
    [bk, setBk] = useState(null);
  const onTileFocus = (e) => {
    const tile = e.target.closest?.(".tile");
    if (tile) (tile.closest(".rack") ? setRk : setBk)(+tile.dataset.id);
  };
  const onTileKeys = (e) => {
    const tile = e.target.closest?.(".tile");
    if (!tile) return;
    const list = [...tile.closest(".rack, .board").querySelectorAll(".tile")],
      i = list.indexOf(tile),
      n =
        e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1
        : e.key === "Home" ? 0
        : e.key === "End" ? list.length - 1
        : -1;
    if (n < 0) return;
    e.preventDefault();
    list[Math.min(list.length - 1, Math.max(0, n))].focus();
  };

  // Only recomputed when the working table (d.b) or the server's table (s.board) changes, not on every tick/render.
  const { info, pts, boardEdited } = useMemo(() => {
    const info = d.b.map(analyze),
      oldK = new Set(s.board.map(key));
    return {
      info,
      pts: d.b.reduce((a, x, j) => a + (oldK.has(key(x)) ? 0 : info[j].val), 0),
      boardEdited: JSON.stringify(d.b) !== JSON.stringify(s.board),
    };
  }, [d.b, s.board]);
  const boardOrder = useMemo(() => info.flatMap((x) => x.order), [info]),
    boardRove = boardOrder.includes(bk) ? bk : boardOrder[0], // the one tabbable tile of each group
    rackRove = d.r.includes(rk) ? rk : d.r[0];
  const allOk = info.every((x) => x.ok),
    cur = s.players[s.turn] || s.players[0] || {},
    showAdd = my && sel.length > 0;
  const melded = s.players[me] && s.players[me].melded;
  // why End is unavailable: same checks, same order and same messages as the host's act() so the player never hits a silent disabled button
  const edited = d.r.length !== s.rack.length || boardEdited;
  const why = !my
    ? null
    : d.r.length === s.rack.length
      ? { k: "e.playOne" }
      : !allOk
        ? { k: "e.invalid" }
        : !melded && !s.board.every((o) => d.b.some((x) => key(x) === key(o)))
          ? { k: "e.noTouch" }
          : !melded && pts < 30
            ? { k: "e.meld", p: { n: pts } }
            : null;
  const canBack = sel.some((i) => s.rack.includes(i) && !d.r.includes(i)),
    [cd, setCd] = useState(false);
  const doDraw = () => {
    if (edited && !cd) {
      sfx("drawAsk");
      setCd(true);
      setTimeout(() => setCd(false), 3000);
      return;
    } // unsaved edits would be thrown away: ask once
    setCd(false);
    sfx("draw");
    net.send({ t: "draw" });
  };
  const cx = !!(s.result && s.result.cancelled),
    hostRoom = me === 0 && !!net.endRoom,
    inRoom =
      !!net.endRoom ||
      (!!net.code && net.code !== "SOLO" && net.code !== "TUTORIAL"),
    [endAsk, setEndAsk] = useState(false); // cx: the host ended the round early (no winner, no score change)
  const ranked = s.result
    ? s.players.toSorted((a, b) => s.scores[b.id] - s.scores[a.id])
    : [];

  return (
    <div
      className={"game" + (dnd ? " dnd" : "")}
      onPointerDown={onTilePointerDown}
      onClick={onTileClick}
      onFocus={onTileFocus}
      onKeyDown={onTileKeys}
    >
      <div className="sr" role="status">{say}</div>
      <div className="fly-layer" ref={flyRef} aria-hidden="true" />
      {Object.entries(bub).map(([id, b]) => {
        const r = REACTIONS.find((x) => x.k === b.k);
        return (
          r && (
            <div
              key={b.id}
              className="rbub"
              aria-hidden="true"
              style={{
                left: Math.min(Math.max(b.x, 100), window.innerWidth - 100),
                top: b.y - 6,
              }}
            >
              <span className={"rx rx-" + r.a}>{r.e}</span>
              <small>
                {((s.players.find((p) => p.id === id) || {}).name || "") +
                  ": " +
                  t("r." + r.k)}
              </small>
            </div>
          )
        );
      })}
      <div className="sr" aria-live="polite">
        {Object.entries(bub)
          .map(
            ([id, b]) =>
              ((s.players.find((p) => p.id === id) || {}).name || "") +
              ": " +
              t("r." + b.k),
          )
          .join(". ")}
      </div>
      <header className="top">
        <div className="seats" ref={seatsRef} data-many={s.players.length > 2 || undefined}>
          {s.players.map((p, i) => (
            <div
              key={p.id}
              data-pid={p.id}
              className={
                "seat" +
                (i === s.turn && s.phase === "play" ? " act" : "") +
                (p.on === false ? " off" : "") +
                (bump === p.id ? " bump" : "")
              }
            >
              <Avatar
                name={p.name}
                i={i}
                badge={
                  dealt != null
                    ? Math.min(p.n, Math.max(0, Math.ceil((dealt - i) / s.players.length)))
                    : p.n
                }
              />
              <div className="si">
                <b>
                  {p.name}
                  {i === me && <em> {t("you")}</em>}
                </b>
                <small
                  aria-label={t("ptsWins", {
                    pts: s.scores[p.id],
                    w: s.wins[p.id],
                  })}
                >
                  {t("pts", { n: s.scores[p.id] })}
                  <span className="wn">
                    {" "}· <Trophy size={11} />
                    {s.wins[p.id]}
                  </span>
                </small>
              </div>
              {p.bot && (
                <Bot size={14} className="seat-bot" aria-label={t("bot")} />
              )}
              {p.on === false && <WifiOff size={14} aria-label={t("off")} />}
              {p.melded && <Check size={14} className="seat-ok" />}
            </div>
          ))}
        </div>
        <span
          className="pill"
          title={t("pool", { n: s.pool })}
          aria-label={t("pool", { n: s.pool })}
        >
          <Layers size={16} />
          {dealt != null ? s.pool + 14 * s.players.length - dealt : s.pool}
        </span>
        <div className="menuwrap">
          <button
            className="icon"
            aria-label={t("menu")}
            aria-haspopup="menu"
            aria-expanded={menu}
            command="toggle-popover"
            commandfor="game-menu"
          >
            <EllipsisVertical size={20} />
          </button>
          <Popup id="game-menu" className="menu" label={t("menu")} onOpenChange={setMenu}>
              <button
                role="menuitem"
                onClick={() => {
                  hidePopup("game-menu");
                  openRules();
                }}
              >
                <BookOpen size={18} />
                {t("rules")}
              </button>
              <button role="menuitemcheckbox" aria-checked={pf.sound} onClick={() => flip("sound")}>
                {pf.sound ? <Bell size={18} /> : <BellOff size={18} />}
                {t("snd")}
                <span className="sw">{pf.sound ? t("sw.on") : t("sw.off")}</span>
              </button>
              {canVibrate() && (
                <button role="menuitemcheckbox" aria-checked={pf.vibe} onClick={() => flip("vibe")}>
                  {pf.vibe ? <Vibrate size={18} /> : <VibrateOff size={18} />}
                  {t("vib")}
                  <span className="sw">{pf.vibe ? t("sw.on") : t("sw.off")}</span>
                </button>
              )}
              <button role="menuitemcheckbox" aria-checked={pf.reacts} onClick={() => flip("reacts")}>
                <Smile size={18} />
                {t("reactsT")}
                <span className="sw">{pf.reacts ? t("sw.on") : t("sw.off")}</span>
              </button>
              {s.opts.timer > 0 && (
                <button role="menuitemcheckbox" aria-checked={pf.ticks} onClick={() => flip("ticks")}>
                  <Timer size={18} />
                  {t("ticks")}
                  <span className="sw">{pf.ticks ? t("sw.on") : t("sw.off")}</span>
                </button>
              )}
              <button
                role="menuitem"
                onClick={() => {
                  const v = (bg + 1) % BGS;
                  sfx("click");
                  setBg(v);
                  local.set("rmkBg", v);
                }}
              >
                <Grid3x3 size={18} />
                {t("bg")}
                <span className="sw">{t("bg" + bg)}</span>
              </button>
              <button
                role="menuitem"
                onClick={() => setLang(lang === "en" ? "es" : "en")}
              >
                <Languages size={18} />
                {t("lang")}
                <span className="sw">{lang === "en" ? "EN" : "ES"}</span>
              </button>
              <hr />
              {hostRoom && s.phase === "play" && (
                <button
                  role="menuitem"
                  onClick={() => {
                    hidePopup("game-menu");
                    setEndAsk(true);
                  }}
                >
                  <Flag size={18} />
                  {t("endRound")}
                </button>
              )}
              <button
                role="menuitem"
                onClick={() => {
                  hidePopup("game-menu");
                  onLeave();
                }}
              >
                <LogOut size={18} />
                {t("leave")}
              </button>
          </Popup>
        </div>
      </header>
      {timed && (
        <div
          className={"tbar " + cls + (hot ? " hot" : "")}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={tot}
          aria-valuenow={secs}
          aria-valuetext={t("secsLeft", { n: secs })}
          aria-label={t("timer")}
        >
          <i key={dl} style={{ "--p0": s.tl / (tot * 1000), "--dur": s.tl + "ms" }} />
          {hot && (
            <b className={"tnum" + (my ? " mine" : "")} aria-hidden="true">
              {secs}
            </b>
          )}
        </div>
      )}
      <div className="sr" aria-live="assertive">
        {my && secs === redAt ? t("tenLeft") : ""}
      </div>
      <div className="boardwrap">
        <main
          className={
            "board bg" + bg +
            (over === "n" ? " dropping" : "") +
            (showAdd ? " adding" : "")
          }
          data-zone="n"
        >
          {d.b.map((b, k) => (
            <div
              key={b.length ? Math.min(...b) : "e" + k}
              className={
                "set" +
                (info[k].ok ? "" : " bad") +
                (over === String(k) ? " dropping" : "")
              }
              role="group"
              aria-label={t("setN", { k: k + 1 }) + (info[k].ok ? "" : " " + t("setBad"))}
              aria-invalid={info[k].ok ? undefined : true}
              data-zone={k}
            >
              {info[k].order.map((id, j) => (
                <Tile
                  key={id}
                  id={id}
                  sel={sel.includes(id)}
                  num={info[k].nums && info[k].nums[j]}
                  placed={placed.includes(id)}
                  enter={enter}
                  ghost={gh.includes(id)}
                  rove={id === boardRove}
                />
              ))}
              {showAdd && (
                <button
                  className="plus badge"
                  aria-label={t("addSet")}
                  title={t("addSet")}
                  onClick={() => addTo(k)}
                >
                  <Plus size={18} />
                </button>
              )}
            </div>
          ))}
          {!d.b.length && <p className="sub">{t("empty")}</p>}
        </main>
        {showAdd && (
          <button
            className="plus float"
            data-tut="newset"
            onClick={() => newSet()}
          >
            <Plus size={18} />
            {t("newSet")}
          </button>
        )}
      </div>
      <div className="bar">
        <div className="status">
          <b>
            {my
              ? melded
                ? t("turnMine")
                : t("turnMeld", { pts })
              : t("turnOf", { name: cur.name })}
          </b>
          {my && !melded && (
            <span className="meld" aria-hidden="true">
              <i style={{ width: Math.min(100, (pts / 30) * 100) + "%" }} />
            </span>
          )}
          {my && edited && why ? (
            <span id="why" className="log why" aria-live="polite">
              {tr(t, why)}
            </span>
          ) : (
            <span className="log" aria-live="polite">
              {tr(t, s.log)}
            </span>
          )}
        </div>
        {my && (
          <>
            <button
              aria-label={t("toRack")}
              disabled={!canBack}
              onClick={() => {
                sfx("toRack");
                back();
              }}
            >
              <ArrowDownToLine size={18} />
              <span className="lbl">{t("toRack")}</span>
            </button>
            <button
              aria-label={t("undo")}
              disabled={!edited}
              data-tut="undo"
              onClick={() => {
                sfx("undo");
                reset();
              }}
            >
              <Undo2 size={18} />
              <span className="lbl">{t("undo")}</span>
            </button>
            <button
              className={
                cd
                  ? "primary danger"
                  : "draw" + (hot && !edited ? " pulse" : "")
              }
              data-tut="draw"
              aria-label={cd ? t("drawConfirm") : undefined}
              onClick={doDraw}
            >
              <CopyPlus size={18} />
              {cd ? (
                <>
                  <span className="lg">{t("drawConfirm")}</span>
                  <span className="sh" aria-hidden="true">
                    {t("drawConfirmS")}
                  </span>
                </>
              ) : (
                <span>{s.pool ? t("draw") : t("pass")}</span>
              )}
            </button>
            <div className="decide">
              <button
                className="primary"
                data-tut="end"
                aria-label={t("end")}
                disabled={!!why}
                aria-describedby={edited && why ? "why" : undefined}
                title={why ? tr(t, why) : undefined}
                onClick={() => {
                  sfx("end");
                  net.send({ t: "end", board: d.b, rack: d.r });
                }}
              >
                <Check size={18} />
                <span className="lg">{t("end")}</span>
                <span className="sh" aria-hidden="true">
                  {t("endS")}
                </span>
              </button>
            </div>
          </>
        )}
        {!my && me === 0 && s.phase === "play" && cur.on === false && (
          <button
            onClick={() => {
              sfx("skip");
              net.send({ t: "skip" });
            }}
          >
            {t("skip")}
          </button>
        )}
      </div>
      <div className="rackwrap">
        <div className="rackbar">
          <span className="rcount">
            {t("rack")} · {d.r.length}
          </span>
          <div className="rwrap">
            <button
              aria-label={t("react")}
              title={t("react")}
              aria-haspopup="menu"
              aria-expanded={pk}
              command="toggle-popover"
              commandfor="react-picker"
              onClick={() => sfx("click")}
            >
              <SmilePlus size={18} />
            </button>
            <Popup id="react-picker" className="rpick" label={t("react")} onOpenChange={setPk}>
                {REACTIONS.map((r) => (
                  <button
                    key={r.k}
                    role="menuitem"
                    disabled={cool}
                    onClick={() => sendR(r.k)}
                  >
                    <span>{r.e}</span>
                    <small>{t("r." + r.k)}</small>
                  </button>
                ))}
            </Popup>
          </div>
          <div className="seg">
            <button
              aria-label={t("sort123")}
              title={t("sort123")}
              aria-pressed={sm === "num"}
              onClick={() => {
                sfx("sort");
                setSort("num");
              }}
            >
              <ArrowDown01 size={18} />
            </button>
            <button
              aria-label={t("sortCol")}
              title={t("sortCol")}
              aria-pressed={sm === "col"}
              onClick={() => {
                sfx("sort");
                setSort("col");
              }}
            >
              <Palette size={18} />
            </button>
          </div>
        </div>
        <div
          className={
            "rack" + (over === "r" ? " dropping" : "")
          }
          data-zone="r"
        >
          {d.r.map((id, ix) => {
            const hid =
              dealt != null &&
              ix >= Math.max(0, Math.ceil((dealt - me) / s.players.length));
            return (
            <Tile
              key={id}
              id={id}
              hide={hid}
              sel={sel.includes(id)}
              fresh={fresh.includes(id)}
              enter={dealt != null ? !hid : enter}
              ghost={gh.includes(id)}
              rove={id === rackRove}
            />
            );
          })}
        </div>
      </div>
      {endAsk && s.phase === "play" && (
        <Modal title={t("endRound")} onClose={() => setEndAsk(false)}>
          <h2>{t("endRound")}</h2>
          <p>{t("endRoundQ")}</p>
          <div className="row">
            <button data-autofocus onClick={() => setEndAsk(false)}>
              {t("stay")}
            </button>
            <button
              className="primary danger"
              onClick={() => {
                setEndAsk(false);
                net.send({ t: "forfeit" });
              }}
            >
              {t("endRoundYes")}
            </button>
          </div>
        </Modal>
      )}
      {s.phase === "over" && (
        <Modal
          felt={inRoom}
          title={
            cx
              ? t("roundEnded")
              : t(s.result.blocked ? "winsPool" : "wins", {
                  name: s.players[s.result.winner]?.name || "",
                })
          }
        >
          <div className="center">
            <Trophy size={40} className="gold" />
            <h2>
              {cx
                ? t("roundEnded")
                : t(s.result.blocked ? "winsPool" : "wins", {
                    name: s.players[s.result.winner]?.name || "",
                  })}
            </h2>
            {cx && <p>{t("roundEndedD")}</p>}
            <p className="sub">{t("roundN", { n: s.games })}</p>
            <ul className="res">
              {ranked.map((p, rank) => {
                const v = cx ? 0 : s.result.delta?.[p.id] || 0,
                  won = !cx && s.players[s.result.winner]?.id === p.id;
                return (
                  <li key={p.id}>
                    <span className="rk">{rank + 1}</span>
                    <b>
                      {p.name}
                      {won && <Crown size={14} aria-label={t("roundWinner")} />}
                    </b>
                    {!cx && (
                      <span className={v > 0 ? "pos" : "neg"}>
                        {SIGNED.format(v)}
                      </span>
                    )}
                    <span className="meta">
                      <span className="tot">
                        {t("total")} <b>{s.scores[p.id]}</b>
                      </span>
                      <span>
                        <Trophy size={12} /> {s.wins[p.id]} {t("winsLbl")}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {inRoom && (
              <>
                <p className="sub">{t("room")}</p>
                {hostRoom && s.players.length < 4 && (
                  <Invite net={net} copy={copy} share={share} />
                )}
                <Seats s={s} net={net} host={hostRoom} />
              </>
            )}
            <div className="endact">
              {me === 0 ? (
                <button
                  className="primary big"
                  data-autofocus
                  disabled={s.players.length < 2}
                  onClick={() => net.send({ t: "start" })}
                >
                  {t("next")}
                </button>
              ) : (
                <p>{t("waitNext")}</p>
              )}
              {me === 0 && s.players.length < 2 && (
                <p className="sub">{t("need2")}</p>
              )}
              <button className="link" onClick={onLeave}>
                <LogOut size={16} />
                {t("leave")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
