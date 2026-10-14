/*
 * Interface: edição dos projetos, validação dos campos, controles de execução,
 * métricas, gráfico, população, log, histórico, avaliação manual e testes.
 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const { money, points, avg, esc } = Fmt;

  const MIN_PROJECTS = 4;
  const MAX_PROJECTS = 15;
  const MAX_COST_CENTS = 1e14;    // R$ 1 trilhão por projeto (mantém as somas exatas)
  const MAX_BUDGET_CENTS = 1e15;
  const MAX_BENEFIT = 1e12;       // em centésimos
  const MAX_POPULATION = 10000;   // limites práticos para o navegador não travar
  const MAX_GENERATIONS = 100000;
  const MAX_SEED = 4294967295;
  const LIST_LIMIT = 400;         // itens exibidos por geração no log/população

  const EXAMPLE = [
    { name: 'Melhoria da iluminação', cost: '4000', benefit: '7' },
    { name: 'Instalação de bicicletários', cost: '3000', benefit: '5' },
    { name: 'Aquisição de bancos', cost: '2000', benefit: '3' },
    { name: 'Reforma de espaço de convivência', cost: '5000', benefit: '8' }
  ];

  const FIELDS = ['f-budget', 'f-pop', 'f-gens', 'f-cross', 'f-mut', 'f-tour', 'f-elite', 'f-seed'];

  const app = {
    projects: EXAMPLE.map(p => Object.assign({}, p)),
    run: null,
    running: false,
    loopToken: 0,
    dirty: false,
    valid: true,
    renderedHistory: 0,
    animGen: 0,
    logGen: 0
  };

  /* ================================================================== */
  /* Validação                                                           */
  /* ================================================================== */

  function parseMoney(raw, { positive, max }) {
    const s = raw.trim();
    if (s === '') return { error: 'Campo obrigatório.' };
    if (s.startsWith('-')) return { error: 'Não pode ser negativo.' };
    if (!/^\d+([.,]\d{1,2})?$/.test(s)) {
      return { error: 'Use um número com até 2 casas decimais (ex.: 4000 ou 4000,50), sem separador de milhar.' };
    }
    const [intPart, frac = ''] = s.split(/[.,]/);
    const cents = Number(intPart) * 100 + Number((frac + '00').slice(0, 2));
    if (!Number.isSafeInteger(cents) || cents > max) return { error: 'Valor grande demais.' };
    if (positive && cents === 0) return { error: 'Deve ser maior que zero.' };
    return { value: cents };
  }

  function parseBenefit(raw) {
    const s = raw.trim();
    if (s === '') return { error: 'Campo obrigatório.' };
    if (s.startsWith('-')) return { error: 'Não pode ser negativo.' };
    if (!/^\d+([.,]\d{1,2})?$/.test(s)) return { error: 'Use um número ≥ 0 com até 2 casas decimais.' };
    const [intPart, frac = ''] = s.split(/[.,]/);
    const h = Number(intPart) * 100 + Number((frac + '00').slice(0, 2));
    if (!Number.isSafeInteger(h) || h > MAX_BENEFIT) return { error: 'Valor grande demais.' };
    return { value: h };
  }

  function parseInteger(raw, min, max) {
    const s = raw.trim();
    if (s === '') return { error: 'Campo obrigatório.' };
    if (!/^-?\d+$/.test(s)) return { error: 'Digite um número inteiro.' };
    const v = Number(s);
    if (!Number.isSafeInteger(v)) return { error: 'Valor grande demais.' };
    if (v < min) return { error: `Deve ser ≥ ${min.toLocaleString('pt-BR')}.` };
    if (v > max) return { error: `Deve ser ≤ ${max.toLocaleString('pt-BR')}.` };
    return { value: v };
  }

  function parsePercent(raw) {
    const s = raw.trim();
    if (s === '') return { error: 'Campo obrigatório.' };
    if (!/^-?\d+([.,]\d+)?$/.test(s)) return { error: 'Digite um percentual (ex.: 80 ou 2,5).' };
    const v = Number(s.replace(',', '.'));
    if (v < 0 || v > 100) return { error: 'Deve estar entre 0 e 100.' };
    return { value: v / 100 };
  }

  /** Valida tudo; devolve { ok, config, fieldErrors, projectErrors, cellErrors }. */
  function validate() {
    const fieldErrors = {};
    const cellErrors = {};
    const projectErrors = [];
    const projects = [];

    if (app.projects.length < MIN_PROJECTS || app.projects.length > MAX_PROJECTS) {
      projectErrors.push(`Cadastre entre ${MIN_PROJECTS} e ${MAX_PROJECTS} projetos.`);
    }
    app.projects.forEach((p, i) => {
      const label = `Projeto ${GA.geneLabel(i)}`;
      const name = p.name.trim();
      if (!name) {
        cellErrors[`${i}-name`] = 'Nome obrigatório.';
        projectErrors.push(`${label}: nome obrigatório.`);
      }
      const cost = parseMoney(p.cost, { positive: true, max: MAX_COST_CENTS });
      if (cost.error) {
        cellErrors[`${i}-cost`] = cost.error;
        projectErrors.push(`${label}, custo: ${cost.error}`);
      }
      const ben = parseBenefit(p.benefit);
      if (ben.error) {
        cellErrors[`${i}-benefit`] = ben.error;
        projectErrors.push(`${label}, benefício: ${ben.error}`);
      }
      projects.push({ name, cost: cost.value, benefit: ben.value });
    });

    const val = id => $(id).value;
    const budget = parseMoney(val('f-budget'), { positive: false, max: MAX_BUDGET_CENTS });
    const pop = parseInteger(val('f-pop'), 2, MAX_POPULATION);
    const gens = parseInteger(val('f-gens'), 1, MAX_GENERATIONS);
    const cross = parsePercent(val('f-cross'));
    const mut = parsePercent(val('f-mut'));
    const popMax = pop.error ? MAX_POPULATION : pop.value;
    const tour = parseInteger(val('f-tour'), 2, popMax);
    const elite = parseInteger(val('f-elite'), 0, popMax - 1);
    const seed = parseInteger(val('f-seed'), 0, MAX_SEED);
    if (!pop.error && tour.error && /≤/.test(tour.error)) tour.error = `Deve estar entre 2 e o tamanho da população (${pop.value}).`;
    if (!pop.error && elite.error && /≤/.test(elite.error)) elite.error = `Deve estar entre 0 e população − 1 (${pop.value - 1}).`;

    const parsed = { 'f-budget': budget, 'f-pop': pop, 'f-gens': gens, 'f-cross': cross, 'f-mut': mut, 'f-tour': tour, 'f-elite': elite, 'f-seed': seed };
    for (const id of FIELDS) if (parsed[id].error) fieldErrors[id] = parsed[id].error;

    const ok = !projectErrors.length && !Object.keys(fieldErrors).length;
    const config = ok ? {
      projects,
      budget: budget.value,
      populationSize: pop.value,
      generations: gens.value,
      crossoverRate: cross.value,
      mutationRate: mut.value,
      tournamentSize: tour.value,
      eliteCount: elite.value,
      seed: seed.value
    } : null;
    return { ok, config, fieldErrors, projectErrors, cellErrors };
  }

  function showValidation(v) {
    for (const id of FIELDS) {
      const msg = v.fieldErrors[id] || '';
      $(id).classList.toggle('invalid', !!msg);
      $(id).setAttribute('aria-invalid', msg ? 'true' : 'false');
      document.querySelector(`.error[data-for="${id}"]`).textContent = msg;
    }
    document.querySelectorAll('#projects-body input').forEach(input => {
      const msg = v.cellErrors[`${input.dataset.row}-${input.dataset.key}`] || '';
      input.classList.toggle('invalid', !!msg);
      input.title = msg;
    });
    $('projects-errors').innerHTML = v.projectErrors.map(e => `<li>${esc(e)}</li>`).join('');
    app.valid = v.ok;
  }

  /* ================================================================== */
  /* Tabela de projetos                                                  */
  /* ================================================================== */

  function renderProjects() {
    const body = $('projects-body');
    const canRemove = app.projects.length > MIN_PROJECTS;
    body.innerHTML = app.projects.map((p, i) => `
      <tr>
        <td>${GA.geneLabel(i)}</td>
        <td><input type="text" data-row="${i}" data-key="name" value="${esc(p.name)}" aria-label="Nome do projeto ${GA.geneLabel(i)}" maxlength="80"></td>
        <td><input type="text" data-row="${i}" data-key="cost" value="${esc(p.cost)}" inputmode="decimal" aria-label="Custo do projeto ${GA.geneLabel(i)} em reais"></td>
        <td><input type="text" data-row="${i}" data-key="benefit" value="${esc(p.benefit)}" inputmode="decimal" aria-label="Benefício do projeto ${GA.geneLabel(i)}"></td>
        <td><button class="btn small icon ghost" data-remove="${i}" ${canRemove ? '' : 'disabled'} title="${canRemove ? 'Remover projeto' : `Mínimo de ${MIN_PROJECTS} projetos`}" aria-label="Remover projeto ${GA.geneLabel(i)}">✕</button></td>
      </tr>`).join('');
    $('project-count').textContent = `${app.projects.length} / ${MAX_PROJECTS}`;
    $('add-project').disabled = app.projects.length >= MAX_PROJECTS;
    $('add-project').title = app.projects.length >= MAX_PROJECTS ? `Máximo de ${MAX_PROJECTS} projetos` : '';
  }

  function onProjectsInput(e) {
    const t = e.target;
    if (!t.dataset || t.dataset.row === undefined) return;
    app.projects[+t.dataset.row][t.dataset.key] = t.value;
    markDirty();
  }

  function onProjectsClick(e) {
    const btn = e.target.closest('[data-remove]');
    if (!btn || btn.disabled) return;
    if (app.projects.length <= MIN_PROJECTS) return;
    app.projects.splice(+btn.dataset.remove, 1);
    renderProjects();
    markDirty();
  }

  function addProject() {
    if (app.projects.length >= MAX_PROJECTS) return;
    const letter = GA.geneLabel(app.projects.length);
    app.projects.push({ name: `Projeto ${letter}`, cost: '1000', benefit: '1' });
    renderProjects();
    markDirty();
    const inputs = document.querySelectorAll(`#projects-body input[data-row="${app.projects.length - 1}"]`);
    if (inputs[0]) inputs[0].focus();
  }

  function restoreExample() {
    app.projects = EXAMPLE.map(p => Object.assign({}, p));
    renderProjects();
    markDirty();
  }

  /* ================================================================== */
  /* Estado e controles                                                  */
  /* ================================================================== */

  function markDirty() {
    if (app.running) pause();
    app.dirty = true;
    showValidation(validate());
    updateControls();
  }

  function isDone() {
    return app.run && GA.isDone(app.run);
  }

  function updateControls() {
    const done = isDone();
    const blocked = app.dirty || !app.run;
    $('btn-run').disabled = app.running || blocked || done;
    $('btn-pause').disabled = !app.running;
    $('btn-step').disabled = app.running || blocked || done;
    $('btn-reset').disabled = !app.valid;

    const st = $('status');
    let cls = '';
    let text;
    const g = app.run ? app.run.generation : 0;
    const G = app.run ? app.run.config.generations : 0;
    if (!app.valid) {
      cls = 'invalid';
      text = 'Há campos inválidos. Corrija-os para poder reiniciar.';
    } else if (app.dirty) {
      cls = 'dirty';
      text = 'Dados ou parâmetros alterados: clique em Reiniciar para aplicá-los.';
    } else if (app.running) {
      cls = 'running';
      text = `Executando… geração ${g} de ${G}.`;
    } else if (done) {
      cls = 'done';
      text = `Concluído: ${G} gerações produzidas (${G + 1} registros no histórico, incluindo a geração 0).`;
    } else if (g === 0) {
      text = 'Pronto: geração 0 criada. Use Executar ou Avançar uma geração.';
    } else {
      text = `Pausado na geração ${g} de ${G}.`;
    }
    st.className = 'status ' + cls;
    st.textContent = text;
    updateAnimButtons();
  }

  function reset() {
    const v = validate();
    showValidation(v);
    if (!v.ok) {
      updateControls();
      return;
    }
    app.running = false;
    app.loopToken++;
    Anim.cancel();
    Anim.resetPair();
    app.run = GA.createRun(v.config);
    app.dirty = false;
    app.renderedHistory = 0;
    app.animGen = 0;
    app.logGen = 0;
    $('history-body').innerHTML = '';
    $('eval-output').innerHTML = '';
    renderAll();
    Anim.showStatic(app.run, 0);
    updateControls();
  }

  function start() {
    if (app.running || app.dirty || !app.run || isDone()) return;
    app.running = true;
    const token = ++app.loopToken;
    updateControls();
    loop(token);
  }

  function pause() {
    if (!app.running) return;
    app.running = false;
    app.loopToken++;
    renderAll();
    updateControls();
  }

  function stepOnce() {
    if (app.running || app.dirty || !app.run || isDone()) return;
    Anim.cancel();
    Anim.resetPair();
    GA.step(app.run);
    app.animGen = app.run.generation;
    renderAll();
    updateControls();
    if ($('anim-auto').checked) Anim.play(app.run, app.animGen);
    else Anim.showStatic(app.run, app.animGen);
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));

  async function loop(token) {
    while (app.running && token === app.loopToken && !isDone()) {
      const delay = Number($('speed').value);
      const sync = $('anim-sync').checked;
      if (delay === 0 && !sync) {
        const t0 = performance.now();
        do { GA.step(app.run); } while (!isDone() && performance.now() - t0 < 25);
        app.animGen = app.run.generation;
        renderAll();
        if (!Anim.isPlaying()) Anim.showStatic(app.run, app.animGen);
        await frame();
      } else {
        GA.step(app.run);
        app.animGen = app.run.generation;
        renderAll();
        if (sync) await Anim.play(app.run, app.animGen);
        else if (!Anim.isPlaying()) Anim.showStatic(app.run, app.animGen);
        await sleep(delay);
      }
    }
    if (token !== app.loopToken) return;
    app.running = false;
    renderAll();
    updateControls();
  }

  /* ================================================================== */
  /* Renderização                                                        */
  /* ================================================================== */

  function chromCells(genes) {
    return `<div class="chrom">${genes.map((b, i) =>
      `<span class="gene ${b ? 'on' : 'off'}"><i>${GA.geneLabel(i)}</i><b>${b}</b></span>`).join('')}</div>`;
  }

  function bitsHtml(genes) {
    return genes.map(b => (b ? '1' : '<span class="z">0</span>')).join('');
  }

  function renderAll() {
    if (!app.run) return;
    renderMetrics();
    renderBest();
    renderChart();
    renderPopulation();
    renderHistory();
    renderLogControls();
    if ($('log-follow').checked) {
      app.logGen = app.run.generation;
      renderLog();
    }
    updateControls();
  }

  function renderMetrics() {
    const run = app.run;
    const h = run.history[run.history.length - 1];
    $('m-gen').innerHTML = `${run.generation.toLocaleString('pt-BR')} <small>/ ${run.config.generations.toLocaleString('pt-BR')}</small>`;
    $('m-best').innerHTML = `${points(h.bestFitness)} <small><code>${Fmt.chrom(h.bestGenes)}</code></small>`;
    $('m-avg').textContent = avg(h.avgFitness);
    $('m-acc').innerHTML = `${points(h.bestSoFarFitness)} <small>ger. ${h.bestSoFarGeneration}</small>`;
  }

  function renderBest() {
    const run = app.run;
    const best = run.bestSoFar;
    const { projects, budget } = run.config;
    const ev = GA.evaluate(best.genes, projects, budget);
    const done = isDone();
    $('best-title').textContent = done ? 'Resultado final — melhor solução de toda a execução' : 'Melhor solução encontrada até agora';
    const badge = $('best-badge');
    badge.textContent = done ? 'Concluído' : `até a geração ${run.generation}`;
    badge.className = 'pill' + (done ? ' ok' : '');
    const chosen = ev.selected.length
      ? ev.selected.map(i => `<li><span><span class="tag">${GA.geneLabel(i)}</span>${esc(projects[i].name)}</span><span class="muted">${money(projects[i].cost)} · ${points(projects[i].benefit)} pts</span></li>`).join('')
      : '<li class="muted">Nenhum projeto (seleção vazia, aptidão 0)</li>';
    $('best-solution').innerHTML = `
      <div class="solution">
        <div>
          <h3>Cromossomo</h3>
          ${chromCells(best.genes)}
          <div class="totals">
            <div class="total"><span>Custo total</span><b>${money(ev.cost)}</b></div>
            <div class="total"><span>Benefício total</span><b>${points(ev.benefit)}</b></div>
            <div class="total"><span>Saldo do orçamento</span><b>${money(ev.balance)}</b></div>
          </div>
          <p class="muted small">Cromossomo <code>${Fmt.chrom(best.genes)}</code> · aptidão ${points(best.fitness)} · encontrada na geração ${best.generation} (indivíduo #${best.index}) · orçamento ${money(budget)} · ${ev.feasible ? 'solução viável' : 'INVIÁVEL'}</p>
        </div>
        <div>
          <h3>Projetos escolhidos (${ev.selected.length})</h3>
          <ul class="chosen">${chosen}</ul>
        </div>
      </div>`;
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v) return m * mag;
    return 10 * mag;
  }

  function renderChart() {
    const H = app.run.history;
    const G = app.run.config.generations;
    const W = 640, HT = 230, L = 46, R = 14, T = 12, B = 30;
    const maxV = niceMax(Math.max(...H.map(h => h.bestSoFarFitness)) / 100 * 1.05);
    const x = g => L + (g / Math.max(G, 1)) * (W - L - R);
    const y = v => T + (1 - v / maxV) * (HT - T - B);
    const stride = Math.max(1, Math.ceil(H.length / 1500));
    const pts = key => {
      const out = [];
      for (let i = 0; i < H.length; i += stride) out.push(`${x(H[i].generation).toFixed(1)},${y(H[i][key] / 100).toFixed(1)}`);
      const last = H[H.length - 1];
      if ((H.length - 1) % stride) out.push(`${x(last.generation).toFixed(1)},${y(last[key] / 100).toFixed(1)}`);
      return out.join(' ');
    };
    let grid = '';
    for (let k = 0; k <= 4; k++) {
      const v = (maxV * k) / 4;
      grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
      grid += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</text>`;
    }
    const xt = new Set([0, Math.round(G / 4), Math.round(G / 2), Math.round((3 * G) / 4), G]);
    for (const g of xt) grid += `<text x="${x(g)}" y="${HT - 10}" text-anchor="middle">${g}</text>`;
    $('chart').innerHTML = `
      <svg viewBox="0 0 ${W} ${HT}" role="img" aria-label="Gráfico da aptidão por geração">
        ${grid}
        <line class="axis" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>
        <line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${y(0)}"/>
        <text x="${(L + W - R) / 2}" y="${HT}" text-anchor="middle">geração</text>
        <polyline class="l-avg" points="${pts('avgFitness')}"/>
        <polyline class="l-best" points="${pts('bestFitness')}"/>
        <polyline class="l-acc" points="${pts('bestSoFarFitness')}"/>
      </svg>`;
  }

  function renderPopulation() {
    const pop = app.run.population;
    const bi = GA.bestIndex(pop);
    const shown = Math.min(pop.length, LIST_LIMIT);
    let html = '';
    for (let i = 0; i < shown; i++) {
      const ind = pop[i];
      const cls = (ind.origin === 'elite' ? ' elite' : '') + (i === bi ? ' best' : '');
      const origin = ind.origin === 'elite' ? `<span class="badge">ELITE</span>` : '';
      html += `<div class="ind${cls}"><span class="idx">#${i}</span><span class="bits">${bitsHtml(ind.genes)}</span>${origin}
        <span class="meta"><b>${points(ind.fitness)}</b><small>${money(ind.cost)}</small></span></div>`;
    }
    $('population').innerHTML = html;
    $('pop-info').textContent = `geração ${app.run.generation} · ${pop.length} indivíduos${pop.length > shown ? ` (mostrando ${shown})` : ''}`;
  }

  function renderHistory() {
    const H = app.run.history;
    const body = $('history-body');
    const wrap = body.closest('.history-wrap');
    const atBottom = wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 30;
    let html = '';
    for (let i = app.renderedHistory; i < H.length; i++) {
      const h = H[i];
      const improved = i === 0 || h.bestSoFarFitness > H[i - 1].bestSoFarFitness;
      html += `<tr class="${improved ? 'improved' : ''}"><td>${h.generation}</td><td>${points(h.bestFitness)}</td><td><code>${Fmt.chrom(h.bestGenes)}</code></td>
        <td>${avg(h.avgFitness)}</td><td>${points(h.bestSoFarFitness)}</td><td><code>${Fmt.chrom(h.bestSoFarGenes)}</code> (ger. ${h.bestSoFarGeneration})</td></tr>`;
    }
    if (html) body.insertAdjacentHTML('beforeend', html);
    app.renderedHistory = H.length;
    if (atBottom) wrap.scrollTop = wrap.scrollHeight;
  }

  /* ------------------------------ log ------------------------------ */

  function code(genes) {
    return `<code>${Fmt.chrom(genes)}</code>`;
  }

  function cutCode(genes, cut, firstCls, secondCls) {
    return `<code><span class="${firstCls}">${Fmt.chrom(genes.slice(0, cut))}</span><span class="cut">|</span><span class="${secondCls}">${Fmt.chrom(genes.slice(cut))}</span></code>`;
  }

  function mutCode(genes, flipped) {
    const set = new Set(flipped);
    return `<code>${genes.map((b, i) => (set.has(i) ? `<span class="m">${b}</span>` : b)).join('')}</code>`;
  }

  function repairText(start, rep, projects, budget) {
    if (!rep.steps.length) return `${code(start)} viável (custo ${money(rep.initialCost)} ≤ ${money(budget)}), sem reparação`;
    let s = `${code(start)} (custo ${money(rep.initialCost)} &gt; ${money(budget)})`;
    for (const st of rep.steps) {
      s += ` → ${code(st.genes)} (remove <span class="rm">${GA.geneLabel(st.removed)}</span>, razão ${Fmt.ratio(projects[st.removed])})`;
    }
    return s;
  }

  function summaryEntry(gen) {
    const h = app.run.history[gen];
    return `<div class="log-entry summary"><h4>Resumo da geração ${gen}</h4>
      Melhor aptidão ${points(h.bestFitness)} (#${h.bestIndex}, ${code(h.bestGenes)}, custo ${money(h.bestCost)}) ·
      média ${avg(h.avgFitness)} · melhor acumulado ${points(h.bestSoFarFitness)} (${code(h.bestSoFarGenes)}, geração ${h.bestSoFarGeneration})</div>`;
  }

  function generationLogHtml(gen, limit) {
    const run = app.run;
    const { projects, budget } = run.config;
    const log = run.logs[gen];
    if (!log || log.trimmed) {
      return `<div class="log-entry">Os detalhes da geração ${gen} foram descartados para economizar memória (execução muito longa). O resumo continua no histórico.</div>` + summaryEntry(gen);
    }
    let html = '';
    if (gen === 0) {
      const items = log.initial.slice(0, limit).map(it =>
        `<li>#${it.index}: sorteado ${code(it.raw)} → ${it.repair.steps.length ? 'reparação: ' : ''}${repairText(it.raw, it.repair, projects, budget)}; aptidão <b>${points(it.fitness)}</b>, custo ${money(it.cost)}</li>`).join('');
      const more = log.initial.length > limit ? `<li class="muted">… mais ${log.initial.length - limit} indivíduos (baixe o log para ver todos)</li>` : '';
      html += `<div class="log-entry"><h4>Geração 0 — população inicial aleatória (${log.initial.length} indivíduos, P(gene = 1) = 50%)</h4><ul>${items}${more}</ul></div>`;
      return html + summaryEntry(0);
    }

    html += `<div class="log-entry"><h4>Geração ${gen} — produzida a partir da geração ${gen - 1}</h4>
      Cruzamento ${Fmt.pct(run.config.crossoverRate)} por par · mutação ${Fmt.pct(run.config.mutationRate)} por gene · torneio de ${run.config.tournamentSize} · elite ${run.config.eliteCount}</div>`;

    html += `<div class="log-entry elite-entry"><h4>Elitismo</h4>${log.elites.length
      ? `<ul>${log.elites.map(e => `<li>#${e.from} ${code(e.genes)} (aptidão ${points(e.fitness)}, custo ${money(e.cost)}) copiado sem modificação para #${e.to}</li>`).join('')}</ul>`
      : 'Quantidade de elite = 0: nenhum indivíduo preservado.'}</div>`;

    for (const p of log.pairs.slice(0, limit)) {
      const cr = p.crossover;
      const slots = p.children.map(c => `#${c.to}`).join(' e ');
      const tour = p.tournaments.map((t, k) => {
        const cands = t.candidates.map(c => `#${c.index} ${code(c.genes)} (${points(c.fitness)})`).join(', ');
        return `torneio ${k + 1}: ${cands} → <b class="c${k + 1}">pai ${k + 1} = #${t.winner}</b> ${code(p.parents[k].genes)}`;
      }).join('; ');
      const crossText = cr.happened
        ? `sorteio ${Fmt.prob(cr.roll)} &lt; ${Fmt.pct(run.config.crossoverRate)} → corte após o ${Fmt.ordinal(cr.cut)} gene: ${cutCode(p.parents[0].genes, cr.cut, 'c1', 'c1')} + ${cutCode(p.parents[1].genes, cr.cut, 'c2', 'c2')} → filhos ${cutCode(cr.children[0], cr.cut, 'c1', 'c2')} e ${cutCode(cr.children[1], cr.cut, 'c2', 'c1')}`
        : `sorteio ${Fmt.prob(cr.roll)} ≥ ${Fmt.pct(run.config.crossoverRate)} → sem cruzamento; filhos copiam os pais: ${code(cr.children[0])} e ${code(cr.children[1])}`;
      const mutText = p.children.map(c => (c.flipped.length
        ? `filho ${c.child + 1}: ${code(c.afterCrossover)} → ${mutCode(c.mutated, c.flipped)} (gene${c.flipped.length > 1 ? 's' : ''} ${c.flipped.map(i => GA.geneLabel(i)).join(', ')} invertido${c.flipped.length > 1 ? 's' : ''})`
        : `filho ${c.child + 1}: nenhum gene invertido (${code(c.mutated)})`)).join('; ');
      const repText = p.children.map(c => `filho ${c.child + 1}: ${repairText(c.mutated, c.repair, projects, budget)}`).join('; ');
      const evalText = p.children.map(c => `filho ${c.child + 1} = ${code(c.genes)} · custo ${money(c.cost)} · aptidão <b>${points(c.fitness)}</b> → #${c.to}`).join('; ');
      html += `<div class="log-entry"><h4>Par ${p.number + 1} → vaga${p.children.length > 1 ? 's' : ''} ${slots}</h4><ul>
        <li><b>Seleção:</b> ${tour}</li>
        <li><b>Cruzamento:</b> ${crossText}</li>
        ${p.keep < 2 ? `<li><b>Vaga única:</b> o filho 2 ${code(p.discarded)} é descartado; só o filho 1 segue.</li>` : ''}
        <li><b>Mutação:</b> ${mutText}</li>
        <li><b>Reparação:</b> ${repText}</li>
        <li><b>Avaliação:</b> ${evalText}</li>
      </ul></div>`;
    }
    if (log.pairs.length > limit) html += `<div class="log-entry muted">… mais ${log.pairs.length - limit} pares (baixe o log para ver todos)</div>`;
    return html + summaryEntry(gen);
  }

  function renderLogControls() {
    const input = $('log-gen');
    input.max = String(app.run.generation);
  }

  function renderLog() {
    const g = Math.max(0, Math.min(app.logGen, app.run.generation));
    app.logGen = g;
    $('log-gen').value = String(g);
    $('log').innerHTML = generationLogHtml(g, LIST_LIMIT);
    $('log-prev').disabled = g <= 0;
    $('log-next').disabled = g >= app.run.generation;
    $('log-animate').disabled = g < 1;
  }

  function setLogGen(g, unfollow) {
    if (!app.run) return;
    if (unfollow) $('log-follow').checked = false;
    app.logGen = g;
    renderLog();
  }

  function htmlToText(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const lines = [];
    div.querySelectorAll('.log-entry').forEach(entry => {
      const h4 = entry.querySelector('h4');
      if (h4) lines.push(h4.textContent.trim());
      const lis = entry.querySelectorAll('li');
      if (lis.length) {
        lis.forEach(li => lines.push('  - ' + li.textContent.replace(/\s+/g, ' ').trim()));
      } else {
        const clone = entry.cloneNode(true);
        const ch = clone.querySelector('h4');
        if (ch) ch.remove();
        const t = clone.textContent.replace(/\s+/g, ' ').trim();
        if (t) lines.push('  ' + t);
      }
    });
    return lines.join('\n');
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadLog() {
    if (!app.run) return;
    const cfg = app.run.config;
    const header = [
      'Simulador de Algoritmo Genético — log das etapas',
      `Projetos: ${cfg.projects.map((p, i) => `${GA.geneLabel(i)} = ${p.name} (custo ${money(p.cost)}, benefício ${points(p.benefit)})`).join('; ')}`,
      `Orçamento ${money(cfg.budget)} · população ${cfg.populationSize} · gerações ${cfg.generations} · cruzamento ${Fmt.pct(cfg.crossoverRate)} · mutação ${Fmt.pct(cfg.mutationRate)} · torneio ${cfg.tournamentSize} · elite ${cfg.eliteCount} · semente ${cfg.seed}`,
      ''
    ];
    const parts = [];
    for (let g = 0; g <= app.run.generation; g++) parts.push(htmlToText(generationLogHtml(g, Infinity)));
    const best = app.run.bestSoFar;
    const ev = GA.evaluate(best.genes, cfg.projects, cfg.budget);
    parts.push(`\nMelhor solução da execução: ${Fmt.chrom(best.genes)} — projetos ${Fmt.letters(ev.selected)}; custo ${money(ev.cost)}; benefício ${points(ev.benefit)}; saldo ${money(ev.balance)} (geração ${best.generation})`);
    download(`log-ag-semente-${cfg.seed}.txt`, header.join('\n') + parts.join('\n\n') + '\n', 'text/plain;charset=utf-8');
  }

  function downloadHistory() {
    if (!app.run) return;
    const rows = ['geracao;melhor_aptidao;cromossomo_melhor;aptidao_media;melhor_acumulado;cromossomo_acumulado;geracao_acumulado'];
    for (const h of app.run.history) {
      rows.push([h.generation, h.bestFitness / 100, Fmt.chrom(h.bestGenes), (h.avgFitness / 100).toFixed(4), h.bestSoFarFitness / 100, Fmt.chrom(h.bestSoFarGenes), h.bestSoFarGeneration].join(';'));
    }
    download(`historico-ag-semente-${app.run.config.seed}.csv`, rows.join('\n') + '\n', 'text/csv;charset=utf-8');
  }

  /* --------------------------- animação --------------------------- */

  function updateAnimButtons() {
    const playing = Anim.isPlaying();
    const can = app.run && app.animGen >= 1 && app.run.logs[app.animGen] && !app.run.logs[app.animGen].trimmed;
    const pairs = can ? app.run.logs[app.animGen].pairs.length : 0;
    const cur = Anim.getCurrentPair();
    $('anim-play').disabled = !can;
    $('anim-prev').disabled = !can || cur <= 0;
    $('anim-next').disabled = !can || cur >= pairs - 1;
    $('anim-stop').disabled = !playing;
  }

  function animPair(delta) {
    if (!app.run || app.animGen < 1) return;
    const pairs = app.run.logs[app.animGen].pairs.length;
    const cur = Anim.getCurrentPair();
    const next = Math.max(0, Math.min(pairs - 1, cur + delta));
    Anim.play(app.run, app.animGen, next);
  }

  /* ----------------------- avaliação manual ----------------------- */

  function evaluateManual() {
    const out = $('eval-output');
    if (!app.run) return;
    const { projects, budget } = app.run.config;
    const s = $('eval-input').value.trim();
    if (!new RegExp(`^[01]{${projects.length}}$`).test(s)) {
      out.innerHTML = `<div class="eval bad">Digite exatamente ${projects.length} dígitos 0/1 (um por projeto, na ordem ${projects.map((_, i) => GA.geneLabel(i)).join(', ')}).</div>`;
      return;
    }
    const genes = GA.stringToGenes(s);
    const ev = GA.evaluate(genes, projects, budget);
    const rep = GA.repair(genes, projects, budget);
    const fin = GA.evaluate(rep.genes, projects, budget);
    let html = `<div class="eval"><p>Cromossomo ${code(genes)} → projetos ${Fmt.letters(ev.selected)}; custo total ${money(ev.cost)}; benefício total ${points(ev.benefit)}; saldo ${money(ev.balance)} (orçamento ${money(budget)}) → ${ev.feasible ? '<span class="good">solução viável</span>' : '<span class="bad">inviável</span>'}.</p>`;
    if (rep.steps.length) {
      html += '<p>Reparação (remove o selecionado com menor razão benefício/custo; empate → menor índice):</p><ul>';
      for (const st of rep.steps) {
        html += `<li>remove <b>${GA.geneLabel(st.removed)}</b> (${esc(projects[st.removed].name)}, ${Fmt.ratio(projects[st.removed])}) → ${code(st.genes)}: custo ${money(st.cost)}; benefício ${points(st.benefit)}</li>`;
      }
      html += '</ul>';
    }
    html += `<p>Solução ${rep.steps.length ? 'reparada' : 'avaliada'}: ${code(rep.genes)} — projetos ${Fmt.letters(fin.selected)}; custo ${money(fin.cost)}; benefício ${points(fin.benefit)}; saldo ${money(fin.balance)}; <b>aptidão ${points(fin.benefit)}</b>.</p></div>`;
    out.innerHTML = html;
  }

  /* ----------------------------- testes ----------------------------- */

  function runTests() {
    const results = GATests.runAll();
    const passed = results.filter(r => r.pass).length;
    const sum = $('tests-summary');
    sum.textContent = `${passed} de ${results.length} testes passaram.`;
    sum.className = 'tests-summary ' + (passed === results.length ? 'ok' : 'bad');
    $('tests-output').innerHTML = results.map(r => `
      <details class="test ${r.pass ? 'pass' : 'fail'}" ${r.pass ? '' : 'open'}>
        <summary><span class="sec">${r.section}</span>${esc(r.title)}<span class="res">${r.pass ? 'passou' : 'falhou'}</span></summary>
        <ul>${r.lines.map(l => `<li class="${l.info ? 'i' : l.pass ? 'p' : 'f'}">${esc(l.text)}</li>`).join('')}</ul>
      </details>`).join('');
  }

  function runExperiment() {
    const out = $('experiment-output');
    out.innerHTML = '<p class="muted">Executando…</p>';
    setTimeout(() => {
      const res = GATests.mutationExperiment();
      let html = '';
      for (const r of res) {
        html += `<h3 style="margin-top:16px">Mutação ${Fmt.pct(r.rate)}</h3><div class="exp-wrap"><table class="exp-table">
          <thead><tr><th>Semente</th><th>Melhor cromossomo</th><th>Melhor benefício final</th><th>Custo</th><th>Encontrado na geração</th><th>Aptidão média na geração 50</th></tr></thead><tbody>
          ${r.runs.map(x => `<tr><td>${x.seed}</td><td><code>${x.genes}</code></td><td>${points(x.fitness)}</td><td>${money(x.cost)}</td><td>${x.generationFound}</td><td>${avg(x.finalAvg)}</td></tr>`).join('')}
          </tbody></table></div>
          <p><b>Média do melhor benefício final:</b> ${(r.mean / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} · <b>Execuções que atingiram 12:</b> ${r.hits} de ${r.runs.length}</p>`;
      }
      out.innerHTML = html;
    }, 30);
  }

  /* ================================================================== */
  /* Inicialização                                                       */
  /* ================================================================== */

  function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => {
          const on = t === tab;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          $('tab-' + t.dataset.tab).hidden = !on;
        });
      });
    });
  }

  function init() {
    Anim.init(updateAnimButtons);
    initTabs();
    renderProjects();

    $('projects-body').addEventListener('input', onProjectsInput);
    $('projects-body').addEventListener('click', onProjectsClick);
    $('add-project').addEventListener('click', addProject);
    $('reset-example').addEventListener('click', restoreExample);
    for (const id of FIELDS) $(id).addEventListener('input', markDirty);

    $('btn-run').addEventListener('click', start);
    $('btn-pause').addEventListener('click', pause);
    $('btn-step').addEventListener('click', stepOnce);
    $('btn-reset').addEventListener('click', reset);

    const speed = $('speed');
    const speedLabel = () => { $('speed-label').textContent = speed.value === '0' ? 'o mais rápido possível' : `${speed.value} ms`; };
    speed.addEventListener('input', speedLabel);
    speedLabel();

    const aSpeed = $('anim-speed');
    const aSpeedChange = () => {
      Anim.setSpeed(Number(aSpeed.value));
      $('anim-speed-label').textContent = Number(aSpeed.value).toLocaleString('pt-BR') + '×';
    };
    aSpeed.addEventListener('input', aSpeedChange);
    aSpeedChange();

    $('anim-play').addEventListener('click', () => app.run && Anim.play(app.run, app.animGen));
    $('anim-prev').addEventListener('click', () => animPair(-1));
    $('anim-next').addEventListener('click', () => animPair(+1));
    $('anim-stop').addEventListener('click', () => { Anim.cancel(); Anim.showStatic(app.run, app.animGen); updateAnimButtons(); });

    $('log-gen').addEventListener('change', () => {
      const v = parseInt($('log-gen').value, 10);
      setLogGen(Number.isFinite(v) ? v : 0, true);
    });
    $('log-prev').addEventListener('click', () => setLogGen(app.logGen - 1, true));
    $('log-next').addEventListener('click', () => setLogGen(app.logGen + 1, true));
    $('log-follow').addEventListener('change', () => { if ($('log-follow').checked) setLogGen(app.run.generation, false); });
    $('log-animate').addEventListener('click', () => {
      if (!app.run || app.logGen < 1) return;
      Anim.resetPair();
      app.animGen = app.logGen;
      Anim.play(app.run, app.animGen);
      $('anim-stage').closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('log-download').addEventListener('click', downloadLog);
    $('history-download').addEventListener('click', downloadHistory);

    $('eval-btn').addEventListener('click', evaluateManual);
    $('eval-input').addEventListener('keydown', e => { if (e.key === 'Enter') evaluateManual(); });

    $('run-tests').addEventListener('click', runTests);
    $('run-experiment').addEventListener('click', runExperiment);

    reset();
  }

  init();
})();
