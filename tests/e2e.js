// FLUXO COMPLETO — simula um usuário: cookies, vitrine, produto, carrinho, checkout, conta, LGPD, busca, SEO, métricas.
// Uso: node tests/e2e.js
const { abrir, teste, igual, verdade, encerrar, SITE, CONSENTIMENTO_TODOS } = require('./_util');
const ls = (page, k) => page.evaluate((k) => localStorage.getItem('alquim:' + k), k);

(async () => {
  // ---------- 1ª visita: banner de cookies (LGPD) ----------
  console.log('\nLGPD e cookies');
  let { browser, page, problemas } = await abrir({ viewport: { width: 1280, height: 900 } }, { consentimento: null });
  await teste('banner de cookies aparece na primeira visita', async () => verdade(await page.locator('#cookie-banner').isVisible()));
  await teste('"Apenas necessários" grava consentimento sem estatísticas/preferências', async () => {
    await page.click('#cookie-necessarios');
    const c = JSON.parse(await ls(page, 'consent'));
    igual(c.estatisticas, false); igual(c.preferencias, false); verdade(!!c.data, 'sem data do consentimento');
    verdade(!(await page.locator('#cookie-banner').isVisible()), 'banner continuou visível');
  });
  await teste('sem consentimento de estatísticas, nada é medido', async () => {
    await page.goto(SITE + '#/produto/anel1'); await page.waitForSelector('#form-compra');
    igual(await ls(page, 'metricas'), null);
  });
  await teste('barra de acessibilidade funciona, mas SEM consentimento não grava preferência', async () => {
    await page.click('#fonte-mais');
    igual(await page.evaluate(() => document.documentElement.dataset.fonte), '1');
    igual(await ls(page, 'prefs'), null);
    await page.click('#btn-contraste');
    igual(await page.evaluate(() => document.documentElement.dataset.contraste), 'alto');
    verdade((await page.textContent('#a11y-status')).includes('só nesta visita'), 'aviso de preferência não lembrada');
  });
  await teste('gerenciar preferências: aceitar "Preferências" passa a lembrar o tamanho do texto', async () => {
    await page.click('#abrir-cookies');
    await page.check('#ck-preferencias'); await page.click('#form-cookies button[type=submit]');
    igual(JSON.parse(await ls(page, 'prefs')).fonte, 1);
    await page.reload(); await page.waitForSelector('h1');
    igual(await page.evaluate(() => document.documentElement.dataset.fonte), '1', 'preferência não persistiu');
  });
  await teste('revogar "Preferências" apaga a preferência guardada', async () => {
    await page.click('#abrir-cookies'); await page.uncheck('#ck-preferencias'); await page.click('#form-cookies button[type=submit]');
    igual(await ls(page, 'prefs'), null);
  });
  await browser.close();

  // ---------- Compra completa (com consentimento total, para medir também as métricas) ----------
  console.log('\nVitrine, produto, carrinho e checkout');
  ({ browser, page, problemas } = await abrir({ viewport: { width: 1280, height: 900 } }, { consentimento: CONSENTIMENTO_TODOS }));
  await page.goto(SITE + '#/colecao'); await page.waitForSelector('#grade li');
  await teste('vitrine lista 18 peças', async () => igual(await page.locator('#grade li').count(), 18));
  await teste('filtro por categoria e atualização da URL', async () => {
    await page.check('input[name=cat][value=colares]');
    igual(await page.locator('#grade li').count(), 5); verdade(page.url().includes('cat=colares'));
  });
  await teste('filtro por preço e ordenação', async () => {
    await page.selectOption('#f-preco', 'ate500'); igual(await page.locator('#grade li').count(), 2);
    await page.check('input[name=cat][value=todas]'); await page.selectOption('#f-preco', '');
    await page.selectOption('#f-ord', 'menor');
    verdade((await page.textContent('#grade li:first-child .price')).includes('349'), 'menor preço deveria ser R$ 349');
  });
  await teste('busca por texto e estado vazio', async () => {
    await page.fill('#f-q', 'flor'); igual(await page.locator('#grade li').count(), 5);
    await page.fill('#f-q', 'zzzz'); verdade(await page.locator('#vazio').isVisible());
  });
  await teste('busca no cabeçalho leva à vitrine filtrada', async () => {
    await page.goto(SITE + '#/'); await page.waitForSelector('.hero');
    await page.click('#busca-toggle'); verdade(await page.locator('#busca-q').isVisible());
    await page.fill('#busca-q', 'estrela'); await page.press('#busca-q', 'Enter');
    await page.waitForSelector('#grade li'); verdade(page.url().includes('q=estrela'));
    verdade((await page.locator('#grade li').count()) >= 2, 'esperava resultados para "estrela"');
  });
  await teste('anel exige aro; ao escolher, adiciona e mostra feedback', async () => {
    await page.goto(SITE + '#/produto/anel2'); await page.waitForSelector('#form-compra');
    await page.click('button[data-acao=add]');
    verdade(await page.locator('#aro-err').isVisible()); igual(await page.getAttribute('#aro', 'aria-invalid'), 'true');
    await page.selectOption('#aro', '16'); await page.click('.qty button[data-acao=mais]'); await page.click('button[data-acao=add]');
    igual(await page.textContent('#cart-count'), '2');
    verdade((await page.textContent('button[data-acao=add]')).includes('Adicionado'), 'botão sem feedback');
    igual(await page.locator('.toast').count(), 1);
  });
  await teste('carrinho: cupom inválido, cupom válido, total correto', async () => {
    await page.goto(SITE + '#/carrinho'); await page.waitForSelector('.cart-item');
    await page.fill('#cupom', 'ERRADO'); await page.click('#form-cupom button[type=submit]');
    igual(await page.textContent('#cupom-err'), 'Cupom inválido ou expirado.');
    await page.fill('#cupom', 'alquim10'); await page.click('#form-cupom button[type=submit]');
    const resumo = (await page.textContent('.resumo dl')).replace(/\s+/g, ' ');
    verdade(resumo.includes('1.798,00') && resumo.includes('179,80') && resumo.includes('1.618,20'), resumo);
  });
  await teste('checkout: resumo de erros recebe o foco; consentimento é obrigatório', async () => {
    await page.click('text=Finalizar compra'); await page.waitForSelector('#form-checkout');
    await page.click('button[type=submit]:has-text("Confirmar pedido")');
    igual(await page.evaluate(() => document.activeElement.className), 'error-summary');
    await page.fill('#co-nome', 'Maria Souza'); await page.fill('#co-email', 'maria@exemplo.com'); await page.fill('#co-cep', '01310100');
    igual(await page.inputValue('#co-cep'), '01310-100');
    await page.fill('#co-rua', 'Av. Paulista'); await page.fill('#co-numero', '1000'); await page.fill('#co-bairro', 'Bela Vista'); await page.fill('#co-cidade', 'São Paulo'); await page.selectOption('#co-uf', 'SP');
    await page.click('button[type=submit]:has-text("Confirmar pedido")');
    verdade(await page.locator('#co-consent-err').isVisible(), 'sem erro de consentimento');
  });
  await teste('pedido confirmado, carrinho zerado, pedido salvo', async () => {
    await page.check('#co-consent'); await page.click('button[type=submit]:has-text("Confirmar pedido")');
    await page.waitForSelector('text=Pedido confirmado!');
    igual(await page.getAttribute('#link-carrinho', 'aria-label'), 'Carrinho, vazio');
    igual(JSON.parse(await ls(page, 'orders')).length, 1);
  });

  console.log('\nConta, direitos do titular e LGPD');
  await teste('cadastro exige consentimento e cria sessão', async () => {
    await page.goto(SITE + '#/conta'); await page.waitForSelector('#form-cadastro');
    await page.click('#form-cadastro button[type=submit]');
    verdade((await page.textContent('#form-cadastro .error-summary')).includes('Corrija 4 campos'));
    await page.fill('#reg-nome', 'Maria Souza'); await page.fill('#reg-email', 'maria@exemplo.com'); await page.fill('#reg-senha', 'senha1234'); await page.check('#reg-consent');
    await page.click('#form-cadastro button[type=submit]'); await page.waitForSelector('text=Olá, Maria');
    igual(await page.locator('.pedido').count(), 1);
  });
  await teste('login com senha errada falha; com a certa entra', async () => {
    await page.click('#sair'); await page.waitForSelector('#form-login');
    await page.fill('#log-email', 'maria@exemplo.com'); await page.fill('#log-senha', 'errada'); await page.click('#form-login button[type=submit]');
    await page.waitForFunction(() => document.querySelector('#form-login .error-summary').textContent.includes('incorretos'));
    await page.fill('#log-senha', 'senha1234'); await page.click('#form-login button[type=submit]'); await page.waitForSelector('text=Olá, Maria');
  });
  await teste('canal do titular gera protocolo e prazo de 15 dias', async () => {
    await page.goto(SITE + '#/titular'); await page.waitForSelector('#form-titular');
    await page.click('#form-titular button[type=submit]');
    verdade((await page.textContent('#form-titular .error-summary')).includes('Corrija 4 campos'));
    await page.fill('#ti-nome', 'Maria Souza'); await page.fill('#ti-email', 'maria@exemplo.com'); await page.selectOption('#ti-tipo', 'acesso'); await page.check('#ti-consent');
    await page.click('#form-titular button[type=submit]'); await page.waitForSelector('#titular-ok');
    verdade(/TIT-\d{6}/.test(await page.textContent('#titular-ok')), 'sem protocolo');
    igual(JSON.parse(await ls(page, 'solicitacoes')).length, 1);
  });
  await teste('baixar meus dados gera o arquivo JSON', async () => {
    await page.goto(SITE + '#/conta'); await page.waitForSelector('#baixar-dados');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#baixar-dados')]);
    igual(dl.suggestedFilename(), 'meus-dados-alquim.json');
  });
  await teste('excluir conta apaga usuário, pedidos e solicitações', async () => {
    await page.click('#excluir-conta'); await page.click('#dlg-confirmar-ok'); await page.waitForSelector('.hero');
    igual(await ls(page, 'users'), '[]'); igual(await ls(page, 'orders'), '[]'); igual(await ls(page, 'solicitacoes'), '[]');
  });
  await teste('newsletter exige e-mail válido e consentimento', async () => {
    await page.goto(SITE + '#/'); await page.waitForSelector('#form-news');
    await page.click('#form-news button[type=submit]');
    verdade((await page.textContent('#news-status')).includes('2 campos'));
    await page.fill('#news-email', 'a@b.com'); await page.check('#news-consent'); await page.click('#form-news button[type=submit]');
    verdade((await page.textContent('#news-status')).includes('Inscrição confirmada'));
  });

  console.log('\nAnalytics com consentimento');
  await teste('painel de métricas mostra o funil e os Web Vitals', async () => {
    await page.goto(SITE + '#/metricas'); await page.waitForSelector('text=Funil de compra');
    const t = await page.textContent('.prose');
    verdade(t.includes('Compras concluídas') && t.includes('LCP') && t.includes('CLS'), 'painel incompleto');
    const m = JSON.parse(await ls(page, 'metricas'));
    verdade(m.eventos.compra === 1 && m.eventos.add_carrinho >= 1 && m.eventos.ver_produto >= 1, JSON.stringify(m.eventos));
    verdade(!JSON.stringify(m).includes('maria'), 'métricas não podem ter dados pessoais');
  });
  await teste('revogar "Estatísticas" apaga as métricas coletadas', async () => {
    await page.click('#abrir-cookies'); await page.uncheck('#ck-estatisticas'); await page.click('#form-cookies button[type=submit]');
    igual(await ls(page, 'metricas'), null);
  });

  console.log('\nSEO e navegação');
  await teste('título, descrição e robots mudam por página; produto tem JSON-LD', async () => {
    await page.goto(SITE + '#/produto/colar3'); await page.waitForSelector('#form-compra');
    verdade((await page.title()).startsWith('Colar Cisne Cristal'));
    verdade((await page.getAttribute('meta[name=description]', 'content')).includes('Colar Cisne Cristal'));
    const ld = JSON.parse(await page.textContent('#ld-pagina'));
    igual(ld['@type'], 'Product'); igual(ld.offers.price, '699.00'); igual(ld.offers.priceCurrency, 'BRL');
    igual(await page.getAttribute('meta[name=robots]', 'content'), 'index, follow');
    await page.goto(SITE + '#/carrinho'); await page.waitForSelector('h1');
    igual(await page.getAttribute('meta[name=robots]', 'content'), 'noindex, nofollow');
    igual(await page.locator('#ld-pagina').count(), 0, 'JSON-LD de produto vazou para outra página');
  });
  await teste('exatamente um <h1> por página', async () => {
    for (const r of ['#/', '#/colecao', '#/produto/anel1', '#/carrinho', '#/conta', '#/privacidade', '#/mapa-do-site']) {
      await page.goto(SITE + r); await page.waitForSelector('h1');
      igual(await page.locator('main h1').count(), 1, r);
    }
  });
  await teste('mapa do site lista as 18 peças', async () => {
    await page.goto(SITE + '#/mapa-do-site'); await page.waitForSelector('h1');
    igual(await page.locator('.prose a[href^="#/produto/"]').count(), 18);
  });
  await teste('guia de estilo calcula contraste ao vivo', async () => {
    await page.goto(SITE + '#/guia-de-estilo'); await page.waitForSelector('h1');
    const t = await page.textContent('.prose table'); verdade(/\d+,\d:1/.test(t) || /\d+\.\d:1/.test(t), 'sem razões de contraste');
  });
  await teste('atalhos "Pular para…" movem o foco', async () => {
    await page.goto(SITE + '#/'); await page.reload(); await page.waitForSelector('.hero');   // acesso novo: foco no início da página
    await page.keyboard.press('Tab');
    igual(await page.evaluate(() => document.activeElement.textContent.trim()), 'Ir para o conteúdo');
    await page.keyboard.press('Enter');
    igual(await page.evaluate(() => document.activeElement.id), 'conteudo');
  });
  await teste('rotas inexistentes mostram 404 amigável', async () => {
    await page.goto(SITE + '#/nao-existe'); igual(await page.textContent('h1'), 'Página não encontrada');
    await page.goto(SITE + '#/produto/xxx'); igual(await page.textContent('h1'), 'Página não encontrada');
  });
  await teste('nenhum erro ou aviso no console durante todo o fluxo', async () => verdade(problemas.length === 0, problemas.join(' | ')));
  await browser.close();
  encerrar();
})();
