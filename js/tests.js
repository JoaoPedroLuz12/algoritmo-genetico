/*
 * Testes de validação da seção 6 do enunciado.
 * Rodam no próprio navegador (aba "Testes de validação") usando as mesmas
 * funções do núcleo em js/ga.js.
 */
(function (global) {
  'use strict';

  const { money, points } = Fmt;

  // Seção 6.1 — custos em centavos, benefícios em centésimos de ponto.
  const PROJECTS = [
    { name: 'Melhoria da iluminação', cost: 400000, benefit: 700 },
    { name: 'Instalação de bicicletários', cost: 300000, benefit: 500 },
    { name: 'Aquisição de bancos', cost: 200000, benefit: 300 },
    { name: 'Reforma de espaço de convivência', cost: 500000, benefit: 800 }
  ];
  const BUDGET = 700000;

  // Seção 6.5
  const FULL_RUN = {
    projects: PROJECTS,
    budget: BUDGET,
    populationSize: 20,
    generations: 50,
    crossoverRate: 0.8,
    mutationRate: 0.05,
    tournamentSize: 2,
    eliteCount: 1,
    seed: 42
  };

  const G = s => GA.stringToGenes(s);
  const S = g => GA.genesToString(g);

  /* ---------------- infraestrutura mínima de asserções ---------------- */

  function context() {
    const lines = [];
    let ok = true;
    const show = v => (typeof v === 'string' ? v : JSON.stringify(v));
    return {
      lines,
      get ok() { return ok; },
      eq(label, got, expected) {
        const pass = JSON.stringify(got) === JSON.stringify(expected);
        if (!pass) ok = false;
        lines.push({ pass, text: pass ? `${label}: ${show(got)}` : `${label}: obtido ${show(got)}, esperado ${show(expected)}` });
      },
      truth(label, cond) {
        if (!cond) ok = false;
        lines.push({ pass: !!cond, text: label });
      },
      info(text) {
        lines.push({ info: true, text });
      }
    };
  }

  function runFull(overrides) {
    const run = GA.createRun(Object.assign({}, FULL_RUN, overrides));
    while (!GA.isDone(run)) GA.step(run);
    return run;
  }

  function popOf(strings) {
    return strings.map(s => GA.makeIndividual(G(s), PROJECTS, BUDGET, {}));
  }

  function describeSolution(genes, budget) {
    const ev = GA.evaluate(genes, PROJECTS, budget);
    return `${S(genes)} — projetos ${Fmt.letters(ev.selected)}; custo ${money(ev.cost)}; ` +
      `benefício ${points(ev.benefit)}; saldo ${money(ev.balance)}`;
  }

  /* ------------------------------ testes ------------------------------ */

  const TESTS = [
    {
      section: '6.2',
      title: 'Avaliação do cromossomo 1100 (orçamento R$ 7.000)',
      run(t) {
        const ev = GA.evaluate(G('1100'), PROJECTS, BUDGET);
        const rep = GA.repair(G('1100'), PROJECTS, BUDGET);
        t.eq('Projetos', Fmt.letters(ev.selected), 'A e B');
        t.eq('Custo total', money(ev.cost), money(700000));
        t.eq('Benefício total', points(ev.benefit), '12');
        t.eq('Saldo', money(ev.balance), money(0));
        t.eq('Viável', ev.feasible, true);
        t.eq('Passos de reparação', rep.steps.length, 0);
        t.eq('Aptidão', points(rep.benefit), '12');
      }
    },
    {
      section: '6.2',
      title: 'Relação das soluções viáveis da instância',
      run(t) {
        const expected = new Map([
          ['0000', [0, 0]], ['1000', [400000, 700]], ['0100', [300000, 500]], ['0010', [200000, 300]],
          ['0001', [500000, 800]], ['1100', [700000, 1200]], ['1010', [600000, 1000]],
          ['0110', [500000, 800]], ['0011', [700000, 1100]]
        ]);
        const found = {};
        for (let m = 0; m < 16; m++) {
          const s = m.toString(2).padStart(4, '0');
          const ev = GA.evaluate(G(s), PROJECTS, BUDGET);
          if (ev.feasible) found[s] = [ev.cost, ev.benefit];
        }
        t.eq('Quantidade de soluções viáveis', Object.keys(found).length, 9);
        for (const [s, exp] of expected) {
          const got = found[s];
          t.eq(`${s}`, got ? `custo ${money(got[0])}; benefício ${points(got[1])}` : 'inviável',
            `custo ${money(exp[0])}; benefício ${points(exp[1])}`);
        }
        const best = Object.keys(found).reduce((a, b) => (found[b][1] > found[a][1] ? b : a));
        t.eq('Ótimo global', best, '1100');
      }
    },
    {
      section: '6.3',
      title: 'Reparação do cromossomo 1111',
      run(t) {
        const rep = GA.repair(G('1111'), PROJECTS, BUDGET);
        t.eq('1111', `custo ${money(rep.initialCost)}; benefício ${points(rep.initialBenefit)}`,
          `custo ${money(1400000)}; benefício 23`);
        t.eq('Passos', rep.steps.length, 2);
        t.eq('1º passo remove', GA.geneLabel(rep.steps[0].removed), 'C');
        t.eq('Após 1º passo', `${S(rep.steps[0].genes)}; custo ${money(rep.steps[0].cost)}; benefício ${points(rep.steps[0].benefit)}`,
          `1101; custo ${money(1200000)}; benefício 20`);
        t.eq('2º passo remove', GA.geneLabel(rep.steps[1].removed), 'D');
        t.eq('Após 2º passo', `${S(rep.steps[1].genes)}; custo ${money(rep.steps[1].cost)}; benefício ${points(rep.steps[1].benefit)}`,
          `1100; custo ${money(700000)}; benefício 12`);
        t.eq('Viável', rep.cost <= BUDGET, true);
      }
    },
    {
      section: '6.4',
      title: 'Cruzamento controlado: 11|00 + 00|11',
      run(t) {
        const [c1, c2] = GA.onePointCrossover(G('1100'), G('0011'), 2);
        t.eq('Filho 1', S(c1), '1111');
        t.eq('Filho 2', S(c2), '0000');
      }
    },
    {
      section: '6.4',
      title: 'Mutação controlada: apenas o 1º gene do filho 1',
      run(t) {
        t.eq('Filho 1', S(GA.flipGenes(G('1111'), [0])), '0111');
        t.eq('Filho 2', S(GA.flipGenes(G('0000'), [])), '0000');
      }
    },
    {
      section: '6.4',
      title: 'Reparação e avaliação dos filhos',
      run(t) {
        const r1 = GA.repair(G('0111'), PROJECTS, BUDGET);
        const r2 = GA.repair(G('0000'), PROJECTS, BUDGET);
        t.eq('Reparação do filho 1', ['0111', ...r1.steps.map(s => S(s.genes))].join(' → '), '0111 → 0101 → 0100');
        t.eq('Projetos removidos', r1.steps.map(s => GA.geneLabel(s.removed)).join(' e '), 'C e D');
        t.eq('Reparação do filho 2', r2.steps.length === 0 ? 'permanece 0000' : 'alterado', 'permanece 0000');
        t.eq('Filho 1', `${S(r1.genes)}; custo ${money(r1.cost)}; aptidão ${points(r1.benefit)}`, `0100; custo ${money(300000)}; aptidão 5`);
        t.eq('Filho 2', `${S(r2.genes)}; custo ${money(r2.cost)}; aptidão ${points(r2.benefit)}`, `0000; custo ${money(0)}; aptidão 0`);
      }
    },
    {
      section: '6.4',
      title: 'Limites da taxa de mutação (0% e 100%)',
      run(t) {
        const rng = createRng(2026);
        let zeroOk = true;
        let fullOk = true;
        for (let trial = 0; trial < 2000; trial++) {
          const n = 4 + (trial % 12);
          const genes = Array.from({ length: n }, () => (rng() < 0.5 ? 1 : 0));
          const m0 = GA.mutate(genes, 0, rng);
          if (m0.flipped.length !== 0 || S(m0.genes) !== S(genes)) zeroOk = false;
          const m1 = GA.mutate(genes, 1, rng);
          if (m1.flipped.length !== n || S(m1.genes) !== S(genes.map(b => 1 - b))) fullOk = false;
        }
        t.truth('Mutação 0%: nenhum gene invertido em 2.000 cromossomos', zeroOk);
        t.truth('Mutação 100%: todos os genes invertidos em 2.000 cromossomos', fullOk);
        const run = GA.createRun(Object.assign({}, FULL_RUN, { mutationRate: 1, generations: 3 }));
        while (!GA.isDone(run)) GA.step(run);
        let inRun = true;
        for (let g = 1; g <= 3; g++) {
          for (const p of run.logs[g].pairs) {
            for (const c of p.children) {
              if (S(c.mutated) !== S(c.afterCrossover.map(b => 1 - b))) inRun = false;
            }
          }
        }
        t.truth('Na execução com 100%, cada filho é o complemento do resultado do cruzamento (antes da reparação)', inRun);
      }
    },
    {
      section: '6.4',
      title: 'Limites da taxa de cruzamento (0% e 100%)',
      run(t) {
        const rng = createRng(7);
        let zeroOk = true;
        let fullOk = true;
        const cuts = new Set();
        for (let trial = 0; trial < 2000; trial++) {
          const p1 = Array.from({ length: 4 }, () => (rng() < 0.5 ? 1 : 0));
          const p2 = Array.from({ length: 4 }, () => (rng() < 0.5 ? 1 : 0));
          const c0 = GA.applyCrossover(p1, p2, 0, rng);
          if (c0.happened || S(c0.children[0]) !== S(p1) || S(c0.children[1]) !== S(p2)) zeroOk = false;
          const c1 = GA.applyCrossover(p1, p2, 1, rng);
          const exp = GA.onePointCrossover(p1, p2, c1.cut);
          if (!c1.happened || c1.cut < 1 || c1.cut > 3 || S(c1.children[0]) !== S(exp[0]) || S(c1.children[1]) !== S(exp[1])) fullOk = false;
          cuts.add(c1.cut);
        }
        t.truth('Cruzamento 0%: filhos copiam os pais em 2.000 pares', zeroOk);
        t.truth('Cruzamento 100%: sempre ocorre, com corte entre o 1º e o penúltimo gene', fullOk);
        t.eq('Cortes observados (n = 4)', [...cuts].sort().join(', '), '1, 2, 3');
      }
    },
    {
      section: '6.4',
      title: 'Seleção por torneio: 1000 (7), 0011 (11) e 1100 (12)',
      run(t) {
        const pop = popOf(['1000', '0011', '1100']);
        t.eq('Aptidões', pop.map(p => points(p.fitness)).join(', '), '7, 11, 12');
        const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
        const winners = orders.map(o => S(pop[GA.pickWinner(pop, o)].genes));
        t.eq('Vencedor (todas as ordens de sorteio)', [...new Set(winners)].join(', '), '1100');
        const sampled = GA.tournament(pop, 3, createRng(1));
        t.eq('Vencedor com sorteio de 3 candidatos distintos', S(pop[sampled.winner].genes), '1100');
      }
    },
    {
      section: '6.4',
      title: 'Seleção por torneio: empate escolhe o menor índice',
      run(t) {
        const pop = popOf(['1000', '0001', '1100', '0110', '1100']);
        t.info('População: #0 1000 (7), #1 0001 (8), #2 1100 (12), #3 0110 (8), #4 1100 (12)');
        t.eq('Candidatos #4 e #2 (ambos 12)', GA.pickWinner(pop, [4, 2]), 2);
        t.eq('Candidatos #2 e #4 (ambos 12)', GA.pickWinner(pop, [2, 4]), 2);
        t.eq('Candidatos #3 e #1 (ambos 8)', GA.pickWinner(pop, [3, 1]), 1);
        t.eq('Candidatos #3, #0 e #1', GA.pickWinner(pop, [3, 0, 1]), 1);
        t.eq('Torneio com toda a população', GA.tournament(pop, 5, createRng(3)).winner, 2);
      }
    },
    {
      section: '6.4',
      title: 'Seleção por torneio: candidatos distintos',
      run(t) {
        const rng = createRng(11);
        let distinct = true;
        let permutation = true;
        for (let trial = 0; trial < 1000; trial++) {
          const s = GA.sampleDistinct(20, 2 + (trial % 19), rng);
          if (new Set(s).size !== s.length || s.some(i => i < 0 || i >= 20)) distinct = false;
          const all = GA.sampleDistinct(20, 20, rng);
          if (new Set(all).size !== 20) permutation = false;
        }
        t.truth('Nenhum candidato repetido em 1.000 torneios (k de 2 a 20, população 20)', distinct);
        t.truth('Com k igual ao tamanho da população, todos participam', permutation);
      }
    },
    {
      section: '6.5',
      title: 'Execução completa: população 20, 50 gerações, 80%, 5%, torneio 2, elite 1, semente 42',
      run(t) {
        const run = runFull();
        const best = run.bestSoFar;
        const ev = GA.evaluate(best.genes, PROJECTS, BUDGET);
        t.eq('Registros no histórico', run.history.length, 51);
        t.info(`Melhor solução: ${describeSolution(best.genes, BUDGET)} (encontrada na geração ${best.generation})`);
        t.truth('Custo não ultrapassa R$ 7.000', ev.cost <= BUDGET);
        t.truth('Benefício não ultrapassa 12', ev.benefit <= 1200);
        t.truth('Totais compatíveis com o cromossomo', ev.cost === best.cost && ev.benefit === best.fitness);
        t.info(best.fitness === 1200 ? 'Atingiu o ótimo de referência (1100, benefício 12).'
          : 'Não atingiu o ótimo nesta execução (permitido pelo enunciado).');
      }
    },
    {
      section: '6.5',
      title: 'Monotonicidade do melhor acumulado e da melhor aptidão (com elite)',
      run(t) {
        const run = runFull();
        let acc = true;
        let pop = true;
        for (let g = 1; g < run.history.length; g++) {
          if (run.history[g].bestSoFarFitness < run.history[g - 1].bestSoFarFitness) acc = false;
          if (run.history[g].bestFitness < run.history[g - 1].bestFitness) pop = false;
        }
        t.truth('Melhor benefício acumulado nunca diminui (gerações 0 a 50)', acc);
        t.truth('Com 1 indivíduo de elite, a melhor aptidão da população nunca diminui', pop);
        t.info('Evolução da melhor aptidão: ' + run.history.map(h => points(h.bestFitness)).join(' '));
        t.info('Evolução da aptidão média: ' + run.history.map(h => Fmt.avg(h.avgFitness)).join(' '));
      }
    },
    {
      section: '6.5',
      title: 'Reprodutibilidade com a mesma semente',
      run(t) {
        const a = runFull();
        const b = runFull();
        const sig = r => r.history.map(h => `${S(h.bestGenes)}:${h.avgFitness}`).join('|') + '#' + r.population.map(i => S(i.genes)).join(',');
        t.truth('Duas execuções com semente 42 produzem histórico e população final idênticos', sig(a) === sig(b));
      }
    },
    {
      section: '2',
      title: 'Consistência dos registros (logs) em toda a execução 6.5',
      run(t) {
        const run = runFull();
        const cfg = run.config;
        let elites = true, sel = true, cross = true, mut = true, rep = true, dest = true, size = true;
        for (let g = 1; g <= cfg.generations; g++) {
          const prev = run.populations[g - 1];
          const cur = run.populations[g];
          const log = run.logs[g];
          if (cur.length !== cfg.populationSize) size = false;
          const ranking = GA.rankIndices(prev);
          log.elites.forEach((e, i) => {
            if (e.from !== ranking[i] || S(cur[e.to].genes) !== S(prev[e.from].genes)) elites = false;
          });
          for (const p of log.pairs) {
            p.tournaments.forEach((tt, k) => {
              const idx = tt.candidates.map(c => c.index);
              if (idx.length !== cfg.tournamentSize || new Set(idx).size !== idx.length) sel = false;
              if (GA.pickWinner(prev, idx) !== tt.winner || p.parents[k].index !== tt.winner) sel = false;
            });
            const p1 = prev[p.parents[0].index].genes;
            const p2 = prev[p.parents[1].index].genes;
            const expected = p.crossover.happened ? GA.onePointCrossover(p1, p2, p.crossover.cut) : [p1, p2];
            if (p.crossover.happened !== (p.crossover.roll < cfg.crossoverRate)) cross = false;
            for (const c of p.children) {
              if (S(c.afterCrossover) !== S(expected[c.child])) cross = false;
              if (S(GA.flipGenes(c.afterCrossover, c.flipped)) !== S(c.mutated)) mut = false;
              const r = GA.repair(c.mutated, cfg.projects, cfg.budget);
              if (S(r.genes) !== S(c.genes) || r.steps.length !== c.repair.steps.length) rep = false;
              if (S(cur[c.to].genes) !== S(c.genes) || cur[c.to].fitness !== c.fitness) dest = false;
            }
          }
        }
        t.truth('Elitismo copia os melhores da geração anterior sem modificação', elites);
        t.truth('Cada torneio tem k candidatos distintos e o vencedor correto', sel);
        t.truth('Filhos registrados conferem com o corte (ou são cópias sem cruzamento)', cross);
        t.truth('Mutação registrada = bits invertidos sobre o resultado do cruzamento', mut);
        t.truth('Reparação registrada é reproduzível a partir do filho mutado', rep);
        t.truth('Cada filho ocupa a vaga indicada no log', dest);
        t.truth('Tamanho da população constante em todas as gerações', size);
      }
    },
    {
      section: '2',
      title: 'Todas as soluções da execução são viáveis e têm aptidão correta',
      run(t) {
        const run = runFull();
        let ok = true;
        let count = 0;
        for (const pop of run.populations) {
          for (const ind of pop) {
            const ev = GA.evaluate(ind.genes, PROJECTS, BUDGET);
            count++;
            if (!ev.feasible || ev.benefit !== ind.fitness || ev.cost !== ind.cost) ok = false;
          }
        }
        t.truth(`${count} indivíduos verificados (51 gerações × 20): custo ≤ orçamento e aptidão = benefício`, ok);
      }
    },
    {
      section: '2',
      title: 'Vaga ímpar: apenas o primeiro filho do último par é mantido',
      run(t) {
        const cases = [
          { populationSize: 20, eliteCount: 1, pairs: 10, lastKeep: 1 },
          { populationSize: 6, eliteCount: 0, pairs: 3, lastKeep: 2 },
          { populationSize: 5, eliteCount: 0, pairs: 3, lastKeep: 1 },
          { populationSize: 5, eliteCount: 4, pairs: 1, lastKeep: 1 }
        ];
        for (const c of cases) {
          const run = GA.createRun(Object.assign({}, FULL_RUN, { populationSize: c.populationSize, eliteCount: c.eliteCount, tournamentSize: 2, generations: 2 }));
          GA.step(run);
          const log = run.logs[1];
          const last = log.pairs[log.pairs.length - 1];
          t.eq(`População ${c.populationSize}, elite ${c.eliteCount}`,
            `${log.pairs.length} pares; último mantém ${last.keep}; tamanho ${run.population.length}`,
            `${c.pairs} pares; último mantém ${c.lastKeep}; tamanho ${c.populationSize}`);
        }
      }
    },
    {
      section: '2',
      title: 'Sem elitismo (elite = 0)',
      run(t) {
        const run = runFull({ eliteCount: 0 });
        t.eq('Registros no histórico', run.history.length, 51);
        t.truth('Nenhum indivíduo copiado por elitismo', run.logs.slice(1).every(l => l.elites.length === 0));
        t.truth('Tamanho da população constante', run.populations.every(p => p.length === 20));
        let acc = true;
        for (let g = 1; g < run.history.length; g++) {
          if (run.history[g].bestSoFarFitness < run.history[g - 1].bestSoFarFitness) acc = false;
        }
        t.truth('Melhor acumulado continua sem diminuir', acc);
      }
    },
    {
      section: '6.6',
      title: 'Orçamento R$ 0',
      run(t) {
        const run = runFull({ budget: 0 });
        const allZero = pop => pop.every(i => S(i.genes) === '0000' && i.fitness === 0 && i.cost === 0);
        t.truth('Geração 0 (após a reparação): toda a população é 0000', allZero(run.populations[0]));
        t.truth('Todas as 50 gerações seguintes: toda a população é 0000', run.populations.every(allZero));
        t.eq('Melhor solução', `${S(run.bestSoFar.genes)}; custo ${money(run.bestSoFar.cost)}; aptidão ${points(run.bestSoFar.fitness)}`,
          `0000; custo ${money(0)}; aptidão 0`);
      }
    },
    {
      section: '6.6',
      title: 'Orçamento R$ 14.000: 1111 é viável',
      run(t) {
        const ev = GA.evaluate(G('1111'), PROJECTS, 1400000);
        const rep = GA.repair(G('1111'), PROJECTS, 1400000);
        t.eq('Custo', money(ev.cost), money(1400000));
        t.eq('Benefício', points(ev.benefit), '23');
        t.eq('Saldo', money(ev.balance), money(0));
        t.eq('Viável', ev.feasible, true);
        t.eq('Reparação', rep.steps.length === 0 ? 'nenhuma' : 'alterou', 'nenhuma');
        const run = runFull({ budget: 1400000 });
        t.info(`Execução completa com R$ 14.000 (semente 42): melhor ${describeSolution(run.bestSoFar.genes, 1400000)}`);
      }
    }
  ];

  function runAll() {
    return TESTS.map((test, i) => {
      const t = context();
      try {
        test.run(t);
      } catch (err) {
        t.truth('Erro inesperado: ' + err.message, false);
      }
      return { id: i + 1, section: test.section, title: test.title, pass: t.ok, lines: t.lines };
    });
  }

  /** Seção 6.5: mutação 1% vs 20%, sementes 1 a 5, demais parâmetros iguais. */
  function mutationExperiment() {
    const rates = [0.01, 0.20];
    return rates.map(rate => {
      const runs = [1, 2, 3, 4, 5].map(seed => {
        const run = runFull({ mutationRate: rate, seed });
        const last = run.history[run.history.length - 1];
        return {
          seed,
          genes: S(run.bestSoFar.genes),
          fitness: run.bestSoFar.fitness,
          cost: run.bestSoFar.cost,
          generationFound: run.bestSoFar.generation,
          finalAvg: last.avgFitness
        };
      });
      const mean = runs.reduce((s, r) => s + r.fitness, 0) / runs.length;
      return { rate, runs, mean, hits: runs.filter(r => r.fitness === 1200).length };
    });
  }

  global.GATests = { runAll, mutationExperiment, PROJECTS, BUDGET, FULL_RUN };
})(globalThis);
