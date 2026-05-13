(function () {
  'use strict';

  const BASE  = 'https://nocapsai-proxy.azurewebsites.net/api/proxy';
  const AGENT = 'asst_EcRoLhooreP8UEUvTaYhIA';

  let threadId = null;
  let isLoading = false;

  /* ── API helpers ─────────────────────────────────────────── */
  async function api(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Azure API ${res.status}: ${err}`);
    }
    return res.json();
  }

  async function chat(userText) {
    if (!threadId) {
      const t = await api('POST', '/threads', {});
      threadId = t.id;
    }
    await api('POST', `/threads/${threadId}/messages`, { role: 'user', content: userText });
    const run = await api('POST', `/threads/${threadId}/runs`, { assistant_id: AGENT });
    let runStatus = run.status;
    while (runStatus === 'queued' || runStatus === 'in_progress') {
      await new Promise(r => setTimeout(r, 1200));
      const polled = await api('GET', `/threads/${threadId}/runs/${run.id}`);
      runStatus = polled.status;
    }
    if (runStatus !== 'completed') throw new Error(`Run ended with status: ${runStatus}`);
    const msgs = await api('GET', `/threads/${threadId}/messages`);
    const latest = msgs.data.find(m => m.role === 'assistant');
    return latest ? latest.content.map(c => c.text?.value || '').join('') : '(no response)';
  }

  /* ── Styles ───────────────────────────────────────────────── */
  const css = `
    #ncw-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #00ff7f;
      box-shadow: 0 4px 18px rgba(0,255,127,0.45);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #ncw-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(0,255,127,0.6); }
    #ncw-bubble svg { width: 26px; height: 26px; fill: #06121a; }

    #ncw-panel {
      position: fixed;
      bottom: 90px;
      right: 24px;
      width: 340px;
      max-width: calc(100vw - 32px);
      height: 480px;
      max-height: calc(100vh - 110px);
      background: #0d1f2d;
      border: 1px solid rgba(0,255,127,0.25);
      border-radius: 16px;
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 9998;
      box-shadow: 0 8px 40px rgba(0,0,0,0.55);
      font-family: Arial, Helvetica, sans-serif;
    }
    #ncw-panel.open { display: flex; }

    #ncw-header {
      background: #001a33;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(0,255,127,0.18);
      flex-shrink: 0;
    }
    #ncw-header-title {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #e8f4ee;
      font-weight: 700;
      font-size: 14px;
    }
    #ncw-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #00ff7f;
      box-shadow: 0 0 6px #00ff7f;
    }
    #ncw-close {
      background: none;
      border: none;
      color: #7ea4a8;
      font-size: 20px;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }
    #ncw-close:hover { color: #fff; }

    #ncw-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,255,127,0.2) transparent;
    }
    #ncw-messages::-webkit-scrollbar { width: 4px; }
    #ncw-messages::-webkit-scrollbar-thumb { background: rgba(0,255,127,0.2); border-radius: 4px; }

    .ncw-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13.5px;
      line-height: 1.5;
      word-break: break-word;
    }
    .ncw-msg.user {
      background: rgba(0,255,127,0.12);
      color: #d8f0e0;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .ncw-msg.agent {
      background: #16313f;
      color: #c8dfe8;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }
    .ncw-msg.typing { color: #7ea4a8; font-style: italic; }

    #ncw-input-row {
      display: flex;
      gap: 8px;
      padding: 12px 14px;
      border-top: 1px solid rgba(0,255,127,0.12);
      background: #001a33;
      flex-shrink: 0;
    }
    #ncw-input {
      flex: 1;
      background: #0d2235;
      border: 1px solid rgba(0,255,127,0.2);
      border-radius: 8px;
      color: #e8f4ee;
      font-size: 13px;
      padding: 9px 12px;
      outline: none;
    }
    #ncw-input::placeholder { color: #4a7080; }
    #ncw-input:focus { border-color: rgba(0,255,127,0.5); }
    #ncw-send {
      background: #00ff7f;
      color: #06121a;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      padding: 9px 14px;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    #ncw-send:hover { opacity: 0.85; }
    #ncw-send:disabled { opacity: 0.4; cursor: default; }
  `;

  /* ── DOM ─────────────────────────────────────────────────── */
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  const bubble = document.createElement('div');
  bubble.id = 'ncw-bubble';
  bubble.title = 'Chat with NoCapsAI';
  bubble.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 10H6v-2h12v2zm0-3H6V7h12v2z"/>
  </svg>`;

  const panel = document.createElement('div');
  panel.id = 'ncw-panel';
  panel.innerHTML = `
    <div id="ncw-header">
      <div id="ncw-header-title">
        <div id="ncw-dot"></div>
        NoCapsAI Assistant
      </div>
      <button id="ncw-close" aria-label="Close chat">×</button>
    </div>
    <div id="ncw-messages">
      <div class="ncw-msg agent">Hey! I'm the NoCapsAI assistant. Ask me anything about AI readiness, our services, or how we can help your business.</div>
    </div>
    <div id="ncw-input-row">
      <input id="ncw-input" type="text" placeholder="Type your question…" autocomplete="off" maxlength="500">
      <button id="ncw-send">Send</button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  /* ── Logic ───────────────────────────────────────────────── */
  const messagesEl = panel.querySelector('#ncw-messages');
  const inputEl    = panel.querySelector('#ncw-input');
  const sendBtn    = panel.querySelector('#ncw-send');

  function togglePanel() {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) inputEl.focus();
  }

  function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = `ncw-msg ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text || isLoading) return;
    isLoading = true;
    inputEl.value = '';
    sendBtn.disabled = true;
    addMessage(text, 'user');
    const typing = addMessage('Thinking…', 'agent typing');
    try {
      const reply = await chat(text);
      typing.textContent = reply;
      typing.classList.remove('typing');
    } catch (e) {
      typing.textContent = 'Sorry, something went wrong. Try again in a moment.';
      typing.classList.remove('typing');
      console.error('NoCapsAI chat error:', e);
    }
    isLoading = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }

  bubble.addEventListener('click', togglePanel);
  panel.querySelector('#ncw-close').addEventListener('click', togglePanel);
  sendBtn.addEventListener('click', handleSend);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });

})();
