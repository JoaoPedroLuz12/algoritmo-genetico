/*
 * Funções de formatação compartilhadas (interface, logs, animação e testes).
 * Lembrete: custos em centavos e benefícios/aptidões em centésimos de ponto.
 */
(function (global) {
  'use strict';

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const Fmt = {
    money(cents) {
      return BRL.format(cents / 100);
    },
    points(hundredths) {
      return (hundredths / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    },
    avg(hundredths) {
      return (hundredths / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    prob(x) {
      return x.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    },
    pct(rate) {
      return (rate * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 }) + '%';
    },
    /** Razão benefício/custo em pontos por R$ 1.000 (mais legível que pontos por real). */
    ratio(project) {
      const perThousand = (project.benefit / 100) / (project.cost / 100) * 1000;
      return perThousand.toLocaleString('pt-BR', { maximumSignificantDigits: 4 }) + ' pts/R$ mil';
    },
    chrom(genes) {
      return genes.join('');
    },
    letters(indices) {
      if (!indices.length) return 'nenhum';
      const names = indices.map(i => String.fromCharCode(65 + i));
      if (names.length === 1) return names[0];
      return names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
    },
    ordinal(n) {
      return n + 'º';
    },
    esc(text) {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  };

  global.Fmt = Fmt;
})(globalThis);
