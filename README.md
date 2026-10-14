# Simulador de Algoritmo Genético — Projetos de Melhoria do Campus

Atividade prática de **Inteligência Artificial (UFPI · 2026.2)**: um simulador de algoritmo genético que escolhe projetos de melhoria do campus para **maximizar o benefício total sem ultrapassar o orçamento** (problema da mochila 0/1).

- **Aplicação (GitHub Pages):** https://joaopedroluz12.github.io/algoritmo-genetico/
- **Repositório:** https://github.com/JoaoPedroLuz12/algoritmo-genetico

## Autores

| Nome | Matrícula |
|------|-----------|
| _Nome do(a) integrante 1_ | _matrícula_ |
| _Nome do(a) integrante 2_ | _matrícula_ |
| _Nome do(a) integrante 3_ | _matrícula_ |

---

## Tecnologias e bibliotecas

A aplicação usa só **HTML, CSS e JavaScript puro** e roda inteira no navegador, sem servidor de aplicação, login ou instalação.

**Nenhuma biblioteca externa é usada.** O algoritmo genético, os operadores, o gerador pseudoaleatório com semente (mulberry32), o gráfico (SVG) e as animações (CSS e DOM) foram implementados pelo grupo.

| Arquivo | Conteúdo |
|---------|----------|
| `index.html` | Estrutura da página: simulador, testes de validação e explicação do algoritmo |
| `css/style.css` | Estilos, tema claro/escuro e animações |
| `js/rng.js` | Gerador pseudoaleatório com semente (mulberry32) |
| `js/ga.js` | Núcleo do algoritmo genético, independente da interface: avaliação, reparação, torneio, cruzamento, mutação, elitismo, geração 0 e passo de geração |
| `js/format.js` | Formatação de moeda, pontos e percentuais |
| `js/anim.js` | Animação das operações a partir do log real de cada geração |
| `js/ui.js` | Interface: edição dos projetos, validação, controles, métricas, gráfico, população, log, histórico e avaliação manual |
| `js/tests.js` | Testes de validação da seção 6, executados no próprio navegador |

## Descrição da solução

### Representação
Cada solução é um **cromossomo binário**. O gene *i* vale 1 se o projeto *i* for escolhido e 0 caso contrário; a ordem dos genes é a da tabela (A, B, C, …). Exemplo: `1010` escolhe A e C.

Para evitar erros de arredondamento, os custos são guardados internamente em **centavos** e os benefícios em **centésimos de ponto**, sempre como números inteiros. Assim, somas e comparações são exatas.

### Algoritmo
1. **População inicial (geração 0):** cada gene é sorteado de forma independente, com 50% de chance de ser 0 ou 1. Em seguida, cada indivíduo é reparado e avaliado.
2. **Reparação:** enquanto o custo passar do orçamento, remove-se o projeto selecionado com a **menor razão benefício/custo**; em caso de empate, sai o de **menor índice**. A comparação das razões usa multiplicação cruzada (b₁·c₂ < b₂·c₁), sem divisão, para detectar empates com exatidão. A reparação vale para a população inicial e para todos os filhos, antes da avaliação.
3. **Aptidão:** benefício total da solução reparada. A seleção vazia é válida e tem aptidão 0.
4. **Elitismo:** os *E* melhores da geração anterior (maior aptidão; empate → menor índice) são copiados **sem modificação** para as primeiras vagas. Com *E* = 0 não há preservação.
5. **Seleção por torneio:** cada pai vem de um torneio independente com *k* candidatos **distintos**, sorteados na **população anterior**. Vence a maior aptidão; em empate, o **menor índice na população**.
6. **Cruzamento de um ponto:** a taxa é aplicada **por par**. Se houver cruzamento, o corte é sorteado entre o 1º e o penúltimo gene (corte ∈ [1, n−1]) e os segmentos finais são trocados. Se não houver, os filhos são cópias dos pais.
7. **Mutação por inversão de bits:** cada gene de cada filho é invertido de forma independente, com probabilidade igual à taxa de mutação.
8. **Nova geração:** as vagas restantes são preenchidas por filhos. Se sobrar uma única vaga, fica apenas o **primeiro filho do último par**. O tamanho da população é constante e indivíduos repetidos são permitidos.
9. **Encerramento:** depois do número configurado de gerações, o programa mostra a **melhor solução encontrada em toda a execução**, incluindo a geração 0.

**Ordem dos sorteios** (garante a reprodutibilidade pela semente): na geração 0, os genes do indivíduo 0 (A, B, …), depois os do indivíduo 1, e assim por diante. Em cada nova geração, para cada par:
- *k* sorteios do torneio 1;
- *k* sorteios do torneio 2;
- um sorteio que decide se há cruzamento, mais um para o corte quando há;
- um sorteio por gene do filho 1;
- um sorteio por gene do filho 2, quando ele é mantido.

### Transparência: métricas, histórico, log e animação
- **Métricas:** geração atual, melhor aptidão da geração, aptidão média da população e melhor resultado acumulado.
- **Melhor solução / resultado final:** cromossomo, projetos escolhidos, custo total, benefício total, saldo do orçamento e geração em que a solução foi encontrada.
- **Gráfico:** melhor aptidão, média e melhor acumulado por geração.
- **Histórico** em tabela, com um registro por geração (geração 0 incluída). Pode ser baixado em CSV.
- **Log das etapas** por geração, mostrando:
  - o elitismo (quem foi copiado e para qual vaga);
  - os candidatos e o vencedor de cada torneio;
  - o sorteio do cruzamento e o ponto de corte;
  - os filhos gerados;
  - os bits invertidos pela mutação;
  - cada passo da reparação, com o projeto removido e sua razão;
  - a aptidão final e a vaga ocupada.

  O log registra apenas os eventos que realmente ocorreram e pode ser baixado em `.txt`.
- **Animação didática** gerada a partir do log real:
  - destaque dos candidatos e dos pais escolhidos na população de origem;
  - separação dos cromossomos no ponto de corte e troca animada dos segmentos;
  - cores indicando de qual pai veio cada gene;
  - bits mutados em destaque;
  - riscado do projeto removido na reparação;
  - selo de elite;
  - preenchimento das vagas da nova geração.

  Há controles de velocidade, par anterior/próximo e "animar esta geração" a partir do log.
- **Avaliar um cromossomo:** avalia e repara qualquer cromossomo digitado, mostrando cada passo. Serve para conferir os testes 6.2, 6.3 e 6.6.

## Instruções de uso

1. Abra a aplicação pelo link do GitHub Pages. Para rodar localmente, basta abrir o `index.html` no navegador.
2. A aplicação já começa com o exemplo da seção 6.1 e a configuração da seção 6.5.
3. Edite os projetos se quiser:
   - nome, custo e benefício podem ser alterados;
   - **+ Adicionar projeto** e ✕ removem ou incluem itens, sempre entre 4 e 15;
   - **Restaurar exemplo** volta aos dados da seção 6.1.
4. Ajuste os parâmetros. Entradas inválidas, inclusive campos vazios, são bloqueadas com mensagem de erro.
5. Use os controles:
   - **Executar:** roda as gerações até o limite, no intervalo escolhido. Com intervalo 0, roda o mais rápido possível.
   - **Pausar:** preserva o estado; **Executar** retoma de onde parou.
   - **Avançar uma geração:** produz exatamente uma nova geração e permanece pausado. Por padrão, anima as operações dessa geração.
   - **Reiniciar:** limpa o histórico, aplica os dados e parâmetros dos campos e restabelece a semente configurada.
   - Qualquer alteração nos dados ou parâmetros bloqueia Executar e Avançar até clicar em **Reiniciar**.
6. A aba **Testes de validação** roda os testes da seção 6 e o experimento de mutação.

### Parâmetros

| Campo | Valor inicial | Validação |
|-------|---------------|-----------|
| Projetos (nome, custo, benefício) | Seção 6.1 | 4 a 15 projetos; nome não vazio; custo > 0 em reais, com até 2 casas decimais; benefício ≥ 0 (até 2 casas decimais) |
| Orçamento disponível (R$) | 7000 | Valor ≥ 0, com até 2 casas decimais |
| Tamanho da população | 20 | Inteiro ≥ 2 (limite prático de 10.000) |
| Número de gerações | 50 | Inteiro ≥ 1; a população inicial é a geração 0 (limite prático de 100.000) |
| Taxa de cruzamento (%) | 80 | Entre 0 e 100, aplicada por par |
| Taxa de mutação (%) | 5 | Entre 0 e 100, aplicada por gene |
| Tamanho do torneio | 2 | Inteiro entre 2 e o tamanho da população |
| Indivíduos de elite | 1 | Inteiro entre 0 e população − 1 |
| Semente aleatória | 42 | Inteiro de 0 a 4.294.967.295 |

Formato dos valores em reais: aceita vírgula ou ponto como separador decimal (`4000`, `4000,50` ou `4000.50`). Não use separador de milhar: `4.000` é recusado, porque teria 3 casas decimais.

Os limites práticos de população e gerações existem só para o navegador não travar. Em execuções muito longas, os detalhes do log das gerações mais antigas podem ser descartados para economizar memória, mas o histórico por geração é sempre mantido.

---

## Resultados dos testes (seção 6)

Todos os testes foram executados na aba **Testes de validação**, com os dados da seção 6.1:

| Projeto | Custo | Benefício |
|---------|-------|-----------|
| A — Melhoria da iluminação | R$ 4.000 | 7 |
| B — Instalação de bicicletários | R$ 3.000 | 5 |
| C — Aquisição de bancos | R$ 2.000 | 3 |
| D — Reforma de espaço de convivência | R$ 5.000 | 8 |

Orçamento: R$ 7.000.

**Resultado: 20 de 20 testes passaram.**

### 6.2 — Avaliação de uma solução
- **Entrada:** cromossomo `1100`; orçamento R$ 7.000.
- **Saída obtida:** projetos A e B; custo total R$ 7.000,00; benefício total 12; saldo R$ 0,00; solução viável; aptidão 12. Nenhum passo de reparação.
- **Soluções viáveis:** o programa enumerou os 16 cromossomos e encontrou exatamente as 9 soluções viáveis listadas no enunciado, todas com custo e benefício corretos:

| Cromossomo | Custo | Benefício |
|------------|-------|-----------|
| `0000` | R$ 0 | 0 |
| `1000` | R$ 4.000 | 7 |
| `0100` | R$ 3.000 | 5 |
| `0010` | R$ 2.000 | 3 |
| `0001` | R$ 5.000 | 8 |
| `1100` | R$ 7.000 | 12 |
| `1010` | R$ 6.000 | 10 |
| `0110` | R$ 5.000 | 8 |
| `0011` | R$ 7.000 | 11 |

  O ótimo global encontrado é `1100`, com benefício 12.
- **Conclusão:** a avaliação coincide com a referência.

### 6.3 — Reparação de uma solução inviável
- **Entrada:** cromossomo `1111`; orçamento R$ 7.000.
- **Saída obtida:**
  1. `1111`: custo R$ 14.000,00; benefício 23.
  2. Remove **C**, que tem a menor razão (1,5 pt por R$ mil) → `1101`: custo R$ 12.000,00; benefício 20.
  3. Remove **D**, que agora tem a menor razão (1,6 pt por R$ mil) → `1100`: custo R$ 7.000,00; benefício 12; solução viável.
- **Conclusão:** saída exata, igual à referência.

### 6.4 — Cruzamento e mutação com escolhas controladas
- **Entrada:** pai 1 = `1100`; pai 2 = `0011`; corte após o 2º gene; cruzamento forçado; mutação apenas no 1º gene do filho 1.
- **Saída obtida:**
  - Cruzamento: `11|00` + `00|11` → filho 1 = `1111`; filho 2 = `0000`.
  - Mutação: filho 1 = `0111`; filho 2 = `0000`.
  - Reparação do filho 1: `0111` → `0101` → `0100` (remove C e depois D).
  - Reparação do filho 2: permanece `0000`.
  - Avaliação final: filho 1 = `0100`, custo R$ 3.000,00 e aptidão 5; filho 2 = `0000`, custo R$ 0,00 e aptidão 0.
- **Limites das taxas:**
  - Mutação 0%: nenhum gene invertido em 2.000 cromossomos.
  - Mutação 100%: todos os genes invertidos em 2.000 cromossomos. Numa execução completa com 100%, cada filho é exatamente o complemento do resultado do cruzamento, antes da reparação.
  - Cruzamento 0%: os filhos copiam os pais em 2.000 pares.
  - Cruzamento 100%: o cruzamento sempre ocorre, com corte em {1, 2, 3}; os três valores foram observados.
  - Cruzamento, mutação e reparação aparecem em linhas separadas no log.
- **Seleção:**
  - Torneio com `1000` (7), `0011` (11) e `1100` (12): o vencedor é `1100` em todas as 6 ordens de sorteio.
  - Empates: candidatos #4 e #2 (ambos com 12) → vence #2. Candidatos #3 e #1 (ambos com 8) → vence #1, independentemente da ordem.
  - Em 1.000 torneios, nunca houve candidato repetido.
- **Conclusão:** todos os resultados controlados coincidem com a referência.

### 6.5 — Execução completa
- **Parâmetros:** população 20; 50 gerações; cruzamento 80%; mutação 5% por gene; torneio de tamanho 2; 1 indivíduo de elite; semente 42.
- **Saída obtida:** melhor solução `1100`, com os projetos A e B; custo R$ 7.000,00; benefício 12; saldo R$ 0,00. Ela já estava na geração 0 (indivíduo #6).
- **Verificações:**
  - O histórico tem **51 registros** (geração 0 + 50 gerações).
  - O melhor benefício acumulado nunca diminui.
  - Com 1 indivíduo de elite, a melhor aptidão da população também nunca diminui: ficou em 12 em todas as gerações.
  - Os 1.020 indivíduos da execução (51 × 20) são viáveis e têm a aptidão igual ao benefício.
  - Os totais da solução final são compatíveis com o cromossomo.
  - Duas execuções com a semente 42 produziram histórico e população final idênticos.
  - Pausar, retomar e avançar no meio da execução levou ao mesmo resultado da execução contínua.
  - Os logs de toda a execução foram conferidos: torneios, cortes, mutações, reparações, elitismo e vagas são reproduzíveis a partir dos dados registrados.
- **Aptidão média:** subiu de 7,60 na geração 0 e, a partir da geração 4, oscilou entre 10,65 e 12,00 (11,20 na geração 50). A oscilação vem da mutação e do cruzamento, que geram alguns filhos piores a cada geração.

#### Efeito da taxa de mutação (1% × 20%, sementes 1 a 5)

| Semente | Mutação 1%: melhor (geração) | Mutação 1%: média na ger. 50 | Mutação 20%: melhor (geração) | Mutação 20%: média na ger. 50 |
|:-------:|:----------------------:|:----------------------------:|:-----------------------:|:-----------------------------:|
| 1 | `1100` = 12 (0) | 12,00 | `1100` = 12 (0) | 8,60 |
| 2 | `1100` = 12 (0) | 11,75 | `1100` = 12 (0) | 9,50 |
| 3 | `1100` = 12 (2) | 12,00 | `1100` = 12 (1) | 9,15 |
| 4 | `1100` = 12 (0) | 11,30 | `1100` = 12 (0) | 9,30 |
| 5 | `1100` = 12 (0) | 12,00 | `1100` = 12 (0) | 8,10 |
| **Média do melhor benefício final** | **12** | 11,81 | **12** | 8,93 |
| **Execuções que atingiram 12** | **5 de 5** | | **5 de 5** | |

**Análise.**

As duas taxas tiveram o mesmo resultado final: média 12 e 5 de 5 execuções no ótimo. Isso se explica pelo tamanho da instância. Com 4 projetos existem só 16 cromossomos, e a reparação transforma qualquer um deles em uma das 9 soluções viáveis. Uma população inicial de 20 indivíduos aleatórios quase sempre já contém `1100`. Isso aconteceu na geração 0 em 8 das 10 execuções; nas outras duas, o ótimo apareceu na geração 1 ou 2. Daí em diante, o elitismo garante que o melhor nunca se perde.

A diferença está no **comportamento da população**:
- **Com 1%**, a população **converge**: quase todos os indivíduos viram `1100`, e a aptidão média na geração 50 fica entre 11,30 e 12,00 (média de 11,81).
- **Com 20%**, cada filho tem em média 0,8 bit invertido. Isso **destrói constantemente** as boas soluções e mantém a população diversa, mas com aptidão média bem menor: entre 8,10 e 9,50 (média de 8,93).

Ou seja, uma mutação alta **explora mais** o espaço de busca, e uma mutação baixa **aproveita melhor** as soluções já encontradas.

Não dá para concluir que uma taxa é sempre melhor que a outra:
- Em instâncias maiores (mais projetos), em que o ótimo não aparece na população inicial, uma mutação muito baixa pode deixar a busca presa num ótimo local.
- Uma mutação muito alta aproxima o algoritmo de uma busca aleatória.

Aqui, o elitismo compensou a perturbação dos 20% e, por isso, os resultados finais empataram.

### 6.6 — Limites de orçamento
- **Orçamento R$ 0:** depois da reparação, **toda a população** da geração 0 é `0000`, e o mesmo vale para as 50 gerações seguintes. A melhor solução é `0000`, com custo R$ 0,00 e aptidão 0.
- **Orçamento R$ 14.000:** a avaliação de `1111` retorna custo R$ 14.000,00, benefício 23, saldo R$ 0,00 e solução viável, sem nenhuma reparação. Na execução completa com semente 42, a busca encontrou `1111`, com benefício 23.
- **Conclusão:** comportamento correto nos dois limites.

---

## Como publicar no GitHub Pages

1. Crie um repositório **público** no GitHub (por exemplo, `algoritmo-genetico`) e envie o conteúdo desta pasta:

   ```bash
   git init
   git add .
   git commit -m "Simulador de algoritmo genético"
   git branch -M main
   git remote add origin https://github.com/JoaoPedroLuz12/algoritmo-genetico.git
   git push -u origin main
   ```

2. No GitHub, vá em **Settings → Pages → Build and deployment**. Escolha **Deploy from a branch**, branch `main` e pasta `/ (root)`, e clique em **Save**.
3. Depois de 1 ou 2 minutos, a aplicação estará em `https://joaopedroluz12.github.io/algoritmo-genetico/`.
