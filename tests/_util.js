// Utilidades compartilhadas pelos testes (abre o site local via file://, sem servidor)
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const SITE = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const CONSENTIMENTO_TODOS = JSON.stringify({ versao: 1, necessarios: true, preferencias: true, estatisticas: true, marketing: false, data: '2026-01-01T00:00:00.000Z' });
const CONSENTIMENTO_NENHUM = JSON.stringify({ versao: 1, necessarios: true, preferencias: false, estatisticas: false, marketing: false, data: '2026-01-01T00:00:00.000Z' });

async function abrir(opcoes = {}, { consentimento = CONSENTIMENTO_NENHUM } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(opcoes);
  const page = await ctx.newPage();
  const problemas = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) problemas.push(`console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => problemas.push('pageerror: ' + e.message));
  page.on('requestfailed', r => problemas.push('requestfailed: ' + r.url()));
  await page.goto(SITE);
  if (consentimento) { await page.evaluate((c) => localStorage.setItem('alquim:consent', c), consentimento); }
  await page.reload();
  await page.waitForSelector('h1');
  return { browser, ctx, page, problemas };
}

// Pequeno executor de testes: imprime ✔/✘ e sai com código 1 se algo falhar
let falhas = 0;
async function teste(nome, fn) {
  try { await fn(); console.log('  ✔', nome); }
  catch (e) { falhas++; console.log('  ✘', nome, '\n     ', String(e.message).split('\n')[0]); }
}
function igual(real, esperado, msg = '') { if (real !== esperado) throw new Error(`${msg} esperado ${JSON.stringify(esperado)}, recebido ${JSON.stringify(real)}`); }
function verdade(cond, msg = 'condição falsa') { if (!cond) throw new Error(msg); }
function encerrar() { console.log(falhas ? `\n${falhas} teste(s) falharam.` : '\nTodos os testes passaram.'); process.exit(falhas ? 1 : 0); }

module.exports = { SITE, abrir, teste, igual, verdade, encerrar, CONSENTIMENTO_TODOS, CONSENTIMENTO_NENHUM };
