(() => {
  const C = window.SITE_CONFIG || {};
  const I = window.I18N;
  const QUIZ = {
    p: [['pq1', ['skin', 'beauty', 'well']], ['pq2', ['self', 'gift', 'family']], ['pq3', ['low', 'mid', 'high']]],
    b: [['bq1', ['discount', 'income', 'leader']], ['bq2', ['few', 'daily', 'full']], ['bq3', ['none', 'sales', 'mlm']]],
  };
  const CHIPS = ['var(--mint)', 'var(--lilac)', 'var(--cloud)'];
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const source = (new URLSearchParams(location.search).get('utm_source') || '').replace(/[^\w-]/g, '').slice(0, 40);

  const state = { lang: pickLang(), branch: null, step: 0, answers: [], sent: false };
  const quizEl = document.getElementById('quiz');

  function pickLang() {
    try {
      const saved = localStorage.getItem('lang');
      if (saved && I[saved]) return saved;
    } catch (e) { /* хранилище недоступно — берём язык браузера */ }
    const nav = (navigator.language || 'ru').slice(0, 2).toLowerCase();
    return I[nav] ? nav : (nav === 'kz' ? 'kk' : 'ru');
  }

  function tr(key, vars = {}) {
    let text = (I[state.lang] && I[state.lang][key]) ?? I.ru[key] ?? key;
    const all = { consultant: C.consultantName || '', open: C.workStart ?? 9, close: C.workEnd ?? 21, ...vars };
    for (const [k, v] of Object.entries(all)) text = text.replaceAll(`{${k}}`, v);
    return text;
  }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  }

  // ---------- ссылки ----------
  const tgUrl = () => C.botUsername ? `https://t.me/${C.botUsername}?start=${source ? 'site_' + source : 'site'}` : '';
  const waUrl = (extra) => {
    if (!digits(C.whatsapp)) return '';
    const base = `https://wa.me/${digits(C.whatsapp)}`;
    return extra ? `${base}?text=${encodeURIComponent(extra)}` : base;
  };

  function applyStatic() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = tr(node.dataset.i18n); });
    document.getElementById('consultant-name').textContent = C.consultantName || '';
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    const links = { tg: tgUrl(), wa: waUrl() };
    let any = false;
    document.querySelectorAll('[data-link]').forEach((a) => {
      const url = links[a.dataset.link];
      a.hidden = !url;
      if (url) { a.href = url; any = true; }
    });
    document.getElementById('bar').hidden = !any;
  }

  // ---------- подбор ----------
  function swatches(items) {
    const box = el('div', { class: 'swatches', style: `--n:${items.length}` });
    items.forEach((item, i) => {
      box.append(el('button', { type: 'button', class: 'swatch', style: `--c:${CHIPS[i % CHIPS.length]}`, onclick: item.pick }, [
        el('span', { class: 'swatch__chip' }),
        el('span', { class: 'swatch__label', text: item.label }),
      ]));
    });
    return box;
  }

  function meta(progress) {
    const back = state.branch
      ? el('button', { type: 'button', class: 'quiz__back', text: tr('back'), onclick: goBack })
      : el('span');
    const fill = el('div', { class: 'quiz__fill' });
    requestAnimationFrame(() => { fill.style.width = `${progress * 100}%`; });
    return [
      el('div', { class: 'quiz__meta' }, [
        el('span', { text: state.branch && state.step < 3 ? tr('progress', { n: state.step + 1 }) : '' }),
        back,
      ]),
      el('div', { class: 'quiz__track' }, fill),
    ];
  }

  function goBack() {
    if (state.step === 0) state.branch = null;
    else { state.step -= 1; state.answers.length = state.step; }
    render();
  }

  function start(branch) {
    Object.assign(state, { branch, step: 0, answers: [], sent: false });
    render();
    quizEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function render() {
    quizEl.replaceChildren();
    // короткое появление нового вопроса — ответ на нажатие
    quizEl.classList.remove('is-step');
    void quizEl.offsetWidth;
    quizEl.classList.add('is-step');
    if (!state.branch) {
      quizEl.append(
        ...meta(0),
        el('p', { class: 'quiz__q', text: tr('quiz_start') }),
        swatches([
          { label: tr('path_p'), pick: () => start('p') },
          { label: tr('path_b'), pick: () => start('b') },
        ]),
      );
      return;
    }
    const steps = QUIZ[state.branch];
    if (state.step < steps.length) {
      const [key, options] = steps[state.step];
      quizEl.append(
        ...meta(state.step / steps.length),
        el('p', { class: 'quiz__q', text: tr(key) }),
        swatches(options.map((o) => ({
          label: tr(`${key}_${o}`),
          pick: () => { state.answers[state.step] = o; state.step += 1; render(); },
        }))),
      );
      return;
    }
    renderResult();
  }

  function renderResult() {
    const resKey = `res_${state.branch}_${state.answers[0]}`;
    const title = tr(`${resKey}_t`);
    const actions = el('div', { class: 'result__actions' });
    const link = (url, label, cls) => url && actions.append(
      el('a', { class: `btn ${cls}`, href: url, target: '_blank', rel: 'noopener', text: label }));
    if (state.branch === 'p') link(C.shopUrl, tr('cta_order'), 'btn--accent');
    else link(C.joinUrl, tr('cta_join'), 'btn--accent');
    link(tgUrl(), tr('cta_tg'), '');
    link(waUrl(`${tr('wa_text')} ${title}`), tr('cta_wa'), '');

    // null отбрасываем: append() превратил бы его в текст «null»
    quizEl.append(...[
      ...meta(1),
      el('p', { class: 'result__title', text: title }),
      el('p', { class: 'result__text', text: tr(resKey) }),
      state.branch === 'b' ? el('p', { class: 'result__note', text: tr('income_note') }) : null,
      actions.children.length ? actions : null,
      C.sheetsUrl ? leadForm(resKey) : null,
      el('button', { type: 'button', class: 'quiz__back result__restart', text: tr('restart'), onclick: () => { state.branch = null; render(); } }),
    ].filter(Boolean));
  }

  // ---------- форма заявки ----------
  function leadForm(resKey) {
    const msg = el('p', { class: 'lead-form__msg', role: 'status' });
    if (state.sent) {
      msg.dataset.kind = 'ok';
      msg.textContent = tr('f_sent');
      return el('div', { class: 'lead-form' }, msg);
    }
    const name = el('input', { type: 'text', name: 'name', autocomplete: 'given-name', maxlength: 80 });
    const phone = el('input', { type: 'tel', name: 'phone', autocomplete: 'tel', inputmode: 'tel', maxlength: 20, placeholder: '+7 701 123 45 67' });
    const consent = el('input', { type: 'checkbox', name: 'consent' });
    const trap = el('input', { type: 'text', name: 'website', class: 'trap', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    const submit = el('button', { type: 'submit', class: 'btn btn--ink', text: tr('f_submit') });
    const fail = (key) => { msg.dataset.kind = 'error'; msg.textContent = tr(key); };

    const form = el('form', { class: 'lead-form', novalidate: true }, [
      el('p', { class: 'lead-form__title', text: tr('form_title') }),
      el('p', { text: tr('form_text') }),
      el('label', {}, [tr('f_name'), name]),
      el('label', {}, [tr('f_phone'), phone]),
      el('label', { class: 'consent' }, [consent, el('span', { text: tr('f_consent') })]),
      trap, submit, msg,
    ]);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = phone.value.trim();
      if (!/^\+?[\d\s()-]{7,20}$/.test(value) || digits(value).length < 10) { fail('err_phone'); phone.focus(); return; }
      if (!consent.checked) { fail('err_consent'); consent.focus(); return; }
      submit.disabled = true;
      submit.textContent = tr('f_sending');
      msg.textContent = '';
      const steps = QUIZ[state.branch];
      const payload = {
        channel: 'site', event: 'lead',
        name: name.value.trim(), phone: value, lang: state.lang,
        branch: state.branch === 'p' ? 'product' : 'business',
        answers: state.answers.map((a, i) => I.ru[`${steps[i][0]}_${a}`]).join(' / '),
        result: resKey, source, website: trap.value,
      };
      try {
        // Apps Script не отдаёт CORS-заголовки: шлём «вслепую», успех = запрос ушёл
        await fetch(C.sheetsUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
        state.sent = true;
        form.replaceWith(leadForm(resKey));
      } catch (e) {
        submit.disabled = false;
        submit.textContent = tr('f_submit');
        fail('err_send');
      }
    });
    return form;
  }

  // ---------- запуск ----------
  document.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', () => {
    state.lang = button.dataset.lang;
    try { localStorage.setItem('lang', state.lang); } catch (e) { /* не страшно: язык просто не запомнится */ }
    applyStatic();
    render();
  }));
  document.querySelectorAll('[data-start]').forEach((button) => button.addEventListener('click', () => start(button.dataset.start)));

  applyStatic();
  render();
})();
