// ACESSIBILIDADE — varre todas as páginas com o axe-core (regras WCAG 2.x A/AA), no tema normal e no de alto contraste.
// Uso: node tests/a11y.js
const fs = require('fs');
const { abrir, teste, verdade, encerrar } = require('./_util');
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const ROTAS = ['#/', '#/colecao', '#/colecao?cat=aneis', '#/produto/anel2', '#/produto/relogio1', '#/carrinho', '#/checkout',
  '#/conta', '#/privacidade', '#/termos', '#/titular', '#/guia-de-estilo', '#/mapa-do-site', '#/metricas'];

(async () => {
  // bypassCSP: o axe é injetado pelo teste (a CSP do site bloqueia scripts externos de propósito)
  const { browser, page } = await abrir({ viewport: { width: 1280, height: 900 }, bypassCSP: true });
  // carrinho com 1 item para as páginas de carrinho/checkout terem conteúdo
  await page.goto(page.url().split('#')[0] + '#/produto/brinco3'); await page.waitForSelector('#form-compra');
  await page.click('button[data-acao=add]');
  // Fecha o aviso ("toast") e espera ele sair do DOM: durante a animação ele fica semitransparente e o axe
  // mediria um contraste falso (teste intermitente). Contraste real do aviso (estável): texto branco sobre #15191D = 17.7:1;
  // link em Azul Tiffany sobre #15191D = 10.7:1.
  await page.click('.toast button'); await page.waitForSelector('.toast', { state: 'detached' });
  await page.evaluate(axeSrc);

  for (const tema of ['normal', 'alto']) {
    console.log(`\nTema: ${tema === 'alto' ? 'ALTO CONTRASTE' : 'normal'}`);
    for (const rota of ROTAS) {
      await teste(`${rota}`, async () => {
        await page.evaluate((r) => { location.hash = r; }, rota);
        await page.waitForSelector('h1'); await page.waitForTimeout(250);
        await page.evaluate((t) => { document.documentElement.dataset.contraste = t; }, tema);
        await page.waitForTimeout(450);   // espera as transições de cor de 0,2 s terminarem
        const r = await page.evaluate(async () => {
          const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
          return res.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.length}x — ${v.nodes[0].target.join(' ')}`);
        });
        verdade(r.length === 0, r.join(' | '));
      });
    }
  }
  await browser.close();
  encerrar();
})();
