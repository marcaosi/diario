(() => {
  'use strict';

  const P = window.PLAN;
  const appEl = document.getElementById('app');
  const toastEl = document.getElementById('toast');

  const state = {
    view: 'carregando', // login | home | form | historico | resumo
    entries: {},
    draft: null,
    editandoData: null,
    step: 0,
    periodo: 7,
    periodoNutri: 7,
    erroLogin: '',
    salvando: false,
  };

  // ---------------- Utilidades ----------------
  const hoje = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso local
  const parseData = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const somaDias = (s, n) => { const d = parseData(s); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const fmtData = (s) => {
    const d = parseData(s);
    return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const fmtDataLonga = (s) => parseData(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtNum = (n) => (n == null || Number.isNaN(n) ? '–' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  const setPath = (o, p, v) => {
    const ks = p.split('.');
    let a = o;
    ks.slice(0, -1).forEach((k) => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; });
    a[ks[ks.length - 1]] = v;
  };
  const media = (arr) => { const v = arr.filter((x) => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const nomeTreino = (id) => (P.treinos.find((t) => t.id === id) || {}).nome || id;
  const nomeAtividade = (id) => (P.atividades.find((a) => a.id === id) || {}).nome || id;
  const ehPerna = (e) => e && e.treino && P.treinosDePerna.includes(e.treino.tipo);
  const fezMuay = (e) => e && e.atividades && (e.atividades.lista || []).includes('muaythai');

  function nivel(n) {
    if (n == null) return '';
    if (n <= 3) return 'verde';
    if (n === 4) return 'amarelo';
    return 'vermelho';
  }
  function intensidadeTexto(n) {
    if (n == null) return '0 a 2 muito leve · 3 a 4 leve · 5 a 6 moderado · 7 a 8 pesado · 9 a 10 máximo';
    if (n <= 2) return 'Muito leve.';
    if (n <= 4) return 'Leve: daria para conversar normalmente.';
    if (n <= 6) return 'Moderado.';
    if (n <= 8) return 'Pesado: perto do limite em várias séries.';
    return 'Máximo: falha na maioria das séries.';
  }
  function ancora(n) {
    if (n == null) return 'Toque em um número abaixo.';
    return P.escalaDor.find((a) => n <= a.ate).texto;
  }
  const SEMAFORO = {
    verde: { titulo: 'Verde', faixa: '0 a 3', texto: 'Treino normal, incluindo perna.' },
    amarelo: { titulo: 'Amarelo', faixa: '4', texto: 'Perna mais leve (menos carga e amplitude) ou só os exercícios da fisio.' },
    vermelho: { titulo: 'Vermelho', faixa: '5+', texto: 'Sem perna hoje: superiores, core ou bike bem leve se não doer.' },
  };

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    let data = null;
    try { data = await res.json(); } catch { /* sem corpo */ }
    if (res.status === 401 && path !== '/login') {
      state.view = 'login';
      render();
      throw new Error('Sessão expirada. Entre novamente.');
    }
    if (!res.ok) throw new Error((data && data.error) || `Erro ${res.status}`);
    return data;
  }

  // ---------------- Rascunho do dia ----------------
  function draftVazio(date) {
    return {
      date,
      sono: { horas: 7, qualidade: null, local: null, descansado: null },
      joelho: { acordar: null, escada: null, pior: null, sinais: [] },
      treino: { tipo: null, fisio: null, durante: null, depois: null, sensacao: null, intensidade: null, intensidadeObs: '', ajustes: '' },
      joelhoEx: { fisio: null, fisioDor: null, bike: null, bikeDor: null, bikeMin: 20 },
      fodmap: { padrao: P.fodmapPadrao.map((x) => x.id), extras: [], outros: '' },
      atividades: { lista: [], dorMuay: null, dorVolei: null, minErgo: 20, minRua: 30 },
      refeicoes: {},
      suplementos: [],
      agua: 4,
      glicemia: { jejum: '', posShake: '' },
      bemestar: { energia: null, mental: null, intestino: null },
      obs: '',
    };
  }
  function mesclar(base, extra) {
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra === undefined ? base : extra;
    const out = Array.isArray(base) ? [...base] : { ...base };
    Object.keys(extra).forEach((k) => {
      const b = base ? base[k] : undefined;
      out[k] = b && typeof b === 'object' && !Array.isArray(b) ? mesclar(b, extra[k]) : extra[k];
    });
    return out;
  }
  function abrirFormulario(date) {
    const existente = state.entries[date];
    state.draft = existente ? mesclar(draftVazio(date), JSON.parse(JSON.stringify(existente))) : draftVazio(date);
    if (existente && !existente.fodmap) state.draft.fodmap.padrao = [];
    state.editandoData = existente ? date : null;
    state.step = 0;
    state.view = 'form';
    render();
    window.scrollTo(0, 0);
  }

  // ---------------- Componentes ----------------
  const d = () => state.draft;

  function chips(field, opcoes, { multi = false, lista = false } = {}) {
    const atual = getPath(d(), field);
    return `<div class="chips${lista ? ' lista' : ''}">${opcoes.map((o) => {
      const on = multi ? (atual || []).includes(o.v) : atual === o.v;
      return `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}"
        data-act="${multi ? 'toggle' : 'set'}" data-field="${field}" data-value="${esc(JSON.stringify(o.v))}">
        ${esc(o.l)}${o.d ? `<small>${esc(o.d)}</small>` : ''}</button>`;
    }).join('')}</div>`;
  }

  function pergunta(titulo, corpo, ajuda = '') {
    return `<section class="q"><h2>${titulo}</h2>${ajuda ? `<p class="help">${ajuda}</p>` : ''}${corpo}</section>`;
  }

  function campoDor(field, titulo, ajuda = '') {
    const v = getPath(d(), field);
    const botoes = Array.from({ length: 11 }, (_, i) =>
      `<button type="button" class="dor-b${v === i ? ' on' : ''}" aria-pressed="${v === i}" aria-label="Dor ${i}"
        data-act="set" data-field="${field}" data-value="${i}">${i}</button>`).join('');
    return pergunta(titulo, `
      <div class="dor" data-nivel="${nivel(v)}">
        <div class="dor-num" aria-hidden="true">${v == null ? '–' : v}</div>
        <p class="dor-ancora">${esc(ancora(v))}</p>
        <div class="dor-escala" role="group" aria-label="${esc(titulo)}">${botoes}</div>
        <div class="dor-escala-legenda"><span>sem dor</span><span>muda o movimento a partir de 5</span><span>máxima</span></div>
      </div>`, ajuda);
  }

  function stepper(field, { min = 0, max = 24, passo = 0.5, unidade = '' } = {}) {
    const v = getPath(d(), field) ?? min;
    return `<div class="stepper">
      <button type="button" aria-label="Diminuir" data-act="step" data-field="${field}" data-delta="${-passo}" data-min="${min}" data-max="${max}">−</button>
      <output>${fmtNum(v)}${unidade ? ` ${unidade}` : ''}</output>
      <button type="button" aria-label="Aumentar" data-act="step" data-field="${field}" data-delta="${passo}" data-min="${min}" data-max="${max}">+</button>
    </div>`;
  }

  function texto(field, rotulo, placeholder = '', area = false) {
    const v = getPath(d(), field) || '';
    return `<label class="campo"><span>${rotulo}</span>${area
      ? `<textarea data-field="${field}" placeholder="${esc(placeholder)}">${esc(v)}</textarea>`
      : `<input type="text" data-field="${field}" value="${esc(v)}" placeholder="${esc(placeholder)}">`}</label>`;
  }

  const ESCALA5 = (baixo, alto) => [1, 2, 3, 4, 5].map((n) => ({ v: n, l: String(n), d: n === 1 ? baixo : n === 5 ? alto : '' }));
  const STATUS_REFEICAO = [
    { v: 'seguiu', l: 'Segui' },
    { v: 'parcial', l: 'Em parte' },
    { v: 'trocou', l: 'Troquei' },
    { v: 'pulou', l: 'Pulei' },
  ];

  const MOTIVOS = [
    { v: 'sem_tempo', l: 'Sem tempo' },
    { v: 'sem_fome', l: 'Sem fome' },
    { v: 'esqueci', l: 'Esqueci' },
    { v: 'sem_preparo', l: 'Não tinha pronto' },
    { v: 'evento', l: 'Compromisso ou evento' },
    { v: 'outro', l: 'Outro' },
  ];
  const nomeMotivo = (x) => (x.motivo === 'outro' ? (x.motivoTexto || 'outro') : ((MOTIVOS.find((m) => m.v === x.motivo) || {}).l || '').toLowerCase());

  function blocoRefeicao(r) {
    const f = `refeicoes.${r.id}`;
    const status = getPath(d(), `${f}.status`);
    const precisaTexto = status === 'parcial' || status === 'trocou';
    return `<section class="q refeicao${r.destaque ? ' destaque' : ''}">
      <span class="hora">${esc(r.hora)}</span>
      <h2>${esc(r.nome)}</h2>
      <p class="help">${esc(r.desc)}</p>
      ${r.destaque ? '<p class="nota">O horário mais difícil. Registrar com sinceridade é o que ajuda.</p>' : ''}
      ${chips(`${f}.status`, STATUS_REFEICAO)}
      ${precisaTexto ? texto(`${f}.oque`, 'O que você comeu?', r.id === 'lanche_18' ? 'Ex.: salgados na lanchonete' : 'Ex.: troquei o melão por banana') : ''}
      ${status === 'pulou' ? `<p class="sub">Por que pulou?</p>${chips(`${f}.motivo`, MOTIVOS)}${getPath(d(), `${f}.motivo`) === 'outro' ? texto(`${f}.motivoTexto`, 'Qual foi o motivo?', 'Ex.: reunião que atrasou') : ''}` : ''}
    </section>`;
  }

  // ---------------- Etapas do formulário ----------------
  const ETAPAS = [
    {
      titulo: 'Qual dia você vai registrar?',
      intro: 'O ideal é registrar à noite, sobre o dia que está terminando.',
      render: () => {
        const v = d().date;
        const existe = state.entries[v] && v !== state.editandoData;
        return pergunta('Data', `
          <label class="campo"><span class="sr">Data do registro</span>
            <input type="date" data-field="date" data-rerender="1" value="${esc(v)}" max="${hoje()}">
          </label>
          <div class="chips">
            <button type="button" class="chip${v === hoje() ? ' on' : ''}" data-act="set" data-field="date" data-value="${esc(JSON.stringify(hoje()))}">Hoje</button>
            <button type="button" class="chip${v === somaDias(hoje(), -1) ? ' on' : ''}" data-act="set" data-field="date" data-value="${esc(JSON.stringify(somaDias(hoje(), -1)))}">Ontem</button>
          </div>
          ${existe ? '<div class="alerta amarelo"><b>Já existe um registro neste dia.</b>Salvar vai substituir o registro anterior.</div>' : ''}`);
      },
    },
    {
      titulo: 'Sono da última noite',
      intro: 'Sono ruim aumenta dor, fome e cansaço. Vale acompanhar.',
      render: () => [
        pergunta('Quantas horas você dormiu?', stepper('sono.horas', { min: 0, max: 14, passo: 0.5, unidade: 'h' })),
        pergunta('Qualidade do sono', chips('sono.qualidade', ESCALA5('Péssima', 'Ótima'))),
        pergunta('Onde você dormiu?', chips('sono.local', [
          { v: 'cama', l: 'Na cama' }, { v: 'parte_sofa', l: 'Parte no sofá' }, { v: 'sofa', l: 'No sofá' },
        ])),
        pergunta('Acordou descansado?', chips('sono.descansado', [
          { v: 'sim', l: 'Sim' }, { v: 'mais_ou_menos', l: 'Mais ou menos' }, { v: 'nao', l: 'Não' },
        ])),
      ].join(''),
    },
    {
      titulo: 'Joelho',
      intro: 'Use a régua: até 4, o movimento continua igual. A partir de 5, a dor muda o jeito de se mexer.',
      render: () => {
        const j = d().joelho;
        const sem = nivel(j.acordar);
        const sinais = (j.sinais || []).filter((s) => s !== 'nenhum');
        const forte = [j.acordar, j.escada, j.pior].some((n) => n != null && n >= 7);
        return [
          campoDor('joelho.acordar', 'Dor ao acordar'),
          sem ? `<div class="alerta ${sem}"><b>Semáforo ${SEMAFORO[sem].titulo.toLowerCase()} para o treino</b>${SEMAFORO[sem].texto}</div>` : '',
          campoDor('joelho.escada', 'Dor na primeira escada do dia'),
          campoDor('joelho.pior', 'Pior momento do dia', 'A dor mais forte que você sentiu hoje, em qualquer situação.'),
          pergunta('Algum desses sinais hoje?', chips('joelho.sinais', [
            { v: 'inchaco', l: 'Inchaço' }, { v: 'travamento', l: 'Travamento' }, { v: 'falseio', l: 'Joelho falhou' }, { v: 'nenhum', l: 'Nenhum' },
          ], { multi: true })),
          sinais.length || forte
            ? '<div class="alerta vermelho"><b>Avise seu fisioterapeuta.</b>Dor de 7 ou mais, inchaço, travamento ou falseio merecem contato antes da próxima sessão. Se persistir, procure o ortopedista.</div>'
            : '',
        ].join('');
      },
    },
    {
      titulo: 'Musculação',
      intro: 'O treino das 7h, sua âncora do dia.',
      render: () => {
        const t = d().treino;
        const treinou = t.tipo && t.tipo !== 'nao';
        return [
          pergunta('Qual treino você fez?', chips('treino.tipo', P.treinos.map((x) => ({ v: x.id, l: x.nome, d: x.desc })), { lista: true })),
          treinou ? campoDor('treino.durante', 'Dor no joelho durante o treino') : '',
          treinou ? campoDor('treino.depois', 'Dor logo depois do treino') : '',
          treinou ? pergunta('Como sentiu o treino?', chips('treino.sensacao', [{ v: 'leve', l: 'Leve' }, { v: 'ponto', l: 'No ponto' }, { v: 'pesado', l: 'Pesado' }])) : '',
          treinou ? pergunta('Intensidade do treino', chips('treino.intensidade', Array.from({ length: 11 }, (_, i) => ({ v: i, l: String(i) })))
            + `<p class="help" style="margin-top:8px">${esc(intensidadeTexto(t.intensidade))}</p>`
            + texto('treino.intensidadeObs', 'Comentário sobre a intensidade (opcional)', 'Ex.: falhei no leg press, descanso maior entre séries'), 'Esforço percebido de 0 a 10.') : '',
          treinou ? pergunta('Ajustou alguma coisa?', texto('treino.ajustes', 'Opcional', 'Ex.: leg press só até 60°, tirei o drop-set')) : '',
        ].join('');
      },
    },
    {
      titulo: 'Exercícios para o joelho',
      intro: 'Os exercícios da fisio e a bike ergométrica do dia.',
      render: () => {
        const x = d().joelhoEx;
        return [
          pergunta('Fez os exercícios da fisio?', chips('joelhoEx.fisio', [{ v: 'sim', l: 'Sim' }, { v: 'nao', l: 'Não' }])),
          x.fisio === 'sim' ? campoDor('joelhoEx.fisioDor', 'Dor no joelho durante os exercícios da fisio') : '',
          pergunta('Fez bike ergométrica?', chips('joelhoEx.bike', [{ v: 'sim', l: 'Sim' }, { v: 'nao', l: 'Não' }])),
          x.bike === 'sim' ? pergunta('Tempo na bike', stepper('joelhoEx.bikeMin', { min: 5, max: 180, passo: 5, unidade: 'min' })) : '',
          x.bike === 'sim' ? pergunta('Sentiu dor no joelho na bike?', chips('joelhoEx.bikeDor', [{ v: 'sim', l: 'Sim' }, { v: 'nao', l: 'Não' }])) : '',
        ].join('');
      },
    },
    {
      titulo: 'Outras atividades',
      intro: 'Tudo o que movimentou o joelho além da musculação.',
      render: () => {
        const a = d().atividades;
        const l = a.lista || [];
        return [
          pergunta('O que mais você fez hoje?', chips('atividades.lista', [
            ...P.atividades.filter((x) => x.id !== 'bike_ergo').map((x) => ({ v: x.id, l: x.nome })), { v: 'nenhuma', l: 'Nada além da musculação' },
          ], { multi: true })),
          l.includes('muaythai') ? campoDor('atividades.dorMuay', 'Dor durante o Muay Thai') : '',
          l.includes('volei') ? campoDor('atividades.dorVolei', 'Dor durante o vôlei') : '',
          l.includes('bike_rua') ? pergunta('Bike de rua', stepper('atividades.minRua', { min: 5, max: 300, passo: 5, unidade: 'min' })) : '',
        ].join('');
      },
    },
    ...P.blocos.map((b) => ({
      titulo: b.titulo,
      intro: b.id === 'manha' ? 'Sem culpa: o registro honesto vale mais que o dia perfeito.' : '',
      render: () => (b.id === 'manha'
        ? pergunta('Glicemia capilar', `<div class="glicemia">
            <label class="campo"><span>Em jejum (mg/dL)</span><input type="number" inputmode="numeric" min="30" max="400" data-field="glicemia.jejum" value="${esc(d().glicemia.jejum)}" placeholder="Ex.: 98"></label>
            <label class="campo"><span>Depois do shake (mg/dL)</span><input type="number" inputmode="numeric" min="30" max="400" data-field="glicemia.posShake" value="${esc(d().glicemia.posShake)}" placeholder="Ex.: 130"></label>
          </div>`, 'Pedido da Geovana para avaliar o pré-treino. Opcional: deixe em branco se não mediu.')
        : '') + b.ids.map((id) => blocoRefeicao(P.refeicoes.find((r) => r.id === id))).join(''),
    })),
    {
      titulo: 'Alimentos FODMAP',
      intro: 'Para a Geovana observar o que pode estar causando gases.',
      render: () => [
        pergunta('Do plano', chips('fodmap.padrao', P.fodmapPadrao.map((x) => ({ v: x.id, l: x.nome })), { multi: true }),
          'Já vêm marcados. Desmarque o que você não comeu hoje.'),
        ...P.fodmapGrupos.map((g) => pergunta(g.titulo, chips('fodmap.extras', g.itens.map(([v, l]) => ({ v, l })), { multi: true }))),
        pergunta('Outros', texto('fodmap.outros', 'Opcional', 'Ex.: grão-de-bico no restaurante')),
      ].join(''),
    },
    {
      titulo: 'Suplementos e água',
      intro: 'Marque o que você tomou hoje.',
      render: () => [
        pergunta('Tomei hoje', chips('suplementos', P.suplementos.map((s) => ({ v: s.id, l: s.nome })), { multi: true })),
        pergunta('Água', stepper('agua', { min: 0, max: 8, passo: 0.5, unidade: 'L' })),
      ].join(''),
    },
    {
      titulo: 'Como você está',
      intro: 'Energia e cabeça também fazem parte do processo.',
      render: () => [
        pergunta('Energia no dia', chips('bemestar.energia', ESCALA5('Sem energia', 'Muita energia'))),
        pergunta('Cansaço mental', chips('bemestar.mental', ESCALA5('Tranquilo', 'Esgotado'))),
        pergunta('Intestino', chips('bemestar.intestino', [
          { v: 'ok', l: 'Tranquilo' }, { v: 'gases_leves', l: 'Gases leves' }, { v: 'desconforto', l: 'Gases fortes ou desconforto' },
        ])),
      ].join(''),
    },
    {
      titulo: 'Para fechar o dia',
      intro: 'Confira o resumo e salve.',
      render: () => [
        pergunta('Algo mais que vale anotar?', texto('obs', 'Opcional', 'Ex.: subi muita escada, dia estressante no trabalho, joelho melhor à tarde', true)),
        `<h2 style="margin:22px 0 10px">Resumo do dia</h2><div class="revisao">${esc(linhasDia(d()).join('\n'))}</div>`,
      ].join(''),
    },
  ];

  // ---------------- Texto do dia (revisão e resumo) ----------------
  const FODMAP_NOMES = {};
  P.fodmapGrupos.forEach((g) => g.itens.forEach(([v, l]) => { FODMAP_NOMES[v] = l.toLowerCase(); }));
  const fodmapNomes = (ids) => (ids || []).map((id) => FODMAP_NOMES[id] || id);

  const ROTULOS = {
    local: { cama: 'na cama', parte_sofa: 'parte no sofá', sofa: 'no sofá' },
    descansado: { sim: 'sim', mais_ou_menos: 'mais ou menos', nao: 'não' },
    sinais: { inchaco: 'inchaço', travamento: 'travamento', falseio: 'joelho falhou' },
    fisio: { sim: 'com exercícios da fisio', parte: 'com parte dos exercícios da fisio', nao: 'sem exercícios da fisio' },
    sensacao: { leve: 'leve', ponto: 'no ponto', pesado: 'pesado' },
    status: { seguiu: 'seguiu', parcial: 'em parte', trocou: 'trocou', pulou: 'pulou' },
    intestino: { ok: 'tranquilo', gases_leves: 'gases leves', desconforto: 'gases fortes/desconforto' },
  };

  function linhasDia(e) {
    const L = [`${fmtData(e.date)} (${e.date})`];
    const s = e.sono || {};
    const sono = [];
    if (s.horas != null) sono.push(`${fmtNum(s.horas)} h`);
    if (s.qualidade) sono.push(`qualidade ${s.qualidade}/5`);
    if (s.local) sono.push(ROTULOS.local[s.local]);
    if (s.descansado) sono.push(`acordou descansado: ${ROTULOS.descansado[s.descansado]}`);
    if (sono.length) L.push(`  Sono: ${sono.join(', ')}`);

    const j = e.joelho || {};
    const jo = [];
    if (j.acordar != null) jo.push(`acordar ${j.acordar}`);
    if (j.escada != null) jo.push(`escada ${j.escada}`);
    if (j.pior != null) jo.push(`pior do dia ${j.pior}`);
    const sinais = (j.sinais || []).filter((x) => x !== 'nenhum').map((x) => ROTULOS.sinais[x]);
    if (sinais.length) jo.push(`sinais: ${sinais.join(', ')}`);
    if (jo.length) L.push(`  Joelho: ${jo.join(' | ')}`);

    const t = e.treino || {};
    if (t.tipo === 'nao') L.push('  Musculação: não treinou');
    else if (t.tipo) {
      const tr = [nomeTreino(t.tipo)];
      if (t.fisio) tr.push(ROTULOS.fisio[t.fisio]);
      if (t.durante != null) tr.push(`dor durante ${t.durante}`);
      if (t.depois != null) tr.push(`dor depois ${t.depois}`);
      if (t.sensacao) tr.push(`sentiu ${ROTULOS.sensacao[t.sensacao]}`);
      if (t.intensidade != null) tr.push(`intensidade ${t.intensidade}/10`);
      L.push(`  Musculação: ${tr.join(', ')}`);
      if (t.intensidadeObs) L.push(`  Sobre a intensidade: ${t.intensidadeObs}`);
      if (t.ajustes) L.push(`  Ajustes no treino: ${t.ajustes}`);
    }

    const jx = e.joelhoEx || {};
    const jxl = [];
    if (jx.fisio === 'sim') jxl.push(`exercícios da fisio${jx.fisioDor != null ? ` (dor ${jx.fisioDor})` : ''}`);
    if (jx.fisio === 'nao') jxl.push('sem exercícios da fisio');
    if (jx.bike === 'sim') jxl.push(`bike ergométrica ${jx.bikeMin} min${jx.bikeDor === 'sim' ? ' com dor' : jx.bikeDor === 'nao' ? ' sem dor' : ''}`);
    if (jx.bike === 'nao') jxl.push('sem bike');
    if (jxl.length) L.push(`  Joelho (exercícios): ${jxl.join(', ')}`);

    const a = e.atividades || {};
    const at = (a.lista || []).filter((x) => x !== 'nenhuma').map((id) => {
      if (id === 'muaythai') return `Muay Thai${a.dorMuay != null ? ` (dor ${a.dorMuay})` : ''}`;
      if (id === 'volei') return `vôlei${a.dorVolei != null ? ` (dor ${a.dorVolei})` : ''}`;
      if (id === 'bike_ergo') return `bike ergométrica ${a.minErgo} min`;
      if (id === 'bike_rua') return `bike de rua ${a.minRua} min`;
      return nomeAtividade(id).toLowerCase();
    });
    if (at.length) L.push(`  Outras atividades: ${at.join(', ')}`);

    const ref = e.refeicoes || {};
    const marcadas = P.refeicoes.filter((r) => ref[r.id] && ref[r.id].status);
    if (marcadas.length) {
      const seguidas = marcadas.filter((r) => ref[r.id].status === 'seguiu').length;
      L.push(`  Dieta: ${seguidas} de ${marcadas.length} refeições registradas seguiram o plano`);
      marcadas.filter((r) => ref[r.id].status !== 'seguiu').forEach((r) => {
        const x = ref[r.id];
        const det = [x.oque, x.status === 'pulou' && x.motivo ? `motivo: ${nomeMotivo(x)}` : ''].filter(Boolean).join('; ');
        L.push(`    ${r.hora} ${r.nome}: ${ROTULOS.status[x.status]}${det ? ` (${det})` : ''}`);
      });
    }

    const sup = e.suplementos || [];
    if (sup.length) {
      const faltou = P.suplementos.filter((x) => !sup.includes(x.id)).map((x) => x.nome);
      L.push(`  Suplementos: ${sup.length} de ${P.suplementos.length}${faltou.length ? ` (não tomou: ${faltou.join(', ')})` : ' (todos)'}`);
    }
    const g = e.glicemia || {};
    const gl = [];
    if (g.jejum) gl.push(`jejum ${g.jejum} mg/dL`);
    if (g.posShake) gl.push(`depois do shake ${g.posShake} mg/dL`);
    if (gl.length) L.push(`  Glicemia capilar: ${gl.join(', ')}`);
    const f = e.fodmap;
    if (f) {
      const extras = fodmapNomes(f.extras);
      if (f.outros) extras.push(f.outros);
      const naoComeu = P.fodmapPadrao.filter((x) => !(f.padrao || []).includes(x.id)).map((x) => x.nome.toLowerCase());
      L.push(`  FODMAP fora do plano: ${extras.length ? extras.join(', ') : 'nenhum'}${naoComeu.length ? ` | do plano, não comeu: ${naoComeu.join(', ')}` : ''}`);
    }
    if (e.agua != null) L.push(`  Água: ${fmtNum(e.agua)} L`);

    const b = e.bemestar || {};
    const bem = [];
    if (b.energia) bem.push(`energia ${b.energia}/5`);
    if (b.mental) bem.push(`cansaço mental ${b.mental}/5`);
    if (b.intestino) bem.push(`intestino ${ROTULOS.intestino[b.intestino]}`);
    if (bem.length) L.push(`  Bem-estar: ${bem.join(', ')}`);
    if (e.obs) L.push(`  Observação: ${e.obs}`);
    return L;
  }

  function entradasPeriodo(dias) {
    const fim = hoje();
    const ini = somaDias(fim, -(dias - 1));
    return {
      ini, fim,
      lista: Object.values(state.entries).filter((e) => e.date >= ini && e.date <= fim).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  function gerarResumo(dias) {
    const { ini, fim, lista } = entradasPeriodo(dias);
    if (!lista.length) return '';
    const L = [];
    L.push(`Diário de saúde do ${P.nome}: ${fmtData(ini)} a ${fmtData(fim)} (${lista.length} de ${dias} dias registrados)`);
    L.push('Escala de dor no joelho de 0 a 10: até 4 o movimento continua igual; a partir de 5 a dor muda o movimento.');
    L.push('');
    L.push('Dia a dia:');
    lista.forEach((e) => { L.push(...linhasDia(e)); L.push(''); });

    L.push('Resumo do período:');
    const acordar = media(lista.map((e) => e.joelho && e.joelho.acordar));
    const pior = media(lista.map((e) => e.joelho && e.joelho.pior));
    L.push(`- Dor média ao acordar: ${fmtNum(acordar)} | pior dor média do dia: ${fmtNum(pior)}`);
    const picos = lista.filter((e) => e.joelho && ((e.joelho.pior ?? -1) >= 5 || (e.joelho.acordar ?? -1) >= 5));
    if (picos.length) L.push(`- Dias com dor 5 ou mais: ${picos.map((e) => `${fmtData(e.date)} (acordar ${e.joelho.acordar ?? '–'}, pior ${e.joelho.pior ?? '–'})`).join('; ')}`);
    const comSinais = lista.filter((e) => e.joelho && (e.joelho.sinais || []).some((s) => s !== 'nenhum'));
    if (comSinais.length) L.push(`- Dias com inchaço, travamento ou falseio: ${comSinais.map((e) => fmtData(e.date)).join(', ')}`);

    const contagem = {};
    lista.forEach((e) => { const t = e.treino && e.treino.tipo; if (t) contagem[t] = (contagem[t] || 0) + 1; });
    if (Object.keys(contagem).length) L.push(`- Musculação: ${Object.entries(contagem).map(([k, n]) => `${nomeTreino(k)} ${n}x`).join(', ')}`);
    const muay = lista.filter(fezMuay);
    if (muay.length) L.push(`- Muay Thai: ${muay.length}x, dor média durante ${fmtNum(media(muay.map((e) => e.atividades.dorMuay)))}`);

    const pernaPosMuay = lista.filter((e) => ehPerna(e) && fezMuay(state.entries[somaDias(e.date, -1)]));
    if (pernaPosMuay.length) {
      L.push(`- Treino de perna na manhã seguinte ao Muay Thai: ${pernaPosMuay.map((e) => `${fmtData(e.date)} (acordar ${e.joelho?.acordar ?? '–'}, pior ${e.joelho?.pior ?? '–'})`).join('; ')}`);
    }
    const bike = lista.reduce((s, e) => {
      const l = (e.atividades && e.atividades.lista) || [];
      const jx = e.joelhoEx || {};
      return s + (l.includes('bike_ergo') ? e.atividades.minErgo || 0 : 0) + (l.includes('bike_rua') ? e.atividades.minRua || 0 : 0) + (jx.bike === 'sim' ? jx.bikeMin || 0 : 0);
    }, 0);
    L.push(`- Bike no período: ${bike} min`);
    const comJx = lista.filter((e) => e.joelhoEx && (e.joelhoEx.fisio || e.joelhoEx.bike));
    if (comJx.length) {
      const fis = comJx.filter((e) => e.joelhoEx.fisio === 'sim');
      const bk = comJx.filter((e) => e.joelhoEx.bike === 'sim');
      L.push(`- Exercícios da fisio: ${fis.length} de ${comJx.length} dias${fis.length ? `, dor média ${fmtNum(media(fis.map((e) => e.joelhoEx.fisioDor)))}` : ''}`);
      L.push(`- Bike ergométrica: ${bk.length} de ${comJx.length} dias${bk.length ? `, com dor em ${bk.filter((e) => e.joelhoEx.bikeDor === 'sim').length}` : ''}`);
    }

    let total = 0; let seguidas = 0;
    const r18 = { seguiu: 0, parcial: 0, trocou: 0, pulou: 0 };
    lista.forEach((e) => {
      Object.entries(e.refeicoes || {}).forEach(([id, r]) => {
        if (!r || !r.status || !P.refeicoes.some((x) => x.id === id)) return;
        total += 1;
        if (r.status === 'seguiu') seguidas += 1;
        if (id === 'lanche_18') r18[r.status] += 1;
      });
    });
    if (total) {
      L.push(`- Dieta: ${Math.round((seguidas / total) * 100)}% das refeições registradas seguiram o plano`);
      L.push(`- Refeição das 18h: seguiu ${r18.seguiu}, em parte ${r18.parcial}, trocou ${r18.trocou}, pulou ${r18.pulou}`);
    }
    const horas = media(lista.map((e) => e.sono && e.sono.horas));
    const sofa = lista.filter((e) => e.sono && (e.sono.local === 'sofa' || e.sono.local === 'parte_sofa')).length;
    L.push(`- Sono médio: ${fmtNum(horas)} h${sofa ? `; noites com sofá: ${sofa}` : ''}`);
    L.push(`- Água média: ${fmtNum(media(lista.map((e) => e.agua)))} L`);
    const gj = lista.map((e) => Number(e.glicemia && e.glicemia.jejum)).filter((n) => n > 0);
    const gp = lista.map((e) => Number(e.glicemia && e.glicemia.posShake)).filter((n) => n > 0);
    if (gj.length) L.push(`- Glicemia de jejum: média ${fmtNum(media(gj))} mg/dL em ${gj.length} medições (de ${Math.min(...gj)} a ${Math.max(...gj)})`);
    if (gp.length) L.push(`- Glicemia depois do shake: média ${fmtNum(media(gp))} mg/dL em ${gp.length} medições (de ${Math.min(...gp)} a ${Math.max(...gp)})`);
    const comInt = lista.filter((e) => e.treino && e.treino.intensidade != null);
    if (comInt.length) L.push(`- Intensidade média da musculação: ${fmtNum(media(comInt.map((e) => e.treino.intensidade)))}/10`);
    const comFod = lista.filter((e) => e.fodmap);
    if (comFod.length) {
      const cont = {};
      comFod.forEach((e) => fodmapNomes(e.fodmap.extras).forEach((n) => { cont[n] = (cont[n] || 0) + 1; }));
      const top = Object.entries(cont).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}x`);
      L.push(`- FODMAP fora do plano (${comFod.length} dias registrados): ${top.length ? top.join(', ') : 'nenhum'}`);
      const ruins = comFod.filter((e) => e.bemestar && (e.bemestar.intestino === 'desconforto' || e.bemestar.intestino === 'gases_leves'));
      if (ruins.length) L.push(`- Dias com gases: ${ruins.map((e) => `${fmtData(e.date)} (${fodmapNomes(e.fodmap.extras).concat(e.fodmap.outros ? [e.fodmap.outros] : []).join(', ') || 'nenhum FODMAP fora do plano'})`).join('; ')}`);
    }
    const intestino = lista.filter((e) => e.bemestar && e.bemestar.intestino === 'desconforto').length;
    if (intestino) L.push(`- Dias com gases fortes ou desconforto intestinal: ${intestino}`);
    L.push('');
    L.push('Pode analisar esse período, identificar padrões e me ajudar a preparar o que levar ao fisio, ao personal e à nutricionista?');
    return L.join('\n');
  }

  // ---------------- Gráfico ----------------
  function grafico(dias = 30) {
    const fim = hoje();
    const datas = Array.from({ length: dias }, (_, i) => somaDias(fim, i - dias + 1));
    const tem = datas.some((dt) => state.entries[dt] && state.entries[dt].joelho);
    if (!tem) return '<p class="vazio">O gráfico aparece depois dos primeiros registros.</p>';

    const W = 340; const H = 190; const pl = 24; const pr = 8; const pt = 10; const pb = 46;
    const x = (i) => pl + (i * (W - pl - pr)) / (dias - 1);
    const y = (v) => pt + ((10 - v) * (H - pt - pb)) / 10;
    const linha = (campo) => {
      let path = ''; let aberto = false;
      datas.forEach((dt, i) => {
        const v = state.entries[dt]?.joelho?.[campo];
        if (typeof v === 'number') { path += `${aberto ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; aberto = true; } else aberto = false;
      });
      return path;
    };
    const pontos = (campo, cls) => datas.map((dt, i) => {
      const v = state.entries[dt]?.joelho?.[campo];
      return typeof v === 'number' ? `<circle class="${cls}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3"><title>${fmtData(dt)}: ${v}</title></circle>` : '';
    }).join('');
    const marcas = datas.map((dt, i) => {
      const e = state.entries[dt];
      let m = '';
      if (fezMuay(e)) m += `<rect class="m-muay" x="${(x(i) - 3).toFixed(1)}" y="${H - pb + 8}" width="6" height="6" rx="3"><title>${fmtData(dt)}: Muay Thai</title></rect>`;
      if (ehPerna(e)) m += `<rect class="m-perna" x="${(x(i) - 3).toFixed(1)}" y="${H - pb + 18}" width="6" height="6" rx="1"><title>${fmtData(dt)}: treino de perna</title></rect>`;
      return m;
    }).join('');
    const grade = [0, 4, 7, 10].map((v) => `<line class="grade" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${pl - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('');
    return `<div class="grafico">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dor no joelho nos últimos ${dias} dias">
        <rect class="zona" x="${pl}" y="${y(10)}" width="${W - pl - pr}" height="${y(4.5) - y(10)}" opacity=".5"/>
        ${grade}
        <line class="limite" x1="${pl}" x2="${W - pr}" y1="${y(4.5)}" y2="${y(4.5)}"/>
        <path class="l-pior" d="${linha('pior')}"/>
        <path class="l-acordar" d="${linha('acordar')}"/>
        ${pontos('pior', 'p-pior')}${pontos('acordar', 'p-acordar')}
        ${marcas}
        <text class="eixo" x="${pl}" y="${H - 4}">${fmtData(datas[0])}</text>
        <text class="eixo" x="${W - pr}" y="${H - 4}" text-anchor="end">${fmtData(fim)}</text>
      </svg>
      <div class="legenda">
        <span><i style="background:var(--accent)"></i>Ao acordar</span>
        <span><i style="background:var(--vermelho)"></i>Pior do dia</span>
        <span><i style="background:var(--amarelo);border-radius:50%"></i>Muay Thai</span>
        <span><i style="background:var(--verde)"></i>Treino de perna</span>
      </div>
    </div>`;
  }

  // ---------------- Telas ----------------
  function abas(atual) {
    const item = (id, nome) => `<button type="button" data-act="ir" data-view="${id}"${atual === id ? ' aria-current="page"' : ''}>${nome}</button>`;
    return `<nav class="abas" aria-label="Navegação"><div>${item('home', 'Hoje')}${item('historico', 'Histórico')}${item('nutri', 'Dieta')}${item('resumo', 'Resumo')}</div></nav>`;
  }

  function telaLogin() {
    return `<main class="login">
      <h1>Diário do joelho</h1>
      <p class="help">Sono, dor, treino e dieta em um registro por dia.</p>
      <form id="form-login" novalidate>
        <label class="campo"><span>Usuário</span><input name="usuario" autocomplete="username" autocapitalize="none" required></label>
        <label class="campo"><span>Senha</span><input name="senha" type="password" autocomplete="current-password" required></label>
        ${state.erroLogin ? `<p class="erro">${esc(state.erroLogin)}</p>` : ''}
        <button class="btn block" type="submit">Entrar</button>
      </form>
    </main>`;
  }

  function telaHome() {
    const h = new Date().getHours();
    const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const dataHoje = hoje();
    const reg = state.entries[dataHoje];
    const j = (reg && reg.joelho) || {};
    const sem = nivel(j.acordar);

    const cartaoHoje = reg
      ? `<section class="hoje">
          <h2>Dia registrado</h2>
          <p class="muted">${esc(reg.treino && reg.treino.tipo ? (reg.treino.tipo === 'nao' ? 'Sem musculação' : nomeTreino(reg.treino.tipo)) : 'Treino não informado')}${fezMuay(reg) ? ' e Muay Thai' : ''}</p>
          <div class="numeros">
            <div class="numero"><b>${j.acordar ?? '–'}</b><span>dor ao acordar</span></div>
            <div class="numero"><b>${j.escada ?? '–'}</b><span>na escada</span></div>
            <div class="numero"><b>${j.pior ?? '–'}</b><span>pior do dia</span></div>
          </div>
          <button class="btn ghost block" data-act="abrir" data-date="${dataHoje}">Editar registro de hoje</button>
        </section>`
      : `<section class="hoje">
          <h2>Como foi hoje?</h2>
          <p class="muted">Leva uns 3 minutos. Melhor fazer à noite, com o dia fresco na memória.</p>
          <button class="btn block" data-act="abrir" data-date="${dataHoje}">Registrar o dia</button>
        </section>`;

    const ultimos = entradasPeriodo(7).lista;
    const r18 = ultimos.filter((e) => e.refeicoes && e.refeicoes.lanche_18 && e.refeicoes.lanche_18.status);
    const semana = ultimos.length
      ? `<section class="bloco"><h2>Últimos 7 dias</h2>
          <div class="numeros">
            <div class="numero"><b>${fmtNum(media(ultimos.map((e) => e.joelho && e.joelho.acordar)))}</b><span>dor média ao acordar</span></div>
            <div class="numero"><b>${r18.filter((e) => e.refeicoes.lanche_18.status === 'seguiu').length}/${r18.length}</b><span>refeição das 18h no plano</span></div>
            <div class="numero"><b>${fmtNum(media(ultimos.map((e) => e.sono && e.sono.horas)))}</b><span>horas de sono</span></div>
          </div></section>`
      : '';

    const regra = ['verde', 'amarelo', 'vermelho'].map((c) =>
      `<div class="sinal ${c}${sem === c ? ' atual' : ''}"><b>${SEMAFORO[c].faixa}</b><span>${SEMAFORO[c].texto}</span></div>`).join('');

    return `<main>
      <header class="topo">
        <div><p class="saudacao">${saud}, ${esc(P.nome)}</p><h1>${esc(fmtDataLonga(dataHoje))}</h1></div>
        <button class="btn ghost small" data-act="sair">Sair</button>
      </header>
      ${cartaoHoje}
      <section class="bloco"><h2>Joelho nos últimos 30 dias</h2><div class="painel">${grafico(30)}</div></section>
      ${semana}
      <section class="bloco"><h2>Semáforo do treino de perna</h2>
        <p class="help" style="margin-bottom:12px">Pela dor ao acordar, antes do treino. Combine os detalhes com seu fisioterapeuta.</p>
        <div class="semaforo">${regra}</div>
      </section>
    </main>${abas('home')}`;
  }

  function telaHistorico() {
    const lista = Object.values(state.entries).sort((a, b) => b.date.localeCompare(a.date));
    const itens = lista.map((e) => {
      const j = e.joelho || {};
      const ref = (e.refeicoes || {}).lanche_18;
      const tags = [
        e.treino && e.treino.tipo ? (e.treino.tipo === 'nao' ? 'Sem musculação' : nomeTreino(e.treino.tipo)) : null,
        fezMuay(e) ? 'Muay Thai' : null,
        ref && ref.status ? `18h: ${ROTULOS.status[ref.status]}` : null,
        e.sono && e.sono.horas != null ? `${fmtNum(e.sono.horas)} h de sono` : null,
      ].filter(Boolean);
      return `<li><button class="dia" data-act="abrir" data-date="${e.date}">
          <h3>${fmtData(e.date)}</h3>
          <span class="dor-mini ${nivel(j.pior ?? j.acordar)}" title="Pior dor do dia">${j.pior ?? j.acordar ?? '–'}</span>
          <span class="tags">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</span>
        </button></li>`;
    }).join('');
    return `<main>
      <header class="topo"><div><h1>Histórico</h1><p class="help">O número à direita é a pior dor do dia. Toque para editar.</p></div></header>
      ${lista.length ? `<ul class="lista-dias" style="list-style:none;margin:0;padding:0">${itens}</ul>` : '<p class="vazio">Nenhum dia registrado ainda. Comece pela aba Hoje.</p>'}
    </main>${abas('historico')}`;
  }

  function telaResumo() {
    const txt = gerarResumo(state.periodo);
    const opcoes = [7, 14, 30].map((n) => `<button type="button" class="chip${state.periodo === n ? ' on' : ''}" data-act="periodo" data-n="${n}">${n} dias</button>`).join('');
    return `<main>
      <header class="topo"><div><h1>Resumo para o Claude</h1>
        <p class="help">Copie e cole na conversa para analisarmos juntos o período.</p></div></header>
      <div class="chips" style="margin-bottom:14px">${opcoes}</div>
      ${txt
        ? `<textarea class="resumo-texto" id="resumo" readonly>${esc(txt)}</textarea>
           <div class="acoes"><button class="btn block" data-act="copiar">Copiar resumo</button></div>`
        : '<p class="vazio">Não há registros nesse período.</p>'}
      <section class="bloco" style="margin-top:32px"><h2>Backup</h2>
        <p class="help" style="margin-bottom:12px">Baixa todos os registros em um arquivo JSON.</p>
        <a class="btn ghost block" href="/api/export" download>Baixar backup</a>
      </section>
    </main>${abas('resumo')}`;
  }

  // ---------------- Aba Dieta (resumo para a nutricionista) ----------------
  const PESO = { seguiu: 1, parcial: 0.5, trocou: 0, pulou: 0 };
  const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const pct = (n) => `${Math.round(n * 100)}%`;

  function dadosDieta(dias) {
    const fim = hoje();
    const datas = Array.from({ length: dias }, (_, i) => somaDias(fim, i - dias + 1));
    const porDia = datas.map((dt) => {
      const e = state.entries[dt];
      const regs = P.refeicoes.map((r) => (e && e.refeicoes && e.refeicoes[r.id]) || null).filter((x) => x && x.status);
      const pontos = regs.reduce((s, x) => s + PESO[x.status], 0);
      return { dt, n: regs.length, acerto: regs.length ? pontos / regs.length : null, falhas: regs.filter((x) => x.status === 'pulou' || x.status === 'trocou').length };
    });
    const porRefeicao = P.refeicoes.map((r) => {
      const c = { seguiu: 0, parcial: 0, trocou: 0, pulou: 0 };
      const motivos = {};
      datas.forEach((dt) => {
        const x = state.entries[dt] && state.entries[dt].refeicoes && state.entries[dt].refeicoes[r.id];
        if (!x || !x.status) return;
        c[x.status] += 1;
        if (x.status === 'pulou' && x.motivo) { const m = nomeMotivo(x); motivos[m] = (motivos[m] || 0) + 1; }
      });
      const n = c.seguiu + c.parcial + c.trocou + c.pulou;
      return { r, c, n, motivos, acerto: n ? (c.seguiu + c.parcial * 0.5) / n : null };
    });
    const semana = DIAS_LONGOS.map((nome, i) => {
      const ds = porDia.filter((x) => x.n && parseData(x.dt).getDay() === i);
      const total = ds.reduce((s, x) => s + x.n, 0);
      const falhas = ds.reduce((s, x) => s + x.falhas, 0);
      return { nome, dias: ds.length, total, falhas, taxa: total ? falhas / total : null };
    });
    const motivos = {};
    porRefeicao.forEach((x) => Object.entries(x.motivos).forEach(([m, n]) => { motivos[m] = (motivos[m] || 0) + n; }));
    const comReg = porDia.filter((x) => x.n);
    const totalN = comReg.reduce((s, x) => s + x.n, 0);
    const geral = totalN ? comReg.reduce((s, x) => s + x.acerto * x.n, 0) / totalN : null;
    return { datas, porDia, porRefeicao, semana, motivos, geral, diasComReg: comReg.length };
  }

  function graficoDieta(porDia) {
    const W = 340; const H = 170; const pl = 30; const pr = 6; const pt = 8; const pb = 26;
    const n = porDia.length; const slot = (W - pl - pr) / n; const bw = Math.max(3, Math.min(22, slot * 0.7));
    const y = (v) => pt + (1 - v) * (H - pt - pb);
    const grade = [0, 0.5, 1].map((v) => `<line class="grade" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${pl - 5}" y="${y(v) + 3}" text-anchor="end">${v * 100}%</text>`).join('');
    const barras = porDia.map((x, i) => {
      const cx = pl + slot * i + slot / 2;
      if (x.acerto == null) return `<rect class="b-vazio" x="${(cx - bw / 2).toFixed(1)}" y="${y(0) - 3}" width="${bw.toFixed(1)}" height="3" rx="1"><title>${fmtData(x.dt)}: sem registro</title></rect>`;
      const h = Math.max(2, y(0) - y(x.acerto));
      const cls = x.acerto >= 0.75 ? 'b-ok' : x.acerto >= 0.5 ? 'b-mid' : 'b-bad';
      return `<rect class="${cls}" x="${(cx - bw / 2).toFixed(1)}" y="${(y(0) - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${fmtData(x.dt)}: ${pct(x.acerto)} (${x.n} refeições)</title></rect>`;
    }).join('');
    const passo = n <= 7 ? 1 : n <= 14 ? 2 : 5;
    const rot = porDia.map((x, i) => (i % passo === 0 || i === n - 1)
      ? `<text class="eixo" x="${(pl + slot * i + slot / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${n <= 14 ? fmtData(x.dt).split(' ')[1].slice(0, 2) : fmtData(x.dt).split(' ')[1]}</text>` : '').join('');
    return `<div class="grafico"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Percentual de acerto da dieta por dia">${grade}${barras}${rot}</svg>
      <div class="legenda"><span><i style="background:var(--verde)"></i>75% ou mais</span><span><i style="background:var(--amarelo)"></i>50 a 74%</span><span><i style="background:var(--vermelho)"></i>abaixo de 50%</span><span><i style="background:var(--line)"></i>sem registro</span></div></div>`;
  }

  function barraH(rotulo, valor, max, texto, cls = '') {
    const w = max ? (valor / max) * 100 : 0;
    return `<div class="hbar ${cls}"><span class="hbar-l">${rotulo}</span><span class="hbar-t"><i style="width:${w.toFixed(1)}%"></i></span><span class="hbar-v">${texto}</span></div>`;
  }

  const juntar = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} e ${arr[arr.length - 1]}`);
  function maiores(lista, valor) {
    const max = Math.max(0, ...lista.map(valor));
    return max > 0 ? { max, itens: lista.filter((x) => valor(x) === max) } : null;
  }

  function textoNutri(dd, dias) {
    const L = [`Resumo da dieta do ${P.nome}: últimos ${dias} dias (${dd.diasComReg} dias registrados)`];
    L.push('Acerto: "segui" conta 100%, "em parte" conta 50%, "troquei" e "pulei" contam 0%.');
    if (dd.geral != null) L.push(`Acerto geral: ${pct(dd.geral)}`);
    L.push('', 'Por refeição:');
    dd.porRefeicao.filter((x) => x.n).forEach((x) => L.push(`- ${x.r.hora} ${x.r.nome}: ${pct(x.acerto)} de acerto (seguiu ${x.c.seguiu}, em parte ${x.c.parcial}, trocou ${x.c.trocou}, pulou ${x.c.pulou})`));
    const mf = maiores(dd.porRefeicao, (x) => x.c.pulou);
    const ms = maiores(dd.porRefeicao, (x) => x.c.trocou);
    L.push('');
    if (mf) L.push(`Refeição mais pulada: ${juntar(mf.itens.map((x) => x.r.nome))} (${mf.max}x)`);
    if (ms) L.push(`Refeição mais substituída: ${juntar(ms.itens.map((x) => x.r.nome))} (${ms.max}x)`);
    const ds = maiores(dd.semana.filter((x) => x.taxa != null), (x) => x.taxa);
    if (ds) L.push(`Dia da semana com mais falhas: ${juntar(ds.itens.map((x) => x.nome))} (${pct(ds.max)} das refeições puladas ou trocadas)`);
    const mot = Object.entries(dd.motivos).sort((a, b) => b[1] - a[1]);
    if (mot.length) L.push(`Motivos para pular: ${mot.map(([m, n]) => `${m} ${n}x`).join(', ')}`);
    return L.join('\n');
  }

  function telaNutri() {
    const dias = state.periodoNutri;
    const dd = dadosDieta(dias);
    const opcoes = [7, 14, 30].map((n) => `<button type="button" class="chip${dias === n ? ' on' : ''}" data-act="periodoNutri" data-n="${n}">${n} dias</button>`).join('');
    const topo = `<header class="topo"><div><h1>Dieta</h1><p class="help">Resumo para levar à nutricionista.</p></div></header>
      <div class="chips" style="margin-bottom:20px">${opcoes}</div>`;
    if (!dd.diasComReg) return `<main>${topo}<p class="vazio">Nenhuma refeição registrada nesse período. Registre o dia pela aba Hoje.</p></main>${abas('nutri')}`;

    const mf = maiores(dd.porRefeicao, (x) => x.c.pulou);
    const ms = maiores(dd.porRefeicao, (x) => x.c.trocou);
    const semOrd = dd.semana.filter((x) => x.taxa != null);
    const pior = maiores(semOrd, (x) => x.taxa);

    const destaques = `<div class="numeros">
        <div class="numero"><b>${pct(dd.geral)}</b><span>acerto no período</span></div>
        <div class="numero"><b>${mf ? mf.max + 'x' : '–'}</b><span>${mf ? `mais pulada: ${esc(juntar(mf.itens.map((x) => x.r.nome)))}` : 'nenhuma refeição pulada'}</span></div>
        <div class="numero"><b>${ms ? ms.max + 'x' : '–'}</b><span>${ms ? `mais trocada: ${esc(juntar(ms.itens.map((x) => x.r.nome)))}` : 'nenhuma refeição trocada'}</span></div>
      </div>`;

    const maxRef = Math.max(...dd.porRefeicao.map((x) => x.n), 1);
    const refeicoes = dd.porRefeicao.filter((x) => x.n).map((x) =>
      barraH(`${esc(x.r.nome)}<small>${esc(x.r.hora)}</small>`, x.acerto, 1, pct(x.acerto), x.acerto >= 0.75 ? 'ok' : x.acerto >= 0.5 ? 'mid' : 'bad')
      + `<p class="hbar-sub">seguiu ${x.c.seguiu} · em parte ${x.c.parcial} · trocou ${x.c.trocou} · pulou ${x.c.pulou}</p>`).join('');

    const maxTaxa = Math.max(...semOrd.map((x) => x.taxa), 0.01);
    const semana = dd.semana.map((x) => x.taxa == null
      ? barraH(x.nome, 0, 1, 'sem registro', 'off')
      : barraH(x.nome, x.taxa, maxTaxa, `${pct(x.taxa)}`, pior && pior.itens.includes(x) ? 'bad' : 'neutro')).join('');

    const mot = Object.entries(dd.motivos).sort((a, b) => b[1] - a[1]);
    const maxMot = mot.length ? mot[0][1] : 1;
    const motivos = mot.length ? mot.map(([m, n]) => barraH(esc(m), n, maxMot, `${n}x`, 'neutro')).join('')
      : '<p class="vazio">Nenhum motivo registrado ainda. Ele é perguntado quando você marca que pulou uma refeição.</p>';

    return `<main>${topo}
      ${destaques}
      <section class="bloco"><h2>Acerto por dia</h2>
        <p class="help" style="margin-bottom:12px">"Segui" conta 100%, "em parte" conta 50%, "troquei" e "pulei" contam 0%.</p>
        <div class="painel">${graficoDieta(dd.porDia)}</div></section>
      <section class="bloco"><h2>Por refeição</h2><div class="painel hbars">${refeicoes}</div></section>
      <section class="bloco"><h2>Falhas por dia da semana</h2>
        <p class="help" style="margin-bottom:12px">${pior ? `${juntar(pior.itens.map((x) => x.nome))} ${pior.itens.length > 1 ? 'são os dias' : 'é o dia'} com mais refeições puladas ou trocadas (${pct(pior.max)}).` : 'Nenhuma refeição pulada ou trocada no período.'}</p>
        <div class="painel hbars">${semana}</div></section>
      <section class="bloco"><h2>Motivos para pular</h2><div class="painel hbars">${motivos}</div></section>
      <section class="bloco"><h2>Texto para a consulta</h2>
        <textarea class="resumo-texto" id="resumo-nutri" readonly style="min-height:220px">${esc(textoNutri(dd, dias))}</textarea>
        <div class="acoes"><button class="btn block" data-act="copiarNutri">Copiar resumo da dieta</button></div></section>
    </main>${abas('nutri')}`;
  }

  function telaForm() {
    const etapa = ETAPAS[state.step];
    const total = ETAPAS.length;
    const ultima = state.step === total - 1;
    return `<main>
      <div class="passo-topo">
        <span class="muted">Etapa ${state.step + 1} de ${total}</span>
        <button class="link" data-act="fechar">Fechar</button>
      </div>
      <div class="progresso" aria-hidden="true"><i style="width:${((state.step + 1) / total) * 100}%"></i></div>
      <h1 class="passo-titulo">${esc(etapa.titulo)}</h1>
      ${etapa.intro ? `<p class="passo-intro">${esc(etapa.intro)}</p>` : '<div style="height:18px"></div>'}
      ${etapa.render()}
      ${ultima && state.editandoData ? '<button class="btn perigo block" style="margin-top:24px" data-act="excluir">Excluir este registro</button>' : ''}
    </main>
    <footer class="passo-nav"><div>
      <button class="btn ghost" data-act="voltar"${state.step === 0 ? ' disabled' : ''}>Voltar</button>
      <button class="btn" data-act="${ultima ? 'salvar' : 'avancar'}"${state.salvando ? ' disabled' : ''}>${ultima ? (state.salvando ? 'Salvando…' : 'Salvar registro') : 'Continuar'}</button>
    </div></footer>`;
  }

  function render() {
    const telas = { login: telaLogin, home: telaHome, historico: telaHistorico, nutri: telaNutri, resumo: telaResumo, form: telaForm };
    const fn = telas[state.view];
    if (!fn) { appEl.innerHTML = '<p class="carregando">Carregando…</p>'; return; }
    const y = window.scrollY;
    appEl.innerHTML = fn();
    if (state.view === 'form') window.scrollTo(0, y);
  }

  // ---------------- Ações ----------------
  async function carregar() {
    const data = await api('/entries');
    state.entries = data.entries || {};
  }

  const acoes = {
    set(el) {
      const field = el.dataset.field;
      const v = JSON.parse(el.dataset.value);
      // Tocar de novo na opção marcada desmarca (exceto a data)
      setPath(state.draft, field, field !== 'date' && getPath(state.draft, field) === v ? null : v);
      render();
    },
    toggle(el) {
      const field = el.dataset.field;
      const v = JSON.parse(el.dataset.value);
      const exclusivos = ['nenhum', 'nenhuma'];
      let arr = [...(getPath(state.draft, field) || [])];
      if (arr.includes(v)) arr = arr.filter((x) => x !== v);
      else if (exclusivos.includes(v)) arr = [v];
      else arr = [...arr.filter((x) => !exclusivos.includes(x)), v];
      setPath(state.draft, field, arr);
      render();
    },
    step(el) {
      const field = el.dataset.field;
      const delta = Number(el.dataset.delta);
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      const atual = Number(getPath(state.draft, field) ?? min);
      setPath(state.draft, field, Math.min(max, Math.max(min, Math.round((atual + delta) * 10) / 10)));
      render();
    },
    avancar() {
      if (state.step === 0 && !/^\d{4}-\d{2}-\d{2}$/.test(state.draft.date || '')) { toast('Escolha a data do registro.'); return; }
      state.step = Math.min(ETAPAS.length - 1, state.step + 1);
      render(); window.scrollTo(0, 0);
    },
    voltar() {
      state.step = Math.max(0, state.step - 1);
      render(); window.scrollTo(0, 0);
    },
    fechar() {
      if (confirm('Sair sem salvar este registro?')) { state.view = 'home'; state.draft = null; render(); window.scrollTo(0, 0); }
    },
    async salvar() {
      state.salvando = true; render();
      try {
        const alvo = state.draft.date;
        const { entry } = await api(`/entries/${alvo}`, { method: 'PUT', body: JSON.stringify(state.draft) });
        // Se a data foi trocada durante a edição, remove o registro antigo
        if (state.editandoData && state.editandoData !== alvo) {
          await api(`/entries/${state.editandoData}`, { method: 'DELETE' });
          delete state.entries[state.editandoData];
        }
        state.entries[alvo] = entry;
        state.view = 'home'; state.draft = null;
        toast('Registro salvo');
        window.scrollTo(0, 0);
      } catch (err) {
        toast(err.message);
      } finally {
        state.salvando = false; render();
      }
    },
    async excluir() {
      if (!confirm('Excluir o registro deste dia? Isso não pode ser desfeito.')) return;
      try {
        await api(`/entries/${state.editandoData}`, { method: 'DELETE' });
        delete state.entries[state.editandoData];
        state.view = 'historico'; state.draft = null;
        toast('Registro excluído');
        render(); window.scrollTo(0, 0);
      } catch (err) { toast(err.message); }
    },
    abrir(el) { abrirFormulario(el.dataset.date); },
    ir(el) { state.view = el.dataset.view; render(); window.scrollTo(0, 0); },
    periodo(el) { state.periodo = Number(el.dataset.n); render(); },
    periodoNutri(el) { state.periodoNutri = Number(el.dataset.n); render(); },
    async copiarNutri() {
      const ta = document.getElementById('resumo-nutri');
      try { await navigator.clipboard.writeText(ta.value); } catch { ta.removeAttribute('readonly'); ta.select(); document.execCommand('copy'); ta.setAttribute('readonly', ''); }
      toast('Resumo da dieta copiado.');
    },
    async copiar() {
      const ta = document.getElementById('resumo');
      try {
        await navigator.clipboard.writeText(ta.value);
      } catch {
        ta.removeAttribute('readonly'); ta.select(); document.execCommand('copy'); ta.setAttribute('readonly', '');
      }
      toast('Resumo copiado. Agora é só colar na conversa.');
    },
    async sair() {
      try { await api('/logout', { method: 'POST' }); } catch { /* ignora */ }
      state.entries = {}; state.view = 'login'; render();
    },
  };

  appEl.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = acoes[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el); }
  });

  appEl.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.dataset || !t.dataset.field || !state.draft) return;
    setPath(state.draft, t.dataset.field, t.value);
    if (t.dataset.rerender) render();
  });

  appEl.addEventListener('submit', async (e) => {
    if (e.target.id !== 'form-login') return;
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/login', { method: 'POST', body: JSON.stringify({ usuario: fd.get('usuario'), senha: fd.get('senha') }) });
      state.erroLogin = '';
      await carregar();
      state.view = 'home';
    } catch (err) {
      state.erroLogin = err.message;
    }
    render();
  });

  // ---------------- Início ----------------
  (async () => {
    try {
      await api('/me');
      await carregar();
      state.view = 'home';
    } catch {
      state.view = 'login';
    }
    render();
  })();
})();
