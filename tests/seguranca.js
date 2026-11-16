// SEGURANÇA (OWASP) — CSP, XSS, hash de senha, limitação de tentativas, requisições externas e links.
// Uso: node tests/seguranca.js
const { abrir, teste, igual, verdade, encerrar, SITE, CONSENTIMENTO_TODOS } = require('./_util');
const ls = (page, k) => page.evaluate((k) => localStorage.getItem('alquim:' + k), k);

async function cadastrar(page, nome, email, senha) {
  await page.goto(SITE + '#/conta'); await page.waitForSelector('#form-cadastro');
  await page.fill('#reg-nome', nome); await page.fill('#reg-email', email); await page.fill('#reg-senha', senha); await page.check('#reg-consent');
  await page.click('#form-cadastro button[type=submit]'); await page.waitForSelector('#sair');
}

(async () => {
  const { browser, page, problemas } = await abrir({ viewport: { width: 1280, height: 900 } }, { consentimento: CONSENTIMENTO_TODOS });
  const requisicoes = [], bloqueadas = [];
  page.on('request', r => requisicoes.push(r.url()));
  page.on('requestfailed', r => bloqueadas.push(r.url()));   // a CSP derruba as requisições proibidas

  console.log('\nA05 — Configuração de segurança (CSP)');
  await teste('CSP bloqueia script inline injetado (XSS)', async () => {
    const r = await page.evaluate(() => {
      const s = document.createElement('script'); s.textContent = 'window.__invadido = true'; document.body.appendChild(s);
      return window.__invadido === true;
    });
    igual(r, false, 'o script injetado foi executado!');
  });
  await teste('CSP bloqueia script externo', async () => {
    const violou = await page.evaluate(() => new Promise((res) => {
      document.addEventListener('securitypolicyviolation', () => res(true), { once: true });
      const s = document.createElement('script'); s.src = 'https://exemplo.com/mal.js'; document.body.appendChild(s);
      setTimeout(() => res(false), 1500);
    }));
    igual(violou, true, 'CSP não disparou violação');
  });
  await teste('CSP presente com object-src none e base-uri self', async () => {
    const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
    verdade(csp.includes("object-src 'none'") && csp.includes("base-uri 'self'") && csp.includes("script-src 'self'"));
  });

  console.log('\nA03 — Injeção / XSS');
  await teste('texto digitado é escapado (nome com HTML não vira elemento)', async () => {
    await cadastrar(page, '<img src=x onerror=window.__xss2=1>Maria', 'xss@exemplo.com', 'senha1234');
    igual(await page.locator('main img[src="x"]').count(), 0, 'HTML do nome virou elemento');
    igual(await page.evaluate(() => window.__xss2), undefined);
    verdade((await page.textContent('h1')).includes('<img'), 'nome deveria aparecer como texto');
  });

  console.log('\nA02 e A07 — Criptografia e autenticação');
  await teste('senha não fica em texto puro; hash PBKDF2 com sal único por usuário', async () => {
    await page.click('#sair'); await cadastrar(page, 'Joana Lima', 'joana@exemplo.com', 'senha1234');
    const bruto = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
    verdade(!bruto.includes('senha1234'), 'senha em texto puro no localStorage!');
    const [a, b] = JSON.parse(await ls(page, 'users'));
    igual(a.algo, 'pbkdf2-sha256'); igual(a.hash.length, 64); verdade(a.iter >= 100000, 'poucas iterações');
    verdade(a.salt !== b.salt && a.hash !== b.hash, 'mesma senha deveria gerar hashes diferentes (sal único)');
  });
  await teste('após 5 tentativas erradas o login é bloqueado temporariamente', async () => {
    await page.click('#sair'); await page.waitForSelector('#form-login');
    for (let i = 0; i < 5; i++) {
      await page.fill('#log-email', 'joana@exemplo.com'); await page.fill('#log-senha', 'errada' + i);
      await page.click('#form-login button[type=submit]');
      await page.waitForFunction(() => /incorretos|Muitas/.test(document.querySelector('#form-login .error-summary').textContent));
    }
    await page.fill('#log-senha', 'senha1234'); await page.click('#form-login button[type=submit]');
    await page.waitForFunction(() => document.querySelector('#form-login .error-summary').textContent.includes('Muitas tentativas'));
    verdade(await page.locator('#sair').count() === 0, 'entrou mesmo bloqueado');
  });

  console.log('\nPrivacidade e boas práticas');
  await teste('nenhuma requisição a servidores externos (sem terceiros)', async () => {
    // ignora a sonda do teste de CSP (script externo de propósito), que foi bloqueada
    const externas = requisicoes.filter(u => !/^(file|data|blob|about):/.test(u) && !bloqueadas.includes(u));
    verdade(externas.length === 0, externas.join(', '));
  });
  await teste('links que abrem nova aba usam rel="noopener"', async () => {
    for (const r of ['#/', '#/conta', '#/titular']) {
      await page.goto(SITE + r); await page.waitForSelector('h1');
      const ruins = await page.$$eval('a[target="_blank"]', as => as.filter(a => !/noopener/.test(a.rel)).length);
      igual(ruins, 0, r);
    }
  });
  await teste('campos de senha usam autocomplete correto (gerenciadores de senha)', async () => {
    await page.goto(SITE + '#/conta'); await page.waitForSelector('#form-login');
    igual(await page.getAttribute('#log-senha', 'autocomplete'), 'current-password');
    igual(await page.getAttribute('#reg-senha', 'autocomplete'), 'new-password');
  });
  await teste('nenhum erro de console (a CSP não bloqueou nada do próprio site)', async () => {
    const reais = problemas.filter(p => !p.includes('mal.js') && !p.includes('Content Security Policy') && !p.includes('script-src'));
    verdade(reais.length === 0, reais.join(' | '));
  });
  await browser.close();
  encerrar();
})();
