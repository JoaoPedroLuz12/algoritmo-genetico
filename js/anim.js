/*
 * Animação didática das operações de uma geração.
 * Tudo o que é mostrado vem do log real produzido por GA.step (js/ga.js):
 * candidatos e vencedores dos torneios, sorteio e ponto de corte do cruzamento,
 * bits invertidos pela mutação, projetos removidos na reparação e elitismo.
 */
(function (global) {
  'use strict';

  const CANCELLED = Symbol('cancelled');
  let token = 0;
  let speed = 1;
  let playing = false;

  const el = {};
  const listeners = { change: () => {} };

  function init(onChange) {
    el.caption = document.getElementById('anim-caption');
    el.stage = document.getElementById('anim-stage');
    el.src = document.getElementById('anim-src');
    el.dst = document.getElementById('anim-dst');
    el.srcTitle = document.getElementById('anim-src-title');
    el.dstTitle = document.getElementById('anim-dst-title');
    el.title = document.getElementById('anim-title');
    listeners.change = onChange || (() => {});
  }

  function setSpeed(value) {
    speed = value;
  }

  function isPlaying() {
    return playing;
  }

  function cancel() {
    token++;
    if (playing) {
      playing = false;
      listeners.change();
    }
  }

  function wait(ms, myToken) {
    return new Promise((resolve, reject) => {
      setTimeout(() => (myToken === token ? resolve() : reject(CANCELLED)), ms / speed);
    });
  }

  /* --------------------------- desenho --------------------------- */

  function geneHtml(bit, i, cls) {
    return `<span class="gene ${bit ? 'on' : 'off'} ${cls || ''}" data-i="${i}"><i>${GA.geneLabel(i)}</i><b>${bit}</b></span>`;
  }

  /** origin: array com 'p1' | 'p2' | '' por gene (para colorir a procedência). */
  function rowHtml(id, label, sub, genes, origin, info) {
    const cells = genes.map((b, i) => geneHtml(b, i, origin ? origin[i] : '')).join('');
    return `<div class="stage-row" id="${id}">
      <div class="stage-label">${label}${sub ? `<small>${sub}</small>` : ''}</div>
      <div class="chrom">${cells}</div>
      <div class="stage-info">${info || ''}</div>
    </div>`;
  }

  function costInfo(cost, benefit, budget) {
    const over = cost > budget;
    return `custo <b class="${over ? 'over' : 'okc'}">${Fmt.money(cost)}</b>${over ? ' &gt; orçamento' : ''} · benefício <b>${Fmt.points(benefit)}</b>`;
  }

  function chipHtml(i, ind, extra) {
    const genes = ind ? Fmt.chrom(ind.genes) : '·'.repeat(4);
    const fit = ind ? Fmt.points(ind.fitness) : '';
    return `<div class="chip ${extra || ''}" data-idx="${i}"><span class="idx">#${i}</span><span>${genes}</span><span class="fit">${fit}</span></div>`;
  }

  function scrollChip(container, chip) {
    if (!chip) return;
    const top = chip.offsetTop - container.offsetTop;
    if (top < container.scrollTop || top > container.scrollTop + container.clientHeight - chip.offsetHeight) {
      container.scrollTop = top - container.clientHeight / 2;
    }
  }

  function renderSource(population, gen) {
    el.srcTitle.textContent = `Geração ${gen} (origem dos pais)`;
    if (!population) {
      el.src.innerHTML = '<div class="chip empty">detalhes não armazenados</div>';
      return;
    }
    el.src.innerHTML = population.map((ind, i) => chipHtml(i, ind)).join('');
  }

  function renderDest(log, population, upToPair, includeElites) {
    el.dstTitle.textContent = `Geração ${log.generation} (nova)`;
    const N = population ? population.length : 0;
    const filled = new Map();
    if (includeElites) for (const e of log.elites) filled.set(e.to, 'elite');
    for (const p of log.pairs) {
      if (p.number >= upToPair) break;
      for (const c of p.children) filled.set(c.to, '');
    }
    let html = '';
    for (let i = 0; i < N; i++) {
      html += filled.has(i) ? chipHtml(i, population[i], filled.get(i)) : `<div class="chip empty" data-idx="${i}"><span class="idx">#${i}</span><span>vaga</span></div>`;
    }
    el.dst.innerHTML = html;
  }

  function fillDest(slot, ind, cls) {
    const chip = el.dst.querySelector(`[data-idx="${slot}"]`);
    if (!chip) return;
    chip.outerHTML = chipHtml(slot, ind, `${cls || ''} fresh`);
    scrollChip(el.dst, el.dst.querySelector(`[data-idx="${slot}"]`));
  }

  function clearSourceMarks() {
    el.src.querySelectorAll('.chip').forEach(c => c.classList.remove('cand', 'win1', 'win2', 'elite'));
  }

  function markSource(index, cls) {
    const chip = el.src.querySelector(`[data-idx="${index}"]`);
    if (chip) {
      chip.classList.add(cls);
      scrollChip(el.src, chip);
    }
  }

  function caption(stepLabel, html) {
    el.caption.innerHTML = `<span class="step">${stepLabel}</span>${html}`;
  }

  /* ---------------------- estado sem animação ---------------------- */

  /** Mostra o resultado final de uma geração (sem animar). */
  function showStatic(run, gen) {
    el.title.textContent = gen === 0 ? 'Geração 0' : `Geração ${gen - 1} → ${gen}`;
    if (gen === 0) {
      renderSource(run.populations[0], 0);
      el.srcTitle.textContent = 'Geração 0 (inicial)';
      el.dstTitle.textContent = 'Nova geração';
      el.dst.innerHTML = '<div class="chip empty">clique em “Avançar uma geração”</div>';
      caption('Geração 0', 'População inicial: cada gene foi sorteado com 50% de chance de ser 0 ou 1 e cada indivíduo foi reparado e avaliado. Veja os detalhes no log. Avance uma geração para ver seleção, cruzamento, mutação, reparação e elitismo.');
      el.stage.innerHTML = '<div class="stage-empty">Nenhuma operação genética ainda — a geração 0 é aleatória.</div>';
      return;
    }
    const log = run.logs[gen];
    if (!log || log.trimmed) {
      caption(`Geração ${gen}`, 'Os detalhes desta geração foram descartados para economizar memória (execução muito longa).');
      el.stage.innerHTML = '';
      el.src.innerHTML = '';
      el.dst.innerHTML = '';
      return;
    }
    renderSource(run.populations[gen - 1], gen - 1);
    renderDest(log, run.populations[gen], Infinity, true);
    caption(`Geração ${gen}`, `Pronta: ${log.elites.length} indivíduo(s) de elite e ${log.pairs.length} par(es) de pais. Clique em “Animar geração” para ver cada operação passo a passo.`);
    el.stage.innerHTML = '<div class="stage-empty">Clique em <b>▶ Animar geração</b> (ou nos botões de par) para rever as operações desta geração.</div>';
  }

  /* --------------------------- animações --------------------------- */

  async function animateElites(run, log, t) {
    clearSourceMarks();
    const E = log.elites.length;
    if (E === 0) {
      caption('Elitismo', 'Quantidade de elite = 0: nenhum indivíduo é preservado; todas as vagas serão preenchidas por filhos.');
      el.stage.innerHTML = '<div class="stage-empty">Sem elitismo nesta configuração.</div>';
      await wait(1400, t);
      return;
    }
    const rows = log.elites.map(e =>
      rowHtml(`el-${e.to}`, `Elite → #${e.to}`, `origem #${e.from}`, e.genes, e.genes.map(() => ''), `aptidão <b>${Fmt.points(e.fitness)}</b> · custo ${Fmt.money(e.cost)}`)
    ).join('');
    el.stage.innerHTML = rows;
    el.stage.querySelectorAll('.gene').forEach(g => g.style.borderColor = 'var(--elite)');
    caption('Elitismo', `Os ${E} melhor(es) da geração ${log.generation - 1} (maior aptidão; empate pelo menor índice) são copiados <b>sem modificação</b> para as primeiras vagas: ` +
      log.elites.map(e => `#${e.from} (<code>${Fmt.chrom(e.genes)}</code>, aptidão ${Fmt.points(e.fitness)}) → #${e.to}`).join('; ') + '.');
    for (const e of log.elites) {
      markSource(e.from, 'elite');
      await wait(500, t);
      fillDest(e.to, run.populations[log.generation][e.to], 'elite');
    }
    await wait(1500, t);
  }

  async function animatePair(run, log, pair, t) {
    const cfg = run.config;
    const { projects, budget } = cfg;
    const n = projects.length;
    const total = log.pairs.length;
    const P = `Par ${pair.number + 1}/${total}`;

    // ---------- Seleção ----------
    el.stage.innerHTML = '';
    for (let k = 0; k < 2; k++) {
      clearSourceMarks();
      if (k === 1) markSource(pair.parents[0].index, 'win1');
      const tt = pair.tournaments[k];
      const cands = tt.candidates.map(c => `#${c.index} (<code>${Fmt.chrom(c.genes)}</code>, apt. ${Fmt.points(c.fitness)})`).join(', ');
      caption(`${P} · Torneio ${k + 1}`, `Sorteados ${tt.candidates.length} candidatos distintos da geração ${log.generation - 1}: ${cands}.`);
      for (const c of tt.candidates) markSource(c.index, 'cand');
      await wait(1200, t);
      const w = tt.candidates.find(c => c.index === tt.winner);
      const tie = tt.candidates.filter(c => c.fitness === w.fitness).length > 1;
      caption(`${P} · Torneio ${k + 1}`, `Vence #${tt.winner} com aptidão ${Fmt.points(w.fitness)}${tie ? ' (empate resolvido pelo menor índice)' : ''} → <b>pai ${k + 1}</b>.`);
      for (const c of tt.candidates) {
        const chip = el.src.querySelector(`[data-idx="${c.index}"]`);
        if (chip && c.index !== tt.winner) chip.classList.remove('cand');
      }
      markSource(tt.winner, k === 0 ? 'win1' : 'win2');
      const pg = pair.parents[k].genes;
      const ev = GA.evaluate(pg, projects, budget);
      el.stage.insertAdjacentHTML('beforeend',
        rowHtml(`row-${k}`, `Pai ${k + 1}`, `#${tt.winner}`, pg, pg.map(() => (k === 0 ? 'p1' : 'p2')), costInfo(ev.cost, ev.benefit, budget)));
      await wait(1100, t);
    }
    clearSourceMarks();
    markSource(pair.parents[0].index, 'win1');
    markSource(pair.parents[1].index, 'win2');

    // ---------- Cruzamento ----------
    const cr = pair.crossover;
    const row0 = () => document.getElementById('row-0');
    const row1 = () => document.getElementById('row-1');
    let origin;
    if (cr.happened) {
      caption(`${P} · Cruzamento`, `Sorteio ${Fmt.prob(cr.roll)} &lt; ${Fmt.pct(cfg.crossoverRate)} → há cruzamento. Corte sorteado <b>após o ${Fmt.ordinal(cr.cut)} gene</b>.`);
      await wait(700, t);
      for (const r of [row0(), row1()]) r.querySelector(`.gene[data-i="${cr.cut}"]`).classList.add('gap');
      await wait(1000, t);
      caption(`${P} · Cruzamento`, `Os segmentos depois do corte são trocados entre os pais.`);
      const a = row0().getBoundingClientRect();
      const b = row1().getBoundingClientRect();
      const dy = b.top - a.top;
      row0().querySelectorAll('.gene').forEach(g => { if (+g.dataset.i >= cr.cut) g.style.transform = `translateY(${dy}px)`; });
      row1().querySelectorAll('.gene').forEach(g => { if (+g.dataset.i >= cr.cut) g.style.transform = `translateY(${-dy}px)`; });
      await wait(900, t);
      origin = [
        Array.from({ length: n }, (_, i) => (i < cr.cut ? 'p1' : 'p2')),
        Array.from({ length: n }, (_, i) => (i < cr.cut ? 'p2' : 'p1'))
      ];
    } else {
      caption(`${P} · Cruzamento`, `Sorteio ${Fmt.prob(cr.roll)} ≥ ${Fmt.pct(cfg.crossoverRate)} → <b>não há cruzamento</b>: os filhos são cópias dos pais.`);
      origin = [Array(n).fill('p1'), Array(n).fill('p2')];
      await wait(1200, t);
    }
    const kids = cr.children;
    const html = [0, 1].map(c => {
      const ev = GA.evaluate(kids[c], projects, budget);
      const sub = cr.happened ? `${Fmt.chrom(kids[c].slice(0, cr.cut))}|${Fmt.chrom(kids[c].slice(cr.cut))}` : `cópia do pai ${c + 1}`;
      return rowHtml(`row-${c}`, `Filho ${c + 1}`, sub, kids[c], origin[c], costInfo(ev.cost, ev.benefit, budget));
    }).join('');
    el.stage.innerHTML = html;
    if (cr.happened) {
      for (const r of [row0(), row1()]) r.querySelector(`.gene[data-i="${cr.cut}"]`).classList.add('gap');
    }
    caption(`${P} · Cruzamento`, cr.happened
      ? `Filhos: <code>${Fmt.chrom(kids[0])}</code> e <code>${Fmt.chrom(kids[1])}</code> (cores indicam de qual pai veio cada gene).`
      : `Filhos: <code>${Fmt.chrom(kids[0])}</code> e <code>${Fmt.chrom(kids[1])}</code> (cópias).`);
    await wait(1300, t);
    if (cr.happened) for (const r of [row0(), row1()]) r.querySelector(`.gene[data-i="${cr.cut}"]`).classList.remove('gap');

    // Vaga única: o filho 2 é descartado antes da mutação.
    if (pair.keep < 2) {
      row1().classList.add('dim');
      row1().querySelector('.stage-label').innerHTML = 'Filho 2<small>descartado</small>';
      caption(`${P} · Vaga única`, 'Resta apenas uma vaga na nova geração: somente o <b>filho 1</b> segue; o filho 2 é descartado.');
      await wait(1300, t);
    }

    // ---------- Mutação ----------
    const muts = pair.children.map(c => (c.flipped.length
      ? `filho ${c.child + 1}: gene(s) ${c.flipped.map(i => GA.geneLabel(i)).join(', ')} → <code>${Fmt.chrom(c.mutated)}</code>`
      : `filho ${c.child + 1}: nenhum gene invertido`)).join('; ');
    caption(`${P} · Mutação`, `Cada gene de cada filho é invertido com probabilidade ${Fmt.pct(cfg.mutationRate)}. Resultado — ${muts}.`);
    await wait(600, t);
    for (const c of pair.children) {
      const row = document.getElementById(`row-${c.child}`);
      for (const i of c.flipped) {
        const g = row.querySelector(`.gene[data-i="${i}"]`);
        g.classList.add('mut');
        g.classList.toggle('on', c.mutated[i] === 1);
        g.classList.toggle('off', c.mutated[i] === 0);
        g.querySelector('b').textContent = c.mutated[i];
        await wait(500, t);
      }
      const ev = GA.evaluate(c.mutated, projects, budget);
      row.querySelector('.stage-info').innerHTML = costInfo(ev.cost, ev.benefit, budget);
    }
    await wait(pair.children.some(c => c.flipped.length) ? 1300 : 900, t);

    // ---------- Reparação ----------
    for (const c of pair.children) {
      const row = document.getElementById(`row-${c.child}`);
      const steps = c.repair.steps;
      if (!steps.length) {
        caption(`${P} · Reparação`, `Filho ${c.child + 1} (<code>${Fmt.chrom(c.mutated)}</code>) custa ${Fmt.money(c.repair.initialCost)} ≤ ${Fmt.money(budget)}: já é viável, não precisa de reparação.`);
        await wait(1000, t);
        continue;
      }
      let prevCost = c.repair.initialCost;
      for (const s of steps) {
        const p = projects[s.removed];
        caption(`${P} · Reparação do filho ${c.child + 1}`,
          `Custo ${Fmt.money(prevCost)} &gt; orçamento ${Fmt.money(budget)}. Remove <b>${GA.geneLabel(s.removed)}</b> (${Fmt.esc(p.name)}), o selecionado com menor razão benefício/custo (${Fmt.ratio(p)}) → <code>${Fmt.chrom(s.genes)}</code>.`);
        const g = row.querySelector(`.gene[data-i="${s.removed}"]`);
        g.classList.add('removing');
        await wait(1100, t);
        g.classList.remove('removing', 'on', 'mut');
        g.classList.add('removed', 'off');
        g.querySelector('b').textContent = '0';
        row.querySelector('.stage-info').innerHTML = costInfo(s.cost, s.benefit, budget);
        prevCost = s.cost;
        await wait(900, t);
      }
    }

    // ---------- Avaliação e inserção ----------
    const placed = pair.children.map(c => `filho ${c.child + 1} = <code>${Fmt.chrom(c.genes)}</code> (custo ${Fmt.money(c.cost)}; aptidão <b>${Fmt.points(c.fitness)}</b>) → vaga #${c.to}`).join('; ');
    caption(`${P} · Avaliação`, `Aptidão = benefício da solução reparada. ${placed}.`);
    for (const c of pair.children) {
      const row = document.getElementById(`row-${c.child}`);
      row.querySelector('.stage-info').innerHTML = `custo <b class="okc">${Fmt.money(c.cost)}</b> · aptidão <b>${Fmt.points(c.fitness)}</b> → vaga #${c.to}`;
      fillDest(c.to, run.populations[log.generation][c.to], '');
      await wait(450, t);
    }
    await wait(1500, t);
  }

  /**
   * Anima a transição (gen − 1) → gen. Se `onlyPair` for um número, anima só
   * aquele par (com a nova geração pré-preenchida até ele).
   */
  async function play(run, gen, onlyPair) {
    cancel();
    const t = ++token;
    const log = run.logs[gen];
    if (gen < 1 || !log || log.trimmed || !run.populations[gen - 1]) {
      showStatic(run, gen);
      return false;
    }
    playing = true;
    listeners.change();
    el.title.textContent = `Geração ${gen - 1} → ${gen}`;
    try {
      renderSource(run.populations[gen - 1], gen - 1);
      if (typeof onlyPair === 'number') {
        renderDest(log, run.populations[gen], onlyPair, true);
        currentPair = onlyPair;
        await animatePair(run, log, log.pairs[onlyPair], t);
      } else {
        renderDest(log, run.populations[gen], 0, false);
        await animateElites(run, log, t);
        for (const pair of log.pairs) {
          currentPair = pair.number;
          await animatePair(run, log, pair, t);
        }
        caption(`Geração ${gen}`, `Concluída: ${log.elites.length} elite(s) + ${log.pairs.reduce((s, p) => s + p.keep, 0)} filho(s) = ${run.populations[gen].length} indivíduos.`);
      }
      return true;
    } catch (err) {
      if (err !== CANCELLED) throw err;
      return false;
    } finally {
      if (t === token) {
        playing = false;
        listeners.change();
      }
    }
  }

  let currentPair = -1;

  function getCurrentPair() {
    return currentPair;
  }

  function resetPair() {
    currentPair = -1;
  }

  global.Anim = { init, setSpeed, cancel, play, showStatic, isPlaying, getCurrentPair, resetPair };
})(globalThis);
