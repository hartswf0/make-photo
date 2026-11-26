// Passengers who talk. Each has a persona and a memory stream of what has happened to them on this ride.
// With a key they answer through a language model; without one they answer from their own lines.
// This continues two earlier pieces: el-desierto's Train Field (Noor, Mila, Oren and Cass, each seeing different things from the same train,
// every thought a ticket stub) and island-ecology's hive simulation (a persona plus a memory stream). A key saved by either of those pages
// on this site is picked up here, because they share the browser's storage.
const $ = id => document.getElementById(id);
export const PERSONAS = {
  imani: { name: 'Imani', role: 'carrier, riding without her donkey', voice: 'dry, practical, counts everything in litres', sees: ['WATER', 'THE DOOR', 'YOUR HANDS'] },
  elder: { name: 'Oren', role: 'old man who has ridden this line since it was steam', voice: 'slow, remembers the old route, half asleep', sees: ['OLD ROUTE', 'BRAKE SOUND', 'DARK TUNNEL', 'KNEE'] },
  matriarch: { name: 'Almaz', role: 'matriarch at the head table', voice: 'commanding, amused, speaks in verdicts', sees: ['THE TABLE', 'WHO STANDS', 'THE VIOLIN'] },
  researcher: { name: 'Noor', role: 'dispatcher guarding a crate she will not explain', voice: 'clipped, checking a clock, deflects', sees: ['DELAY SIGN', 'THE CRATE', 'PHONE BUZZ', 'CONDUCTOR'] },
  rahel: { name: 'Mila', role: 'student with nine percent battery', voice: 'quick, distracted, half on her phone', sees: ['SCREEN', 'BATTERY 9%', 'EMPTY SEAT', 'YOU'] },
  child: { name: 'June', role: 'child dancing in the greenhouse rain', voice: 'short sentences, asks questions back, unafraid of bees', sees: ['RAIN', 'BEES', 'YOUR HAT'] },
  beekeeper: { name: 'Makeda', role: 'retired beekeeper who takes only half', voice: 'patient, exact, speaks of the bees as them', sees: ['THE FRAME', 'THE SMOKE', 'HALF'] },
  saba: { name: 'Cass', role: 'tourist who boarded the wrong train', voice: 'cheerful, lost, clutching a map and a ticket', sees: ['MONEY', 'MAP', 'COFFEE', 'WINDOW', 'TICKET', 'BAG'] },
  watcher: { name: 'the Watcher', role: 'operator of the screens', voice: 'flat, a few seconds ahead of you', sees: ['SCREEN 4', 'YOU, FROM BEHIND', 'THE NEXT DOOR'] },
  bride: { name: 'the Old Bride', role: 'has watched this film every night', voice: 'tender, theatrical, quotes the film', sees: ['THE SCREEN', 'THE BEAM', 'THE ARRIVAL'] },
  conductor: { name: 'Bekele', role: 'conductor, keeper of the cab key', voice: 'formal, tired, wants to see stubs', sees: ['TICKETS', 'THE TIME', 'THE ENGINE'] },
  musician: { name: 'Yared', role: 'musician at the end of the dining car', voice: 'gentle, answers in images, names the scale', sees: ['THE STRINGS', 'THE ROOM', 'TEZETA'] },
};
const LINES = { default: ['The window is the only thing in here that changes.', 'You are walking the wrong way for someone with a ticket.', 'They were not on the train when it left.', 'Ask me again after the tunnel.'],
  stung: ['A bee. In here. I felt it.', 'That was you, wasn’t it. I saw the way it flew.', 'Half for me, half for them, and none of it was that.'], robbed: ['My tin. You took my tin.', 'I counted them. I had one more.'] };

export function createTalk({ game, stub }) {
  const mem = new Map(), cfg = () => { let a = {}; try { a = JSON.parse(localStorage.getItem('sealed_line_key') || localStorage.getItem('ticket_stub_train_key_v1') || '{}'); } catch { } const hk = localStorage.getItem('hive_api_key');
    return { key: a.apiKey || hk || '', endpoint: a.endpoint || (hk ? (localStorage.getItem('hive_base') || 'https://api.openai.com/v1') + '/chat/completions' : ''), model: a.model || localStorage.getItem('hive_model') || 'gpt-4.1-mini' }; };
  const personaOf = p => PERSONAS[p.id] || { name: p.role, role: p.role, voice: 'plain', sees: [] };
  /** Something happened to this passenger; it goes in their stream and colours what they say next. */
  function remember(p, text) { const m = mem.get(p.key) || []; m.push(text); if (m.length > 14) m.shift(); mem.set(p.key, m); }
  async function ask(p, said, ctx) {
    const per = personaOf(p), c = cfg(), m = mem.get(p.key) || []; remember(p, `The traveler said: "${said}"`);
    // without a key they still answer the question that was asked, from who they are and what has happened to them
    const fallback = () => { const q = said.toLowerCase(), hurt = m.some(x => /stung/.test(x)), robbed = m.some(x => /robbed/.test(x));
      if (/who|name|you\b.*\?$/.test(q) && /who|name/.test(q)) return `${per.name}. ${per.role[0].toUpperCase() + per.role.slice(1)}.`;
      if (/next|door|car|ahead|behind/.test(q)) return ctx.next ? `Through that door? The ${ctx.next.toLowerCase()}. ${ctx.nextSub[0].toUpperCase() + ctx.nextSub.slice(1)}. More of them in there than in here.` : 'There is nothing after this one. You have run out of train.';
      if (/bee|sting|swarm|hive/.test(q)) return hurt ? 'One got me a minute ago. Ask it.' : ctx.bees === 'none' ? 'What bees? It is quiet in here. Keep it that way.' : `There are ${ctx.bees} in this car. They want the sweet thing, and failing that, a face.`;
      if (/spam|tin|can|food|hungry|have your/.test(q)) return robbed ? 'You already took it. Do not ask twice.' : 'It is in my pocket and it is staying there. Unless you are quicker than you look.';
      if (/train|where|going|stop/.test(q)) return 'It does not stop. It stands at the halt for a breath and then it goes on. I stopped asking where.';
      if (/see|look|window|watch/.test(q) && per.sees.length) return `I keep seeing the same things. ${per.sees.slice(0, 3).map(x => x.toLowerCase()).join(', ')}.`;
      const pool = hurt ? LINES.stung : robbed ? LINES.robbed : LINES.default; return pool[(m.length + said.length) % pool.length]; };
    if (!c.key || !c.endpoint) { const r = fallback(); remember(p, `I said: "${r}"`); return { text: r, live: false }; }
    const sys = `You are ${per.name}, ${per.role}, a passenger on a sealed train called the Sealed Line that never stops, crossing highlands. Voice: ${per.voice}. You notice: ${per.sees.join(', ')}. Bees are loose on the train and get worse toward the rear. Answer the traveler in one or two short spoken sentences, in character, concrete, no narration, no quotation marks. Never mention being an AI.`;
    const user = `Where: ${ctx.car}. Bees here: ${ctx.bees}. The traveler carries ${ctx.spam} tins of SPAM and has ${ctx.stings} stings. What has happened to you on this ride:\n${m.slice(-10).map(x => '- ' + x).join('\n') || '- nothing yet'}\n\nThe traveler says: "${said}"`;
    try { let body, headers = { 'Content-Type': 'application/json' };
      if (/anthropic/.test(c.endpoint)) { headers['x-api-key'] = c.key; headers['anthropic-version'] = '2023-06-01'; headers['anthropic-dangerous-direct-browser-access'] = 'true'; body = { model: c.model, max_tokens: 120, system: sys, messages: [{ role: 'user', content: user }] }; }
      else { headers.Authorization = 'Bearer ' + c.key; body = /\/responses/.test(c.endpoint) ? { model: c.model, input: sys + '\n\n' + user, max_output_tokens: 160 } : { model: c.model, max_tokens: 120, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }; }
      const r = await fetch(c.endpoint, { method: 'POST', headers, body: JSON.stringify(body) }), d = await r.json(); if (!r.ok) throw new Error(d.error?.message || 'HTTP ' + r.status);
      const text = (d.output_text || d.output?.flatMap(o => o.content || []).map(x => x.text).join(' ') || d.choices?.[0]?.message?.content || d.content?.[0]?.text || '').trim().replace(/^"|"$/g, ''); if (!text) throw new Error('empty reply');
      remember(p, `I said: "${text}"`); return { text, live: true };
    } catch (e) { const r = fallback(); remember(p, `I said: "${r}"`); return { text: r, live: false, error: e.message }; }
  }
  // ---- the conversation sheet
  let who = null, ctxFn = null, onSay = null;
  function open(p, getCtx, said) { who = p; ctxFn = getCtx; onSay = said; const per = personaOf(p); $('talk').hidden = false; $('talkName').textContent = per.name; $('talkRole').textContent = per.role; $('talkLog').textContent = ''; $('talkLive').textContent = cfg().key ? 'live voice' : 'own lines · add a key in ☰ → Voices'; line('them', (mem.get(p.key) || []).some(x => /stung/.test(x)) ? 'You again.' : 'Yes?'); }
  function close() { who = null; $('talk').hidden = true; }
  function line(k, t) { const d = document.createElement('p'); d.className = k; d.textContent = t; $('talkLog').append(d); $('talkLog').scrollTop = 1e6; return d; }
  async function say(text) { if (!who || !text.trim()) return; const p = who; line('me', text); const wait = line('them', '…'); const r = await ask(p, text.trim(), ctxFn()); wait.textContent = r.text; if (r.error) $('talkLive').textContent = 'own lines · the voice failed: ' + r.error.slice(0, 60); onSay && onSay(p, r.text); }
  $('talkForm').addEventListener('submit', e => { e.preventDefault(); const i = $('talkIn'); say(i.value); i.value = ''; }); $('talkClose').onclick = close;
  $('talkQuick').addEventListener('click', e => { const b = e.target.closest('button'); if (b) say(b.textContent); });
  for (const el of [$('talkIn'), $('keyIn'), $('endIn'), $('modelIn')]) el.addEventListener('keydown', e => e.stopPropagation());
  // ---- the key: kept in this browser only, sent only to the endpoint you name
  $('voiceBtn').onclick = () => { const c = cfg(); $('keyIn').value = c.key; $('endIn').value = c.endpoint || 'https://api.openai.com/v1/chat/completions'; $('modelIn').value = c.model; $('voices').hidden = false; document.body.classList.remove('menu'); };
  $('voiceSave').onclick = () => { localStorage.setItem('sealed_line_key', JSON.stringify({ apiKey: $('keyIn').value.trim(), endpoint: $('endIn').value.trim(), model: $('modelIn').value.trim() })); $('voices').hidden = true; stub('Voices', $('keyIn').value.trim() ? 'the passengers will answer live' : 'own lines only'); };
  $('voiceCancel').onclick = () => { $('voices').hidden = true; };
  return { open, close, remember, ask, personaOf, get openFor() { return who; }, hasKey: () => !!cfg().key, memory: p => (mem.get(p.key) || []).slice() };
}
