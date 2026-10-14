/*
 * Gerador de números pseudoaleatórios com semente.
 *
 * Algoritmo mulberry32 (domínio público), implementado aqui para não depender
 * de bibliotecas externas. Recebe um inteiro de 32 bits e devolve uma função
 * que, a cada chamada, retorna um número em [0, 1). A mesma semente sempre
 * produz a mesma sequência, o que permite reproduzir uma execução.
 */
(function (global) {
  'use strict';

  function createRng(seed) {
    let state = seed >>> 0;
    return function next() {
      state = (state + 0x6D2B79F5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  global.createRng = createRng;
})(globalThis);
