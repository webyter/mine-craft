// Inventory model + HUD + container screens
import { iconFor } from './textures.js';
import { itemName, maxStack, maxDur, matchRecipe, CREATIVE_LIST, isBlock, isTool, BLOCKS, ITEMS, SMELT, FUEL, I, enchText, enchKind, ENCH } from './blocks.js';
import { sfx } from './audio.js';

export class Inventory {
  constructor() { this.slots = new Array(36).fill(null); this.sel = 0; }
  held() { return this.slots[this.sel]; }
  add(id, count = 1, dur, ench) {
    const ms = ench ? 1 : maxStack(id);
    if (ms > 1) for (let i = 0; i < 36 && count > 0; i++) {
      const s = this.slots[i]; if (s && s.id === id && s.count < ms) { const n = Math.min(ms - s.count, count); s.count += n; count -= n; }
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) { const n = Math.min(ms, count); this.slots[i] = { id, count: n, dur: dur ?? maxDur(id) }; if (ench) this.slots[i].ench = ench; count -= n; }
    }
    this.onChange && this.onChange();
    return count;
  }
  consumeHeld(n = 1) { const s = this.held(); if (!s) return; s.count -= n; if (s.count <= 0) this.slots[this.sel] = null; this.onChange && this.onChange(); }
  damageHeld(n = 1) {
    const s = this.held(); if (!s || !maxDur(s.id)) return false;
    const ub = (s.ench && s.ench.unbreaking) || 0; if (ub && Math.random() > 1 / (ub + 1)) return false;
    s.dur -= n; if (s.dur <= 0) { this.slots[this.sel] = null; this.onChange && this.onChange(); return true; }
    this.onChange && this.onChange(); return false;
  }
  clear() { this.slots.fill(null); this.onChange && this.onChange(); }
  count(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.count; return n; }
  remove(id, n) {
    for (let i = 35; i >= 0 && n > 0; i--) { const s = this.slots[i]; if (s && s.id === id) { const k = Math.min(n, s.count); s.count -= k; n -= k; if (s.count <= 0) this.slots[i] = null; } }
    this.onChange && this.onChange(); return n <= 0;
  }
}

// ---------- pixel icons for hearts etc ----------
function pix(rows, colors, scale = 1) {
  const h = rows.length, w = rows[0].length; const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (colors[ch]) { g.fillStyle = colors[ch]; g.fillRect(x, y, 1, 1); } }));
  void scale; return c.toDataURL();
}
const HEART = ['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
const HEART_HALF = ['.kk.kk.', 'krrkddk', 'krwdddk', 'krrdddk', '.krddk.', '..kdk..', '...k...'];
const DRUM = ['....kk.', '...kbbk', '..kbbbk', '.kmmbk.', 'kmmmk..', 'kwk....', '.k.....'];
const DRUM_HALF = ['....kk.', '...kddk', '..kdddk', '.kmmdk.', 'kmmmk..', 'kwk....', '.k.....'];
const BUB = ['..kkk..', '.kbbbk.', 'kbwbbbk', 'kbbbbbk', 'kbbbbbk', '.kbbbk.', '..kkk..'];
const ICONS = {};
function icons() {
  if (ICONS.h) return ICONS;
  ICONS.h = pix(HEART, { k: '#1a0000', r: '#e01818', w: '#ffb0b0' });
  ICONS.hh = pix(HEART_HALF, { k: '#1a0000', r: '#e01818', w: '#ffb0b0', d: '#3a1010' });
  ICONS.he = pix(HEART, { k: '#1a0000', r: '#3a1010', w: '#3a1010' });
  ICONS.f = pix(DRUM, { k: '#2a1500', b: '#c8742a', m: '#7a3a10', w: '#eee' });
  ICONS.fh = pix(DRUM_HALF, { k: '#2a1500', b: '#c8742a', m: '#7a3a10', w: '#eee', d: '#3a2010' });
  ICONS.fe = pix(DRUM, { k: '#2a1500', b: '#3a2010', m: '#3a2010', w: '#3a2010' });
  ICONS.b = pix(BUB, { k: '#0a2a6a', b: '#3a8ae8', w: '#e0f0ff' });
  return ICONS;
}

const TABS = {
  Construction: (id) => isBlock(id) && ![9, 22, 24, 32, 33, 34, 55, 1, 2, 18, 6, 7, 20, 46, 13, 14, 15, 16, 17, 19, 47].includes(id),
  Nature: (id) => isBlock(id) && [1, 2, 18, 6, 7, 9, 22, 24, 32, 33, 34, 55, 20, 46, 13, 14, 15, 16, 17, 19, 47, 8, 21, 23, 42, 5].includes(id),
  Equipment: (id) => isTool(id) || id === 114,
  Items: (id) => !isBlock(id) && !isTool(id) && id !== 114,
};

export class UI {
  constructor(game) {
    this.game = game; this.inv = game.inv; this.cursor = null; this.screen = null; this.craft = null; this.tab = 'Construction';
    this.$ = (id) => document.getElementById(id);
    this.hotbarEl = this.$('hotbar');
    this.hotSlots = [];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('button'); s.className = 'slot'; s.setAttribute('aria-label', 'Hotbar slot ' + (i + 1));
      let lt = 0;
      s.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.select(i); clearTimeout(lt); lt = setTimeout(() => { this.game.dropHeld && this.game.dropHeld(true); }, 650); });
      const cancel = () => clearTimeout(lt);
      s.addEventListener('pointerup', cancel); s.addEventListener('pointerleave', cancel); s.addEventListener('pointercancel', cancel);
      this.hotbarEl.appendChild(s); this.hotSlots.push(s);
    }
    this.$('btn-inv').addEventListener('pointerdown', (e) => { e.stopPropagation(); this.openInventory(); });
    this.$('inv-close').addEventListener('click', () => this.close());
    this.inv.onChange = () => this.renderHotbar();
    this.nameTimer = 0;
    this.lastStats = '';
  }
  select(i) {
    this.inv.sel = i; this.renderHotbar(); sfx.click();
    const h = this.inv.held(); const el = this.$('item-name');
    if (h) { el.textContent = itemName(h.id) + (h.ench ? ' (' + enchText(h.ench) + ')' : ''); el.classList.toggle('ench', !!h.ench); el.classList.add('show'); clearTimeout(this.nameTimer); this.nameTimer = setTimeout(() => el.classList.remove('show'), 1800); }
    else el.classList.remove('show');
    this.game.onHeldChange && this.game.onHeldChange();
  }
  slotHTML(s) {
    if (!s) return '';
    let h = `<img src="${iconFor(s.id)}" alt="">`;
    if (s.ench) h += '<span class="glint"></span>';
    if (s.count > 1) h += `<span class="cnt">${s.count}</span>`;
    const md = maxDur(s.id);
    if (md && s.dur < md) { const p = s.dur / md; h += `<span class="dur"><i style="width:${p * 100}%;background:hsl(${p * 120},90%,50%)"></i></span>`; }
    return h;
  }
  renderHotbar() {
    for (let i = 0; i < 9; i++) { const el = this.hotSlots[i]; el.innerHTML = this.slotHTML(this.inv.slots[i]); el.classList.toggle('sel', i === this.inv.sel); }
    this.game.onHeldChange && this.game.onHeldChange();
    if (this.screen) this.renderScreen();
  }
  renderStats(p, mode) {
    const key = [mode, Math.ceil(p.health), Math.ceil(p.food), Math.ceil(p.air / 30), p.level, Math.round(p.xp * 50)].join(',');
    if (key === this.lastStats) return; this.lastStats = key;
    const I = icons(); const show = mode === 'survival';
    const hearts = this.$('hearts'), hunger = this.$('hunger'), bub = this.$('bubbles');
    document.getElementById('stats').style.visibility = show ? 'visible' : 'hidden';
    this.$('xp').style.visibility = show ? 'visible' : 'hidden';
    if (!show) return;
    let h = '';
    for (let i = 0; i < 10; i++) { const v = p.health - i * 2; h += `<img src="${v >= 2 ? I.h : v >= 1 ? I.hh : I.he}" alt="">`; }
    hearts.innerHTML = h;
    let f = '';
    for (let i = 9; i >= 0; i--) { const v = p.food - i * 2; f += `<img src="${v >= 2 ? I.f : v >= 1 ? I.fh : I.fe}" alt="">`; }
    hunger.innerHTML = f;
    let b = ''; if (p.air < 300) { const n = Math.ceil(p.air / 30); for (let i = 0; i < n; i++) b += `<img src="${I.b}" alt="">`; }
    bub.innerHTML = b;
    this.$('xp-fill').style.width = (p.xp * 100) + '%';
    this.$('xp-level').textContent = p.level > 0 ? p.level : '';
  }
  // ---------- screens ----------
  openInventory() {
    if (this.game.mode === 'creative') return this.open('creative');
    this.open('inv');
  }
  open(kind, tile) {
    this.screen = kind; this.tile = tile || null;
    if (kind === 'inv') this.craft = { n: 2, grid: new Array(4).fill(null) };
    else if (kind === 'table') this.craft = { n: 3, grid: new Array(9).fill(null) };
    else this.craft = null;
    this.$('inv').classList.remove('hidden');
    this.$('inv-title').textContent = { inv: 'Inventory', table: 'Crafting', furnace: 'Furnace', chest: 'Chest', enchant: 'Enchant', creative: 'Creative Inventory', trade: 'Villager' }[kind];
    if (kind === 'trade' && tile && tile.mob) this.$('inv-title').textContent = (tile.mob.prof || 'villager').replace(/^./, (c) => c.toUpperCase()) + ' — Trades';
    this.game.onScreenOpen();
    this.renderScreen();
  }
  close() {
    if (!this.screen) return;
    if (this.craft) for (let i = 0; i < this.craft.grid.length; i++) { const s = this.craft.grid[i]; if (s) this.giveBack(s); }
    if (this.tile && this.tile.type === 'enchant') for (let i = 0; i < 2; i++) { const s = this.tile.slots[i]; if (s) this.giveBack(s); this.tile.slots[i] = null; }
    if (this.cursor) { this.giveBack(this.cursor); this.cursor = null; }
    this.craft = null; this.screen = null; this.tile = null;
    this.$('inv').classList.add('hidden');
    this.game.onScreenClose();
    this.renderHotbar();
  }
  giveBack(s) { const left = this.inv.add(s.id, s.count, s.dur, s.ench); if (left > 0) this.game.dropFromPlayer(s.id, left, s.dur, s.ench); }
  makeSlot(arr, i, opts = {}) {
    const el = document.createElement('button'); el.className = 'slot' + (opts.cls ? ' ' + opts.cls : '');
    el.innerHTML = this.slotHTML(arr ? arr[i] : opts.stack);
    let t = 0, longDone = false;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.pressing = true; longDone = false; clearTimeout(t); t = setTimeout(() => { longDone = true; (opts.onTap || ((l) => this.slotTap(arr, i, l)))(true); }, 420); });
    const up = () => { this.pressing = false; clearTimeout(t); if (!longDone) (opts.onTap || ((l) => this.slotTap(arr, i, l)))(false); longDone = true; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', () => { this.pressing = false; clearTimeout(t); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    return el;
  }
  slotTap(arr, i, long) {
    const s = arr[i], c = this.cursor;
    if (!c) {
      if (!s) return;
      if (long && s.count > 1) { const n = Math.ceil(s.count / 2); this.cursor = { ...s, count: n }; s.count -= n; }
      else { this.cursor = s; arr[i] = null; }
    } else {
      if (this.tile && this.tile.type === 'furnace' && arr === this.tile.slots && i === 2) return; // output only
      if (this.tile && this.tile.type === 'enchant' && arr === this.tile.slots && i === 1 && c.id !== I.LAPIS) return; // lapis only
      if (this.tile && this.tile.type === 'enchant' && arr === this.tile.slots && i === 0 && !s && c.count > 1) { arr[0] = { ...c, count: 1 }; c.count--; sfx.click(); this.renderScreen(); this.renderHotbar(); return; }
      if (!s) {
        if (long) { arr[i] = { ...c, count: 1 }; c.count--; if (c.count <= 0) this.cursor = null; }
        else { arr[i] = c; this.cursor = null; }
      } else if (s.id === c.id && maxStack(s.id) > 1) {
        const room = maxStack(s.id) - s.count; const n = Math.min(room, long ? 1 : c.count);
        s.count += n; c.count -= n; if (c.count <= 0) this.cursor = null;
      } else { arr[i] = c; this.cursor = s; }
    }
    sfx.click();
    this.renderScreen(); this.renderHotbar();
  }
  craftResult() {
    if (!this.craft) return null;
    const ids = this.craft.grid.map((s) => (s ? s.id : 0));
    return matchRecipe(ids, this.craft.n);
  }
  takeCraft(long) {
    const r = this.craftResult(); if (!r) return;
    const doOne = () => {
      const r2 = this.craftResult(); if (!r2 || r2 !== r) return false;
      for (let i = 0; i < this.craft.grid.length; i++) { const s = this.craft.grid[i]; if (s) { s.count--; if (s.count <= 0) this.craft.grid[i] = null; } }
      return true;
    };
    if (long) {
      let n = 0; while (n < 64 && doOne()) { const left = this.inv.add(r.out, r.count); if (left) this.game.dropFromPlayer(r.out, left); n++; }
    } else {
      const c = this.cursor;
      if (c && (c.id !== r.out || c.count + r.count > maxStack(r.out))) return;
      if (!doOne()) return;
      if (c) c.count += r.count; else this.cursor = { id: r.out, count: r.count, dur: maxDur(r.out) };
    }
    sfx.craft();
    this.game.stats.crafted++;
    this.renderScreen(); this.renderHotbar();
  }
  renderScreen() {
    const body = this.$('inv-body'); body.innerHTML = ''; body.classList.remove('split');
    const kind = this.screen; if (!kind) return;
    const grid = (arr, from, to, cols, opts) => {
      const g = document.createElement('div'); g.className = 'grid'; g.style.gridTemplateColumns = `repeat(${cols}, var(--slot-size))`;
      for (let i = from; i < to; i++) g.appendChild(this.makeSlot(arr, i, opts)); return g;
    };
    const label = (t) => { const d = document.createElement('div'); d.className = 'inv-label'; d.textContent = t; return d; };
    if (kind === 'creative') {
      const tabs = document.createElement('div'); tabs.className = 'tabs';
      for (const t of Object.keys(TABS)) { const b = document.createElement('button'); b.textContent = t; b.className = t === this.tab ? 'on' : ''; b.onclick = () => { this.tab = t; this.renderScreen(); }; tabs.appendChild(b); }
      body.appendChild(tabs);
      const list = CREATIVE_LIST.filter(TABS[this.tab]);
      const g = document.createElement('div'); g.className = 'grid creative-grid'; g.style.gridTemplateColumns = 'repeat(9, var(--slot-size))';
      for (const id of list) {
        const el = this.makeSlot(null, 0, { stack: { id, count: 1 }, onTap: (long) => {
          const st = { id, count: long ? 1 : maxStack(id), dur: maxDur(id) };
          this.inv.slots[this.inv.sel] = st; sfx.pop(); this.renderHotbar();
        } });
        el.title = itemName(id); g.appendChild(el);
      }
      body.appendChild(g);
      body.appendChild(label('Hotbar — tap a slot, then tap an item above'));
      const row = document.createElement('div'); row.className = 'inv-top';
      const hb = document.createElement('div'); hb.className = 'grid'; hb.style.gridTemplateColumns = 'repeat(9, var(--slot-size))';
      for (let i = 0; i < 9; i++) {
        const el = this.makeSlot(null, 0, { stack: this.inv.slots[i], cls: i === this.inv.sel ? 'picked' : '', onTap: () => { this.inv.sel = i; this.renderHotbar(); } });
        hb.appendChild(el);
      }
      row.appendChild(hb);
      const tr = document.createElement('button'); tr.className = 'slot trash'; tr.textContent = '✕'; tr.setAttribute('aria-label', 'Clear selected slot');
      tr.onclick = () => { this.inv.slots[this.inv.sel] = null; this.renderHotbar(); };
      row.appendChild(tr);
      body.appendChild(row);
      this.$('cursor-item').innerHTML = '';
      return;
    }
    body.classList.add('split'); body.parentElement.classList.toggle('chest', !!(this.tile && this.tile.type === 'chest'));
    const left = document.createElement('div'); left.className = 'inv-col';
    const right = document.createElement('div'); right.className = 'inv-col';
    const top = document.createElement('div'); top.className = 'inv-top';
    if (this.craft) {
      left.appendChild(label(this.craft.n === 2 ? 'Crafting' : 'Crafting Table'));
      top.appendChild(grid(this.craft.grid, 0, this.craft.grid.length, this.craft.n));
      const ar = document.createElement('div'); ar.className = 'arrow'; ar.textContent = '➜'; top.appendChild(ar);
      const r = this.craftResult();
      top.appendChild(this.makeSlot(null, 0, { stack: r ? { id: r.out, count: r.count } : null, cls: 'out', onTap: (l) => this.takeCraft(l) }));
    } else if (this.tile && this.tile.type === 'furnace') {
      const t = this.tile;
      left.appendChild(label('Smelt (top) · Fuel (bottom)'));
      const col = document.createElement('div'); col.className = 'furnace-mid';
      col.appendChild(this.makeSlot(t.slots, 0));
      const fl = document.createElement('div'); fl.className = 'flame'; fl.style.setProperty('--f', (t.burnMax ? t.burn / t.burnMax * 100 : 0) + '%'); col.appendChild(fl);
      col.appendChild(this.makeSlot(t.slots, 1));
      top.appendChild(col);
      const pr = document.createElement('div'); pr.className = 'progress'; pr.style.setProperty('--p', (t.cook / 8 * 100) + '%'); top.appendChild(pr);
      top.appendChild(this.makeSlot(t.slots, 2, { cls: 'out' }));
    } else if (this.tile && this.tile.type === 'trade') {
      const m = this.tile.mob; const inv = this.inv;
      left.appendChild(label('Emeralds: ' + inv.count(127)));
      const list = document.createElement('div'); list.className = 'trade-list';
      m.trades.forEach((t, ti) => {
        const row = document.createElement('div'); row.className = 'trade-row';
        const can = inv.count(t.cost[0]) >= t.cost[1] && t.uses < t.max;
        const mk = (id, n) => { const e = document.createElement('span'); e.className = 'slot'; e.innerHTML = this.slotHTML({ id, count: n }); e.title = itemName(id); return e; };
        row.appendChild(mk(t.cost[0], t.cost[1]));
        const ar = document.createElement('span'); ar.className = 'arrow'; ar.textContent = '➜'; row.appendChild(ar);
        row.appendChild(mk(t.out[0], t.out[1]));
        const nm = document.createElement('span'); nm.className = 'trade-name'; nm.textContent = itemName(t.out[0]); row.appendChild(nm);
        const btn = document.createElement('button'); btn.className = 'btn trade-btn'; btn.textContent = t.uses >= t.max ? 'Sold out' : 'Trade'; btn.disabled = !can;
        btn.addEventListener('click', () => {
          const tt = m.trades[ti]; if (inv.count(tt.cost[0]) < tt.cost[1] || tt.uses >= tt.max) { sfx.villagerNo && sfx.villagerNo(); return; }
          inv.remove(tt.cost[0], tt.cost[1]); const left = inv.add(tt.out[0], tt.out[1]); if (left) this.game.dropFromPlayer(tt.out[0], left);
          tt.uses++; sfx.trade && sfx.trade(); if (Math.random() < 0.5) sfx.villager && sfx.villager(); m.lookP = 8;
          this.game.addXP && this.game.addXP(3);
          this.renderScreen(); this.renderHotbar();
        });
        row.appendChild(btn); list.appendChild(row);
      });
      left.appendChild(list); body.appendChild(left);
    } else if (this.tile && this.tile.type === 'enchant') {
      const t = this.tile; const g = this.game;
      left.appendChild(label('Bookshelves: ' + t.shelves + (g.mode === 'creative' ? ' · Creative' : ' · Level ' + g.player.level)));
      const wrap = document.createElement('div'); wrap.className = 'ench-wrap';
      const slotsCol = document.createElement('div'); slotsCol.className = 'ench-slots';
      const s0 = this.makeSlot(t.slots, 0); s0.title = 'Item'; slotsCol.appendChild(s0);
      const s1 = this.makeSlot(t.slots, 1, { cls: 'lapis-slot' }); s1.title = 'Lapis Lazuli'; slotsCol.appendChild(s1);
      wrap.appendChild(slotsCol);
      const opts = document.createElement('div'); opts.className = 'ench-opts';
      const list = g.enchantOptions ? g.enchantOptions(t) : [];
      const item = t.slots[0];
      for (let k = 0; k < 3; k++) {
        const o = list[k]; const b = document.createElement('button'); b.className = 'ench-opt';
        if (!o) { b.disabled = true; b.innerHTML = '<span class="glyph">' + (item ? (item.ench ? 'Already enchanted' : enchKind(item.id) ? '' : 'Cannot be enchanted') : '') + '</span>'; opts.appendChild(b); continue; }
        const lapis = t.slots[1] ? t.slots[1].count : 0;
        const ok = g.mode === 'creative' || (g.player.level >= o.cost && lapis >= k + 1);
        b.disabled = !ok;
        const first = Object.keys(o.ench)[0];
        b.innerHTML = `<span class="glyph">${ENCH[first].name}${ENCH[first].max > 1 ? ' ' + ['', 'I', 'II', 'III', 'IV', 'V'][o.ench[first]] : ''}${Object.keys(o.ench).length > 1 ? ' . . . ?' : ''}</span><span class="cost"><b>${o.cost}</b> lvl · ${k + 1} lapis</span>`;
        b.addEventListener('click', () => { if (g.applyEnchant && g.applyEnchant(t, k)) { this.renderScreen(); this.renderHotbar(); } });
        opts.appendChild(b);
      }
      wrap.appendChild(opts); top.appendChild(wrap);
    } else if (this.tile && this.tile.type === 'chest') {
      left.appendChild(label('Chest'));
      top.appendChild(grid(this.tile.slots, 0, 27, 9));
    }
    if (top.childNodes.length) { left.appendChild(top); if (this.craft) { const h = document.createElement('div'); h.className = 'inv-hint'; h.textContent = 'Hold the result to craft all'; left.appendChild(h); } body.appendChild(left); }
    right.appendChild(label('Inventory'));
    right.appendChild(grid(this.inv.slots, 9, 36, 9));
    const hb = grid(this.inv.slots, 0, 9, 9); hb.style.marginTop = '6px'; right.appendChild(hb);
    body.appendChild(right);
    const ci = this.$('cursor-item');
    ci.innerHTML = this.cursor ? `Holding: <span class="slot" style="--slot-size:34px">${this.slotHTML(this.cursor)}</span> ${itemName(this.cursor.id)} — tap a slot to place, hold to place one` : '';
  }
}
export { SMELT, FUEL, BLOCKS, ITEMS };
