/*
 * Núcleo do algoritmo genético (sem dependência da interface).
 *
 * Convenções internas (para evitar erros de arredondamento com casas decimais):
 *   - custos e orçamento são inteiros em CENTAVOS  (R$ 4.000,00 -> 400000);
 *   - benefícios e aptidões são inteiros em CENTÉSIMOS de ponto (7 -> 700).
 * A interface converte esses valores apenas para exibição.
 *
 * Um cromossomo é um array de 0/1; a posição i corresponde ao projeto i.
 */
(function (global) {
  'use strict';

  // Limite de eventos detalhados guardados na memória (logs + populações).
  // As estatísticas por geração (histórico) são sempre mantidas por completo.
  const MAX_DETAIL_EVENTS = 200000;

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */

  function geneLabel(i) {
    return String.fromCharCode(65 + i); // A, B, C, ...
  }

  function genesToString(genes) {
    return genes.join('');
  }

  function stringToGenes(text) {
    return text.split('').map(Number);
  }

  /* ------------------------------------------------------------------ */
  /* Avaliação                                                           */
  /* ------------------------------------------------------------------ */

  /** Soma custo e benefício dos projetos selecionados no cromossomo. */
  function evaluate(genes, projects, budget) {
    let cost = 0;
    let benefit = 0;
    const selected = [];
    for (let i = 0; i < genes.length; i++) {
      if (genes[i] === 1) {
        cost += projects[i].cost;
        benefit += projects[i].benefit;
        selected.push(i);
      }
    }
    return { cost, benefit, balance: budget - cost, feasible: cost <= budget, selected };
  }

  /* ------------------------------------------------------------------ */
  /* Reparação                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * O projeto a tem razão benefício/custo menor que a do projeto b?
   * Compara b_a / c_a < b_b / c_b por multiplicação cruzada (custos > 0),
   * sem divisões, para que empates sejam detectados com exatidão.
   */
  function hasLowerRatio(pa, pb) {
    const left = pa.benefit * pb.cost;
    const right = pb.benefit * pa.cost;
    if (Number.isSafeInteger(left) && Number.isSafeInteger(right)) return left < right;
    return BigInt(pa.benefit) * BigInt(pb.cost) < BigInt(pb.benefit) * BigInt(pa.cost);
  }

  /**
   * Enquanto o custo ultrapassar o orçamento, remove o projeto selecionado com
   * a menor razão benefício/custo; em empate, o de menor índice (a varredura é
   * crescente e só troca o candidato quando a razão é estritamente menor).
   * Retorna o cromossomo reparado e cada passo realizado.
   */
  function repair(genes, projects, budget) {
    const g = genes.slice();
    const start = evaluate(g, projects, budget);
    let cost = start.cost;
    let benefit = start.benefit;
    const steps = [];
    while (cost > budget) {
      let worst = -1;
      for (let i = 0; i < g.length; i++) {
        if (g[i] !== 1) continue;
        if (worst === -1 || hasLowerRatio(projects[i], projects[worst])) worst = i;
      }
      g[worst] = 0;
      cost -= projects[worst].cost;
      benefit -= projects[worst].benefit;
      steps.push({ removed: worst, genes: g.slice(), cost, benefit });
    }
    return {
      genes: g,
      steps,
      initialCost: start.cost,
      initialBenefit: start.benefit,
      cost,
      benefit
    };
  }

  /* ------------------------------------------------------------------ */
  /* Seleção por torneio                                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Sorteia k índices DISTINTOS em [0, n) (Fisher–Yates parcial, O(k)).
   * Consome exatamente k números do gerador.
   */
  function sampleDistinct(n, k, rng) {
    const swapped = new Map();
    const out = [];
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rng() * (n - i));
      const valueJ = swapped.has(j) ? swapped.get(j) : j;
      const valueI = swapped.has(i) ? swapped.get(i) : i;
      swapped.set(j, valueI);
      out.push(valueJ);
    }
    return out;
  }

  /** Vencedor do torneio: maior aptidão; em empate, menor índice na população. */
  function pickWinner(population, candidates) {
    let best = candidates[0];
    for (const c of candidates) {
      const fc = population[c].fitness;
      const fb = population[best].fitness;
      if (fc > fb || (fc === fb && c < best)) best = c;
    }
    return best;
  }

  function tournament(population, size, rng) {
    const candidates = sampleDistinct(population.length, size, rng);
    return { candidates, winner: pickWinner(population, candidates) };
  }

  /* ------------------------------------------------------------------ */
  /* Cruzamento de um ponto                                              */
  /* ------------------------------------------------------------------ */

  /** Troca os segmentos após o gene `cut` (cut = 2 -> 11|00 + 00|11). */
  function onePointCrossover(p1, p2, cut) {
    return [
      p1.slice(0, cut).concat(p2.slice(cut)),
      p2.slice(0, cut).concat(p1.slice(cut))
    ];
  }

  /** Corte sorteado entre o primeiro e o penúltimo gene: cut ∈ [1, n−1]. */
  function drawCut(n, rng) {
    return 1 + Math.floor(rng() * (n - 1));
  }

  /**
   * Aplica a taxa de cruzamento ao par de pais. Se não houver cruzamento,
   * os filhos são cópias dos pais.
   */
  function applyCrossover(p1, p2, rate, rng) {
    const roll = rng();
    if (roll < rate) {
      const cut = drawCut(p1.length, rng);
      return { roll, happened: true, cut, children: onePointCrossover(p1, p2, cut) };
    }
    return { roll, happened: false, cut: null, children: [p1.slice(), p2.slice()] };
  }

  /* ------------------------------------------------------------------ */
  /* Mutação por inversão de bits                                        */
  /* ------------------------------------------------------------------ */

  /** Cada gene é invertido independentemente com probabilidade `rate`. */
  function mutate(genes, rate, rng) {
    const g = genes.slice();
    const flipped = [];
    for (let i = 0; i < g.length; i++) {
      if (rng() < rate) {
        g[i] ^= 1;
        flipped.push(i);
      }
    }
    return { genes: g, flipped };
  }

  /** Inverte genes específicos (usado nos testes com escolhas controladas). */
  function flipGenes(genes, indices) {
    const g = genes.slice();
    for (const i of indices) g[i] ^= 1;
    return g;
  }

  /* ------------------------------------------------------------------ */
  /* Indivíduos e estatísticas                                           */
  /* ------------------------------------------------------------------ */

  function makeIndividual(genes, projects, budget, meta) {
    const ev = evaluate(genes, projects, budget);
    return Object.assign({ genes, cost: ev.cost, fitness: ev.benefit }, meta);
  }

  /** Índice do melhor indivíduo (maior aptidão; empate -> menor índice). */
  function bestIndex(population) {
    let b = 0;
    for (let i = 1; i < population.length; i++) {
      if (population[i].fitness > population[b].fitness) b = i;
    }
    return b;
  }

  /** Índices ordenados por aptidão decrescente (empate -> menor índice). */
  function rankIndices(population) {
    return population
      .map((_, i) => i)
      .sort((a, b) => population[b].fitness - population[a].fitness || a - b);
  }

  function recordStats(state) {
    const pop = state.population;
    const bi = bestIndex(pop);
    const best = pop[bi];
    let sum = 0;
    let worst = Infinity;
    for (const ind of pop) {
      sum += ind.fitness;
      if (ind.fitness < worst) worst = ind.fitness;
    }
    // Melhor acumulado: só é substituído por uma aptidão estritamente maior.
    if (!state.bestSoFar || best.fitness > state.bestSoFar.fitness) {
      state.bestSoFar = {
        genes: best.genes.slice(),
        fitness: best.fitness,
        cost: best.cost,
        generation: state.generation,
        index: bi
      };
    }
    state.history.push({
      generation: state.generation,
      bestIndex: bi,
      bestFitness: best.fitness,
      bestGenes: best.genes.slice(),
      bestCost: best.cost,
      avgFitness: sum / pop.length,
      worstFitness: worst,
      bestSoFarFitness: state.bestSoFar.fitness,
      bestSoFarGenes: state.bestSoFar.genes.slice(),
      bestSoFarGeneration: state.bestSoFar.generation
    });
  }

  /** Libera os detalhes das gerações mais antigas se a memória ficar grande. */
  function trimDetails(state) {
    while (state.detailEvents > MAX_DETAIL_EVENTS && state.oldestDetail < state.generation) {
      const g = state.oldestDetail;
      const log = state.logs[g];
      if (log && !log.trimmed) {
        state.detailEvents -= log.eventCount || 0;
        state.logs[g] = { generation: g, trimmed: true };
        state.populations[g] = null;
      }
      state.oldestDetail++;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Execução                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * config = {
   *   projects: [{ name, cost (centavos), benefit (centésimos) }],
   *   budget (centavos), populationSize, generations,
   *   crossoverRate (0..1), mutationRate (0..1),
   *   tournamentSize, eliteCount, seed
   * }
   * Cria a geração 0: cada gene é sorteado com P(1) = P(0) = 0,5; em seguida
   * cada indivíduo é reparado e avaliado.
   */
  function createRun(config) {
    const rng = createRng(config.seed);
    const { projects, budget, populationSize } = config;
    const n = projects.length;
    const population = [];
    const initial = [];
    for (let i = 0; i < populationSize; i++) {
      const raw = [];
      for (let j = 0; j < n; j++) raw.push(rng() < 0.5 ? 1 : 0);
      const rep = repair(raw, projects, budget);
      const ind = makeIndividual(rep.genes, projects, budget, { origin: 'initial' });
      population.push(ind);
      initial.push({
        index: i,
        raw,
        repair: { steps: rep.steps, initialCost: rep.initialCost, initialBenefit: rep.initialBenefit },
        genes: ind.genes,
        cost: ind.cost,
        fitness: ind.fitness
      });
    }
    const state = {
      config,
      rng,
      generation: 0,
      population,
      populations: [population],
      logs: [{ generation: 0, initial, eventCount: populationSize }],
      history: [],
      bestSoFar: null,
      detailEvents: populationSize,
      oldestDetail: 0
    };
    recordStats(state);
    return state;
  }

  function isDone(state) {
    return state.generation >= state.config.generations;
  }

  /**
   * Produz exatamente uma nova geração.
   * Ordem dos sorteios (importa para a reprodutibilidade):
   *   para cada par: torneio 1 (k sorteios), torneio 2 (k sorteios),
   *   sorteio do cruzamento (+ sorteio do corte, se houver cruzamento),
   *   mutação gene a gene do filho 1 e depois do filho 2 (se for mantido).
   */
  function step(state) {
    if (isDone(state)) return null;
    const cfg = state.config;
    const { projects, budget, populationSize: N } = cfg;
    const rng = state.rng;
    const prev = state.population;
    const next = [];
    const log = { generation: state.generation + 1, elites: [], pairs: [] };

    // 1) Elitismo: copia os melhores, sem modificação.
    const ranking = rankIndices(prev);
    for (let e = 0; e < cfg.eliteCount; e++) {
      const src = prev[ranking[e]];
      next.push({ genes: src.genes.slice(), cost: src.cost, fitness: src.fitness, origin: 'elite', from: ranking[e] });
      log.elites.push({ from: ranking[e], to: e, genes: src.genes.slice(), fitness: src.fitness, cost: src.cost });
    }

    // 2) Descendentes: pais sempre selecionados na população anterior.
    while (next.length < N) {
      const pairNumber = log.pairs.length;
      const tournaments = [tournament(prev, cfg.tournamentSize, rng), tournament(prev, cfg.tournamentSize, rng)];
      const parents = tournaments.map(t => prev[t.winner]);
      const cross = applyCrossover(parents[0].genes, parents[1].genes, cfg.crossoverRate, rng);
      const keep = Math.min(2, N - next.length); // se restar uma vaga, fica só o filho 1

      const children = [];
      for (let c = 0; c < keep; c++) {
        const afterCrossover = cross.children[c];
        const mut = mutate(afterCrossover, cfg.mutationRate, rng);
        const rep = repair(mut.genes, projects, budget);
        const ind = makeIndividual(rep.genes, projects, budget, { origin: 'child', pair: pairNumber, child: c });
        children.push({
          child: c,
          afterCrossover,
          flipped: mut.flipped,
          mutated: mut.genes,
          repair: { steps: rep.steps, initialCost: rep.initialCost, initialBenefit: rep.initialBenefit },
          genes: ind.genes,
          cost: ind.cost,
          fitness: ind.fitness,
          to: next.length
        });
        next.push(ind);
      }

      log.pairs.push({
        number: pairNumber,
        tournaments: tournaments.map(t => ({
          candidates: t.candidates.map(i => ({ index: i, fitness: prev[i].fitness, genes: prev[i].genes })),
          winner: t.winner
        })),
        parents: tournaments.map(t => ({ index: t.winner, genes: prev[t.winner].genes, fitness: prev[t.winner].fitness })),
        crossover: { roll: cross.roll, happened: cross.happened, cut: cross.cut, children: cross.children },
        keep,
        children,
        discarded: keep < 2 ? cross.children[1] : null
      });
    }

    state.generation++;
    state.population = next;
    state.populations[state.generation] = next;
    log.eventCount = log.pairs.length + log.elites.length + N;
    state.logs[state.generation] = log;
    state.detailEvents += log.eventCount;
    recordStats(state);
    trimDetails(state);
    return log;
  }

  global.GA = {
    geneLabel,
    genesToString,
    stringToGenes,
    evaluate,
    hasLowerRatio,
    repair,
    sampleDistinct,
    pickWinner,
    tournament,
    onePointCrossover,
    drawCut,
    applyCrossover,
    mutate,
    flipGenes,
    makeIndividual,
    bestIndex,
    rankIndices,
    createRun,
    step,
    isDone
  };
})(globalThis);
