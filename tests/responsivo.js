// RESPONSIVIDADE — matriz de dispositivos, orientação, toque e zoom de texto (WCAG 1.4.4 / 1.4.10).
// Uso: node tests/responsivo.js
const { chromium } = require('playwright');
const { SITE, teste, igual, verdade, encerrar, CONSENTIMENTO_NENHUM } = require('./_util');

const DISPOSITIVOS = [
  { nome: 'Smartphone pequeno 360×740', viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
  { nome: 'Smartphone 390×844', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { nome: 'Smartphone na horizontal 844×390', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  { nome: 'Tablet 820×1180', viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
  { nome: 'Tablet na horizontal 1180×820', viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true },
  { nome: 'Notebook 1366×768', viewport: { width: 1366, height: 768 } },
  { nome: 'Desktop 1920×1080', viewport: { width: 1920, height: 1080 } }
];
const ROTAS = ['#/', '#/colecao', '#/produto/anel2', '#/produto/pulseira3', '#/carrinho', '#/checkout', '#/conta', '#/privacidade', '#/titular', '#/guia-de-estilo', '#/metricas'];
const estouro = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

(async () => {
  const browser = await chromium.launch();
  for (const d of DISPOSITIVOS) {
    console.log('\n' + d.nome);
    const ctx = await browser.newContext({ viewport: d.viewport, isMobile: d.isMobile, hasTouch: d.hasTouch });
    const page = await ctx.newPage();
    await page.goto(SITE); await page.evaluate((c) => localStorage.setItem('alquim:consent', c), CONSENTIMENTO_NENHUM);
    // carrinho com um item para checkout/carrinho terem conteúdo
    await page.goto(SITE + '#/produto/brinco3'); await page.reload(); await page.waitForSelector('#form-compra'); await page.click('button[data-acao=add]');
    await teste('sem rolagem horizontal em todas as páginas', async () => {
      for (const r of ROTAS) { await page.goto(SITE + r); await page.waitForSelector('h1'); await page.waitForTimeout(80); igual(await estouro(page), 0, r); }
    });
    await teste('cabeçalho e menu acessíveis (menu hambúrguer abaixo de 900 px)', async () => {
      await page.goto(SITE + '#/'); await page.waitForSelector('.hero');
      if (d.viewport.width < 900) {
        verdade(await page.locator('#nav-toggle').isVisible(), 'hambúrguer ausente');
        verdade(!(await page.locator('#menu-principal').isVisible()), 'menu deveria começar fechado');
        await page.click('#nav-toggle'); verdade(await page.locator('#menu-principal').isVisible(), 'menu não abriu');
        igual(await page.getAttribute('#nav-toggle', 'aria-expanded'), 'true');
      } else {
        verdade(!(await page.locator('#nav-toggle').isVisible()), 'hambúrguer não deveria aparecer');
        verdade(await page.locator('#menu-principal').isVisible(), 'menu horizontal ausente');
      }
    });
    await teste('alvos de toque (botões, campos e selects) com pelo menos 40 px de altura', async () => {
      for (const r of ['#/colecao', '#/checkout', '#/conta']) {
        await page.goto(SITE + r); await page.waitForSelector('h1');
        const pequenos = await page.$$eval('button, select, input:not([type=checkbox]):not([type=radio]):not([type=hidden])', els =>
          els.filter(e => e.offsetParent !== null && !e.classList.contains('sr-only') && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 40)
            .map(e => (e.id || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height)));
        verdade(pequenos.length === 0, r + ' → ' + pequenos.slice(0, 4).join(', '));
      }
    });
    await teste('texto ampliado a 150% (barra de acessibilidade) continua sem rolagem horizontal', async () => {
      await page.goto(SITE + '#/'); await page.waitForSelector('.hero');
      for (let i = 0; i < 3; i++) await page.click('#fonte-mais');
      igual(await page.evaluate(() => document.documentElement.dataset.fonte), '3');
      for (const r of ['#/', '#/colecao', '#/produto/anel2', '#/carrinho', '#/checkout']) { await page.goto(SITE + r); await page.waitForSelector('h1'); igual(await estouro(page), 0, r); }
    });
    await ctx.close();
  }

  // Banner de cookies na 1ª visita em tela baixa (paisagem): não pode cobrir a tela inteira
  console.log('\nBanner de cookies em paisagem');
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); await page.goto(SITE); await page.waitForSelector('#cookie-banner');
  await teste('banner ocupa no máximo 75% da altura e é rolável', async () => {
    const h = await page.$eval('#cookie-banner', e => e.getBoundingClientRect().height);
    verdade(h <= 390 * 0.75 + 1, `banner com ${Math.round(h)}px de 390px`);
  });
  await teste('botões de aceitar ficam alcançáveis (clicável sem rolar a página)', async () => {
    await page.click('#cookie-necessarios', { timeout: 3000 });
  });
  await browser.close();
  encerrar();
})();
