/* =========================================================================
   ALQUIM
   -------------------------------------------------------------------------
   Sumário
     1. Configurações e utilitários
     2. Armazenamento (localStorage) — carrinho, sessão, pedidos
     3. LGPD: consentimento de cookies
     4. Avisos (toasts) e feedback visual
     5. Formulários: componentes e validação acessível
     6. Componentes de interface (card de produto, quantidade)
     7. Páginas (views): Home, Vitrine, Produto, Carrinho, Checkout, Pedido, Conta, Políticas
     8. Roteador (hash) e inicialização
   O site é uma SPA: cada rota (#/colecao, #/produto/anel1 …) desenha seu HTML dentro do <main>.
   ========================================================================= */
'use strict';

/* =========================================================================
   1. CONFIGURAÇÕES E UTILITÁRIOS
   ========================================================================= */
const CFG = {
  FRETE_GRATIS_A_PARTIR: 500,   // R$ — frete grátis acima deste valor
  FRETE_FIXO: 29.9,             // R$ — frete simulado abaixo do valor mínimo
  PARCELAS: 10,                 // parcelamento sem juros
  QTD_MAX: 10,                  // máximo por item
  CUPONS: { ALQUIM10: { percentual: 10, rotulo: '10% de desconto' } },
  AROS: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]
};
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const $  = (seletor, raiz = document) => raiz.querySelector(seletor);
const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];
const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moeda = (v) => formatadorBRL.format(v);
const arredondar = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const normalizar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const primeiroNome = (n) => String(n).trim().split(/\s+/)[0];
const nomeCategoria = (slug) => (CATEGORIAS.find(c => c.slug === slug) || {}).nome || '';
const produtoPorId = (id) => PRODUTOS.find(p => p.id === id);

/* Segurança: escapa texto digitado pelo usuário antes de colocá-lo em innerHTML (evita XSS) */
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* =========================================================================
   2. ARMAZENAMENTO (localStorage)
   Persistência simulada: carrinho, sessão do usuário, usuários, pedidos, newsletter e cookies.
   Se o navegador bloquear o localStorage (ex.: aba anônima), usamos a memória como plano B.
   ========================================================================= */
const memoria = {};
const Store = {
  prefixo: 'alquim:',
  get(chave, padrao = null) {
    try {
      const bruto = localStorage.getItem(this.prefixo + chave);
      return bruto === null ? (chave in memoria ? memoria[chave] : padrao) : JSON.parse(bruto);
    } catch (e) { return chave in memoria ? memoria[chave] : padrao; }
  },
  set(chave, valor) {
    memoria[chave] = valor;
    try { localStorage.setItem(this.prefixo + chave, JSON.stringify(valor)); } catch (e) { /* sem persistência */ }
  },
  remove(chave) {
    delete memoria[chave];
    try { localStorage.removeItem(this.prefixo + chave); } catch (e) { /* ignora */ }
  }
};

/* ---------- Carrinho ---------- */
const Carrinho = {
  // Carrega e saneia o que veio do localStorage (descarta itens inválidos)
  itens: (Store.get('cart', []) || [])
    .filter(i => i && produtoPorId(i.id) && Number.isInteger(i.qtd) && i.qtd > 0)
    .map(i => ({ ...i, qtd: Math.min(i.qtd, CFG.QTD_MAX), chave: `${i.id}|${i.tam || ''}` })),

  salvar() { Store.set('cart', this.itens); atualizarCabecalho(); },
  adicionar(id, tam = '', qtd = 1) {
    Metricas.evento('add_carrinho');
    const chave = `${id}|${tam}`;
    const existente = this.itens.find(i => i.chave === chave);
    if (existente) existente.qtd = Math.min(CFG.QTD_MAX, existente.qtd + qtd);
    else this.itens.push({ chave, id, tam, qtd: Math.min(CFG.QTD_MAX, qtd) });
    this.salvar();
  },
  definirQtd(chave, qtd) {
    const item = this.itens.find(i => i.chave === chave);
    if (!item) return;
    if (qtd <= 0) return this.remover(chave);
    item.qtd = Math.min(CFG.QTD_MAX, qtd);
    this.salvar();
  },
  remover(chave) { this.itens = this.itens.filter(i => i.chave !== chave); this.salvar(); },
  limpar() { this.itens = []; this.salvar(); },
  qtdTotal() { return this.itens.reduce((s, i) => s + i.qtd, 0); },
  linhas() { return this.itens.map(i => ({ ...i, produto: produtoPorId(i.id) })); },
  cupomAtivo() { const c = Store.get('cupom', null); return c && CFG.CUPONS[c] ? c : null; },
  totais() {
    const subtotal = arredondar(this.linhas().reduce((s, l) => s + l.produto.preco * l.qtd, 0));
    const cupom = this.cupomAtivo();
    const desconto = cupom ? arredondar(subtotal * CFG.CUPONS[cupom].percentual / 100) : 0;
    const base = arredondar(subtotal - desconto);
    const frete = (subtotal === 0 || base >= CFG.FRETE_GRATIS_A_PARTIR) ? 0 : CFG.FRETE_FIXO;
    return { subtotal, desconto, frete, total: arredondar(base + frete), cupom };
  }
};

/* ---------- Usuários e sessão (simulação de cadastro/login) ----------
   SEGURANÇA (OWASP A02 e A07): a senha nunca é guardada em texto puro. Usamos PBKDF2-SHA256
   (150.000 iterações) com um "sal" aleatório por usuário, pela API nativa do navegador (Web Crypto).
   ATENÇÃO (para a apresentação): em um sistema real isso é feito no SERVIDOR (argon2/bcrypt), com HTTPS;
   senhas e autenticação nunca devem depender só do navegador. */
const PBKDF2_ITERACOES = 150000;
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function pbkdf2(senha, saltHex, iteracoes) {
  const sal = Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes }, chave, 256));
}
async function criarCredencial(senha) {
  if (window.crypto && crypto.subtle) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    return { algo: 'pbkdf2-sha256', iter: PBKDF2_ITERACOES, salt, hash: await pbkdf2(senha, salt, PBKDF2_ITERACOES) };
  }
  // Plano B (ex.: página aberta por http:// em rede local, onde o navegador desativa crypto.subtle). NÃO é seguro.
  return { algo: 'fraco-b64', hash: btoa(unescape(encodeURIComponent(senha))) };
}
async function verificarSenha(usuario, senha) {
  if (usuario.algo === 'pbkdf2-sha256') return (window.crypto && crypto.subtle) ? (await pbkdf2(senha, usuario.salt, usuario.iter)) === usuario.hash : false;
  if (usuario.algo === 'fraco-b64') return btoa(unescape(encodeURIComponent(senha))) === usuario.hash;
  return false;
}
/* Limitação de tentativas de login (OWASP A07): após 5 erros seguidos, bloqueia por 30 s.
   Contador global e sem dados pessoais. No navegador isto é só demonstração; em produção o bloqueio é no servidor. */
const Tentativas = {
  LIMITE: 5, BLOQUEIO_MS: 30000,
  restante() { const t = Store.get('tentativas', { n: 0, ate: 0 }); return Math.max(0, Math.ceil((t.ate - Date.now()) / 1000)); },
  falhou() {
    const t = Store.get('tentativas', { n: 0, ate: 0 });
    t.n += 1;
    if (t.n >= this.LIMITE) { t.ate = Date.now() + this.BLOQUEIO_MS; t.n = 0; }
    Store.set('tentativas', t);
  },
  zerar() { Store.remove('tentativas'); }
};
const Sessao = {
  atual() { return Store.get('session', null); },
  entrar(u) { Store.set('session', { email: u.email, nome: u.nome }); atualizarCabecalho(); },
  sair() { Store.remove('session'); atualizarCabecalho(); }
};
const usuarios = () => Store.get('users', []);
const pedidosDe = (email) => Store.get('orders', []).filter(p => p.cliente.email === email);

/* ---------- Cabeçalho: contador do carrinho e rótulo da conta ---------- */
function atualizarCabecalho() {
  const n = Carrinho.qtdTotal();
  const selo = $('#cart-count');
  selo.textContent = n;
  selo.dataset.zero = String(n === 0);
  $('#link-carrinho').setAttribute('aria-label', n === 0 ? 'Carrinho, vazio' : `Carrinho, ${n} ${n === 1 ? 'item' : 'itens'}`);
  const u = Sessao.atual();
  $('#conta-label').textContent = u ? primeiroNome(u.nome) : 'Entrar';
  $('#link-conta').setAttribute('aria-label', u ? `Minha conta, ${u.nome}` : 'Entrar ou criar conta');
}

/* ===========================3. LGPD — CONSENTIMENTO DE COOKIES===============================*/
const Consentimento = {
  VERSAO: 1,
  ler() { const c = Store.get('consent', null); return c && c.versao === this.VERSAO ? c : null; },
  salvar(escolhas) {
    const c = {
      versao: this.VERSAO, necessarios: true,
      preferencias: !!escolhas.preferencias, estatisticas: !!escolhas.estatisticas, marketing: !!escolhas.marketing,
      data: new Date().toISOString()
    };
    Store.set('consent', c);
    aplicarConsentimento(c);
    Visual.salvar();      // guarda (ou apaga) o tamanho de texto/contraste conforme o consentimento de "Preferências"
    return c;
  }
};
function aplicarConsentimento(c) {
  // Cada categoria só funciona com o consentimento correspondente (LGPD):
  //  - Preferências: sem consentimento, não guardamos nada (a barra de acessibilidade vale só na visita atual)
  //  - Estatísticas: métricas anônimas (ver Metricas); ao revogar, apagamos o que já foi coletado
  //  - Marketing: não há nenhum serviço de marketing nesta simulação
  if (!c.preferencias) Store.remove('prefs');
  if (c.estatisticas) observarVitais(); else Metricas.zerar();
  document.documentElement.dataset.cookies = [c.preferencias && 'pref', c.estatisticas && 'est', c.marketing && 'mkt'].filter(Boolean).join(',') || 'necessarios';
}
function ajustarAlturaBanner() {
  const b = $('#cookie-banner');
  document.body.style.setProperty('--banner-h', b.hidden ? '0px' : `${b.offsetHeight}px`);
}
function mostrarBanner(sim) {
  $('#cookie-banner').hidden = !sim;
  ajustarAlturaBanner();
}
function abrirPreferencias() {
  const c = Consentimento.ler() || {};
  $('#ck-preferencias').checked = !!c.preferencias;
  $('#ck-estatisticas').checked = !!c.estatisticas;
  $('#ck-marketing').checked = !!c.marketing;
  $('#dlg-cookies').showModal();
}
function registrarEscolhaCookies(escolhas) {
  const bannerVisivel = !$('#cookie-banner').hidden;
  Consentimento.salvar(escolhas);
  mostrarBanner(false);
  if ($('#dlg-cookies').open) $('#dlg-cookies').close();
  if (bannerVisivel) $('#conteudo').focus({ preventScroll: true });   // o botão clicado sumiu; devolve o foco ao conteúdo
  toast('Preferências de cookies salvas.');
}
function iniciarCookies() {
  const c = Consentimento.ler();
  if (c) aplicarConsentimento(c); else mostrarBanner(true);
  $('#cookie-aceitar').addEventListener('click', () => registrarEscolhaCookies({ preferencias: true, estatisticas: true, marketing: true }));
  $('#cookie-necessarios').addEventListener('click', () => registrarEscolhaCookies({}));
  $('#cookie-gerenciar').addEventListener('click', abrirPreferencias);
  $('#abrir-cookies').addEventListener('click', abrirPreferencias);
  $('#ck-aceitar-todos').addEventListener('click', () => registrarEscolhaCookies({ preferencias: true, estatisticas: true, marketing: true }));
  $('#ck-fechar').addEventListener('click', () => $('#dlg-cookies').close());
  $('#form-cookies').addEventListener('submit', (e) => {
    e.preventDefault();
    registrarEscolhaCookies({ preferencias: $('#ck-preferencias').checked, estatisticas: $('#ck-estatisticas').checked, marketing: $('#ck-marketing').checked });
  });
  window.addEventListener('resize', ajustarAlturaBanner);
}

/* ============ 3.1 PREFERÊNCIAS DE VISUALIZAÇÃO (barra de acessibilidade — padrão eMAG)============= */
const Visual = {
  estado: { fonte: 0, contraste: false },
  PERCENTUAIS: [87.5, 100, 112.5, 125, 150],     // níveis -1, 0, 1, 2, 3
  carregar() {
    const c = Consentimento.ler();
    const salvo = c && c.preferencias ? Store.get('prefs', null) : null;
    if (salvo) this.estado = { fonte: Math.min(3, Math.max(-1, salvo.fonte | 0)), contraste: !!salvo.contraste };
    this.aplicar();
  },
  aplicar() {
    const r = document.documentElement;
    r.dataset.fonte = String(this.estado.fonte);
    r.dataset.contraste = this.estado.contraste ? 'alto' : 'normal';
    const bc = $('#btn-contraste'); if (bc) bc.setAttribute('aria-pressed', String(this.estado.contraste));
    const bm = $('#fonte-menos'), bM = $('#fonte-mais');
    if (bm) bm.setAttribute('aria-disabled', String(this.estado.fonte <= -1));
    if (bM) bM.setAttribute('aria-disabled', String(this.estado.fonte >= 3));
  },
  salvar() {
    const c = Consentimento.ler();
    if (c && c.preferencias) Store.set('prefs', this.estado); else Store.remove('prefs');
  },
  anunciar(msg) {
    const c = Consentimento.ler();
    const aviso = (c && c.preferencias) ? '' : ' Vale só nesta visita; para lembrar, autorize "Preferências" nos cookies.';
    $('#a11y-status').textContent = msg + aviso;
  },
  ajustarFonte(delta) {
    const novo = delta === 0 ? 0 : Math.min(3, Math.max(-1, this.estado.fonte + delta));
    this.estado.fonte = novo;
    this.aplicar(); this.salvar();
    this.anunciar(`Tamanho do texto: ${this.PERCENTUAIS[novo + 1]}%.`);
  },
  alternarContraste() {
    this.estado.contraste = !this.estado.contraste;
    this.aplicar(); this.salvar();
    this.anunciar(this.estado.contraste ? 'Alto contraste ativado.' : 'Alto contraste desativado.');
  }
};

/* ======================3.2 ANALYTICS E MÉTRICAS (somente com consentimento de "Estatísticas")============================= */
const Metricas = {
  ativa() { const c = Consentimento.ler(); return !!(c && c.estatisticas); },
  vazio() { return { desde: new Date().toISOString(), paginas: {}, eventos: {}, produtos: {}, vitais: {} }; },
  ler() { return Store.get('metricas', null) || this.vazio(); },
  pagina(rota) {
    if (!this.ativa()) return;
    const m = this.ler(); m.paginas[rota] = (m.paginas[rota] || 0) + 1; Store.set('metricas', m);
  },
  evento(nome, produtoId) {
    if (!this.ativa()) return;
    const m = this.ler(); m.eventos[nome] = (m.eventos[nome] || 0) + 1;
    if (produtoId) m.produtos[produtoId] = (m.produtos[produtoId] || 0) + 1;
    Store.set('metricas', m);
  },
  vital(nome, valor) {
    if (!this.ativa()) return;
    const m = this.ler(); m.vitais[nome] = valor; Store.set('metricas', m);
  },
  zerar() { Store.remove('metricas'); Store.remove('log'); }
};
function observarVitais() {
  if (observarVitais.feito || !('PerformanceObserver' in window)) return;
  observarVitais.feito = true;
  try {
    new PerformanceObserver((lista) => {
      const e = lista.getEntries().pop(); if (e) Metricas.vital('LCP', Math.round(e.startTime));
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    let cls = 0;
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) if (!e.hadRecentInput) cls += e.value;
      Metricas.vital('CLS', Math.round(cls * 1000) / 1000);
    }).observe({ type: 'layout-shift', buffered: true });
    let pior = 0;
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) if (e.interactionId && e.duration > pior) { pior = e.duration; Metricas.vital('INP', Math.round(pior)); }
    }).observe({ type: 'event', durationThreshold: 40, buffered: true });
  } catch (e) { /* navegador sem suporte a algum tipo de métrica */ }
}

/* Monitoramento simples de erros (últimos 20), também só com consentimento de "Estatísticas". Sem dados pessoais. */
const Monitor = {
  registrar(msg, origem) {
    if (!Metricas.ativa()) return;
    const log = Store.get('log', []);
    log.push({ quando: new Date().toISOString(), msg: String(msg).slice(0, 200), origem: String(origem || '').slice(0, 120) });
    Store.set('log', log.slice(-20));
  }
};
window.addEventListener('error', (e) => Monitor.registrar(e.message, `${(e.filename || '').split('/').pop()}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => Monitor.registrar((e.reason && e.reason.message) || e.reason, 'promise'));

/* =========================================================================
   4. AVISOS (TOASTS) E FEEDBACK VISUAL
   ========================================================================= */
function toast(mensagem, { href, rotulo, tipo = 'ok', ms = 6000 } = {}) {
  const regiao = $('#toast-region');
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.innerHTML = `
    <svg class="icon icon-ok" aria-hidden="true"><use href="#i-${tipo === 'erro' ? 'close' : 'check'}"/></svg>
    <p>${esc(mensagem)}</p>
    ${href ? `<a href="${href}">${esc(rotulo)}</a>` : ''}
    <button type="button" aria-label="Fechar aviso"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>`;
  let timer;
  const fechar = () => { clearTimeout(timer); el.classList.add('saindo'); setTimeout(() => el.remove(), 300); };
  $('button', el).addEventListener('click', fechar);
  // Pausa o fechamento automático enquanto o usuário usa o mouse ou o teclado sobre o aviso (WCAG 2.2.1)
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('focusin', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(fechar, 2500); });
  timer = setTimeout(fechar, ms);
  regiao.appendChild(el);
  while (regiao.children.length > 3) regiao.firstElementChild.remove();
}

/* Animação sutil ao adicionar ao carrinho: botão muda para "Adicionado!" e o ícone da sacola "pula" */
function feedbackAdicionado(botao) {
  const rotulo = $('.btn-label', botao);
  if (rotulo) {
    if (!botao.dataset.original) botao.dataset.original = rotulo.textContent;
    rotulo.textContent = 'Adicionado!';
  }
  botao.classList.add('is-added');
  clearTimeout(botao._timer);
  botao._timer = setTimeout(() => {
    botao.classList.remove('is-added');
    if (rotulo) rotulo.textContent = botao.dataset.original;
  }, 1800);
  const sacola = $('#link-carrinho');
  sacola.classList.remove('bump'); void sacola.offsetWidth; sacola.classList.add('bump');
}

/* Diálogo de confirmação (elemento <dialog> nativo → foco preso e tecla Esc funcionam) */
function confirmar({ titulo, texto, rotulo = 'Confirmar' }) {
  return new Promise((resolve) => {
    const d = $('#dlg-confirmar');
    $('#dlg-confirmar-titulo').textContent = titulo;
    $('#dlg-confirmar-texto').textContent = texto;
    $('#dlg-confirmar-ok').textContent = rotulo;
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    d.returnValue = '';
    d.showModal();
  });
}

/* =========================================================================
   5. FORMULÁRIOS — COMPONENTES E VALIDAÇÃO ACESSÍVEL
   ========================================================================= */
function campo({ id, name, label, type = 'text', autocomplete = '', hint = '', obrig = true, valor = '', inputmode = '', maxlength = '' }) {
  const descricao = [hint ? `${id}-hint` : '', `${id}-err`].filter(Boolean).join(' ');
  return `
  <div class="field">
    <label for="${id}">${label}${obrig ? '<span class="req" aria-hidden="true"> *</span>' : ' <span class="hint">(opcional)</span>'}</label>
    <input id="${id}" name="${name}" type="${type}" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${obrig ? 'required' : ''}
      ${inputmode ? `inputmode="${inputmode}"` : ''} ${maxlength ? `maxlength="${maxlength}"` : ''} value="${esc(valor)}" aria-describedby="${descricao}">
    ${hint ? `<p class="hint" id="${id}-hint">${hint}</p>` : ''}
    <p class="field-error" id="${id}-err" hidden></p>
  </div>`;
}
function campoSelect({ id, name, label, opcoes, obrig = true, hint = '', valor = '', vazio = 'Selecione' }) {
  const descricao = [hint ? `${id}-hint` : '', `${id}-err`].filter(Boolean).join(' ');
  return `
  <div class="field">
    <label for="${id}">${label}${obrig ? '<span class="req" aria-hidden="true"> *</span>' : ''}</label>
    <select id="${id}" name="${name}" ${obrig ? 'required' : ''} aria-describedby="${descricao}">
      <option value="">${vazio}</option>
      ${opcoes.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(valor) ? 'selected' : ''}>${esc(t)}</option>`).join('')}
    </select>
    ${hint ? `<p class="hint" id="${id}-hint">${hint}</p>` : ''}
    <p class="field-error" id="${id}-err" hidden></p>
  </div>`;
}
function campoCheck({ id, name, html }) {
  return `
  <div class="field field-check">
    <input type="checkbox" id="${id}" name="${name}" required aria-describedby="${id}-err">
    <label for="${id}">${html}</label>
    <p class="field-error" id="${id}-err" hidden></p>
  </div>`;
}

function campoTexto({ id, name, label, obrig = false, hint = '', maxlength = 500 }) {
  const descricao = [hint ? `${id}-hint` : '', `${id}-err`].filter(Boolean).join(' ');
  return `
  <div class="field">
    <label for="${id}">${label}${obrig ? '<span class="req" aria-hidden="true"> *</span>' : ' <span class="hint">(opcional)</span>'}</label>
    <textarea id="${id}" name="${name}" rows="4" maxlength="${maxlength}" ${obrig ? 'required' : ''} aria-describedby="${descricao}"></textarea>
    ${hint ? `<p class="hint" id="${id}-hint">${hint}</p>` : ''}
    <p class="field-error" id="${id}-err" hidden></p>
  </div>`;
}

/* Regras de validação reutilizáveis (retornam '' se válido, ou a mensagem de erro) */
const V = {
  obrig: (msg) => (v) => (v ? '' : msg),
  email: (v) => !v ? 'Informe seu e-mail.' : (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Informe um e-mail válido, como nome@exemplo.com.'),
  nome: (v) => v.length >= 3 ? '' : 'Informe seu nome completo (mínimo de 3 letras).',
  cep: (v) => /^\d{5}-?\d{3}$/.test(v) ? '' : 'Informe um CEP válido com 8 números, como 01310-100.',
  senhaNova: (v) => (v.length >= 8 && /\d/.test(v) && /[A-Za-zÀ-ú]/.test(v)) ? '' : 'Crie uma senha com pelo menos 8 caracteres, incluindo letras e números.',
  consent: (msg) => (v) => v ? '' : msg
};

function limparErros(form) {
  $$('[aria-invalid]', form).forEach(el => el.removeAttribute('aria-invalid'));
  $$('.field-error', form).forEach(p => { p.hidden = true; p.textContent = ''; });
  $$('.field.has-error', form).forEach(f => f.classList.remove('has-error'));
  const resumo = $('.error-summary', form);
  if (resumo) { resumo.hidden = true; resumo.innerHTML = ''; }
}
function marcarErro(el, msg) {
  const p = document.getElementById(`${el.id}-err`);
  if (p) { p.textContent = msg; p.hidden = false; }
  el.setAttribute('aria-invalid', 'true');
  const f = el.closest('.field'); if (f) f.classList.add('has-error');
}
/* Valida o formulário segundo { nomeDoCampo: regra } e devolve a lista de erros */
function validar(form, regras) {
  limparErros(form);
  const erros = [];
  for (const [nome, regra] of Object.entries(regras)) {
    const el = form.elements[nome];
    if (!el) continue;
    const valor = el.type === 'checkbox' ? el.checked : (el.value || '').trim();
    const msg = regra(valor, form);
    if (msg) erros.push({ el, msg });
  }
  erros.forEach(e => marcarErro(e.el, e.msg));
  return erros;
}
/* Mostra o resumo de erros (com links para cada campo) e move o foco para ele */
function mostrarErros(form, erros) {
  const resumo = $('.error-summary', form);
  if (!resumo) { erros[0].el.focus(); return; }
  resumo.innerHTML = `<h2 class="error-title">Corrija ${erros.length === 1 ? '1 campo' : erros.length + ' campos'} para continuar:</h2>
    <ul>${erros.map(e => `<li><a href="#${e.el.id}" data-campo="${e.el.id}">${esc(e.msg)}</a></li>`).join('')}</ul>`;
  resumo.hidden = false;
  resumo.focus();
  resumo.onclick = (ev) => {
    const a = ev.target.closest('a[data-campo]');
    if (a) { ev.preventDefault(); document.getElementById(a.dataset.campo).focus(); }
  };
}
function mensagemSimples(form, texto) {
  const resumo = $('.error-summary', form);
  resumo.innerHTML = `<h2 class="error-title">${esc(texto)}</h2>`;
  resumo.hidden = false;
  resumo.focus();
}
function mascaraCEP(input) {
  input.addEventListener('input', () => {
    const d = input.value.replace(/\D/g, '').slice(0, 8);
    input.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  });
}

/* Texto padrão do consentimento (LGPD) — finalidade restrita à simulação */
const textoConsentimento = (dados) => `Li e concordo com a <a href="#/privacidade" target="_blank" rel="noopener">Política de Privacidade<span class="sr-only"> (abre em nova aba)</span></a>
  e <strong>consinto com o uso dos meus dados (${dados}) estritamente para fins da simulação de compra</strong> deste projeto acadêmico.
  Os dados ficam apenas no meu navegador e posso revogar o consentimento a qualquer momento.`;

/* =========================================================================
   6. COMPONENTES DE INTERFACE
   ========================================================================= */
/* Imagens responsivas (Performance / Core Web Vitals):
   o navegador escolhe a versão WebP de 480 ou 960 px conforme a largura da tela (srcset + sizes);
   o JPG original fica como plano B. Menos bytes = carregamento (LCP) mais rápido. */
const srcsetDe = (src) => { const b = src.replace(/^img\//, 'img/webp/').replace(/\.jpg$/, ''); return `${b}-480.webp 480w, ${b}-960.webp 960w`; };
const ir = (src, sizes) => `src="${src}" srcset="${srcsetDe(src)}" sizes="${sizes}"`;
const TAMANHO_CARD = '(min-width: 900px) 25vw, (min-width: 600px) 33vw, 50vw';
const img = (f, extra = '') => `<img ${ir(f.src, TAMANHO_CARD)} alt="${esc(f.alt)}" width="1024" height="1024" decoding="async" ${extra}>`;
const parcela = (preco) => moeda(arredondar(preco / CFG.PARCELAS));

/* Card de produto — imagem da peça, e na passagem do mouse/foco aparece a foto "em uso" */
function cardProduto(p) {
  const [fProduto, fUso] = p.fotos;
  const acao = p.categoria === 'aneis'
    ? `<a class="btn btn-outline btn-small btn-block" href="#/produto/${p.id}">Escolher aro</a>`
    : `<button type="button" class="btn btn-outline btn-small btn-block" data-add="${p.id}"><span class="btn-label">Adicionar</span><span class="sr-only"> ${esc(p.nome)} ao carrinho</span></button>`;
  return `
  <article class="card">
    <div class="card-media">
      ${p.selo ? `<span class="selo">${esc(p.selo)}</span>` : ''}
      ${img(fProduto, 'loading="lazy"')}
      ${fUso ? `<img class="img-uso" ${ir(fUso.src, TAMANHO_CARD)} alt="" aria-hidden="true" width="1024" height="1024" loading="lazy" decoding="async">` : ''}
    </div>
    <div class="card-body">
      <p class="card-cat">${nomeCategoria(p.categoria)}</p>
      <h3 class="card-title"><a href="#/produto/${p.id}">${esc(p.nome)}</a></h3>
      <p class="price">${moeda(p.preco)}<small>${CFG.PARCELAS}x de ${parcela(p.preco)}</small></p>
    </div>
    <div class="card-actions">${acao}</div>
  </article>`;
}

/* Controle de quantidade (− / campo / +) */
function controleQtd({ idCampo, valor, chave = '', nomeItem = '', pequeno = false }) {
  const dc = chave ? ` data-chave="${esc(chave)}"` : '';
  const alvo = nomeItem ? ` de ${esc(nomeItem)}` : '';
  return `
  <div class="qty ${pequeno ? 'qty-sm' : ''}" role="group" aria-label="Quantidade${alvo}">
    <button type="button" data-acao="menos"${dc} aria-label="Diminuir quantidade${alvo}"><svg class="icon" aria-hidden="true"><use href="#i-minus"/></svg></button>
    <input id="${idCampo}" name="qtd" type="number" inputmode="numeric" min="1" max="${CFG.QTD_MAX}" value="${valor}"${dc} aria-label="Quantidade${alvo}">
    <button type="button" data-acao="mais"${dc} aria-label="Aumentar quantidade${alvo}"><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg></button>
  </div>`;
}

/* =========================================================================
   7. PÁGINAS (VIEWS) — cada função devolve { titulo, html, depois(main) }
   ========================================================================= */

/* ----------------------------- 7.1 HOME ----------------------------- */
function viewHome() {
  const destaques = PRODUTOS.filter(p => p.destaque);
  const fotoHero = fotoDe('brinco2', 'uso');
  const fotoBanner = fotoDe('colar4', 'uso');
  const html = `
  <!-- HERO: primeira dobra com chamada principal -->
  <section class="hero" aria-labelledby="hero-titulo">
    <div class="container hero-grid">
      <div class="hero-text">
        <p class="eyebrow">Nova coleção · Tiffany Blue</p>
        <h1 id="hero-titulo">O azul que transforma cada detalhe em joia</h1>
        <p class="lead">Peças artesanais com cristais em azul-turquesa, banhadas em ródio e criadas para acompanhar os momentos que importam.</p>
        <div class="hero-cta">
          <a class="btn" href="#/colecao">Explorar a coleção <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></a>
          <a class="btn btn-outline" href="#/colecao?cat=colares">Ver colares</a>
        </div>
        <ul class="hero-points">
          <li><svg class="icon" aria-hidden="true"><use href="#i-truck"/></svg> Frete grátis acima de R$&nbsp;500</li>
          <li><svg class="icon" aria-hidden="true"><use href="#i-card"/></svg> 10x sem juros</li>
          <li><svg class="icon" aria-hidden="true"><use href="#i-shield"/></svg> Troca em 30 dias</li>
        </ul>
      </div>
      <figure class="hero-media">
        <img ${ir(fotoHero.src, '(min-width: 900px) 40vw, 100vw')} alt="${esc(fotoHero.alt)}" width="1024" height="1024" fetchpriority="high">
      </figure>
    </div>
  </section>

  <!-- CATEGORIAS -->
  <section class="section" aria-labelledby="cat-titulo">
    <div class="container">
      <div class="section-head"><h2 id="cat-titulo">Compre por categoria</h2></div>
      <div class="tiles">
        ${CATEGORIAS.map(c => {
          const f = fotoDe(c.capa.id, c.capa.tipo);
          return `<a class="tile" href="#/colecao?cat=${c.slug}">
            <img ${ir(f.src, '(min-width: 900px) 20vw, (min-width: 600px) 33vw, 50vw')} alt="${esc(f.alt)}" width="1024" height="1024" loading="lazy" decoding="async">
            <span class="tile-label">${c.nome} <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></span>
          </a>`;
        }).join('')}
      </div>
    </div>
  </section>

  <!-- DESTAQUES -->
  <section class="section" style="padding-top:0" aria-labelledby="dest-titulo">
    <div class="container">
      <div class="section-head">
        <h2 id="dest-titulo">Peças em destaque</h2>
        <a href="#/colecao">Ver toda a coleção</a>
      </div>
      <ul class="grid-produtos">${destaques.map(p => `<li>${cardProduto(p)}</li>`).join('')}</ul>
    </div>
  </section>

  <!-- COLEÇÃO EM DESTAQUE: Tiffany Blue -->
  <section class="colecao-banner section" aria-labelledby="colecao-titulo">
    <div class="container colecao-grid">
      <div>
        <p class="eyebrow">Coleção em destaque</p>
        <h2 id="colecao-titulo">Tiffany Blue</h2>
        <p>Um tom de azul-turquesa suave e luminoso, que lembra águas cristalinas. Flores, estrelas e ondas ganham vida em cristais lapidados, combinados com metal polido e brilho transparente.</p>
        <a class="btn" href="#/colecao">Descobrir a coleção <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></a>
      </div>
      <figure>
        <img ${ir(fotoBanner.src, '(min-width: 900px) 45vw, 100vw')} alt="${esc(fotoBanner.alt)}" width="1024" height="1024" loading="lazy" decoding="async">
      </figure>
    </div>
  </section>

  <!-- BENEFÍCIOS -->
  <section class="section" aria-labelledby="benef-titulo">
    <div class="container">
      <h2 id="benef-titulo" class="sr-only">Vantagens de comprar na Alquim</h2>
      <ul class="beneficios">
        <li><svg class="icon" aria-hidden="true"><use href="#i-truck"/></svg><h3>Frete grátis</h3><p>Em compras acima de R$&nbsp;500.</p></li>
        <li><svg class="icon" aria-hidden="true"><use href="#i-card"/></svg><h3>Em até 10x</h3><p>Sem juros no cartão.</p></li>
        <li><svg class="icon" aria-hidden="true"><use href="#i-shield"/></svg><h3>Garantia e troca</h3><p>30 dias para trocar sem custo.</p></li>
        <li><svg class="icon" aria-hidden="true"><use href="#i-gift"/></svg><h3>Embalagem presente</h3><p>Estojo azul em todas as peças.</p></li>
      </ul>
    </div>
  </section>

  <!-- NEWSLETTER (LGPD: checkbox de consentimento obrigatório) -->
  <section class="newsletter section" aria-labelledby="news-titulo">
    <div class="container narrow">
      <h2 id="news-titulo">Receba novidades e ofertas</h2>
      <p>Cadastre seu e-mail e fique por dentro dos lançamentos da Alquim.</p>
      <form id="form-news" class="newsletter-form" novalidate>
        <p class="hint">Campos marcados com <span class="req" aria-hidden="true">*</span><span class="sr-only">asterisco</span> são obrigatórios.</p>
        <div class="newsletter-row">
          ${campo({ id: 'news-email', name: 'email', label: 'Seu e-mail', type: 'email', autocomplete: 'email' })}
          <button type="submit" class="btn">Quero receber</button>
        </div>
        <div class="consent-box">
          ${campoCheck({ id: 'news-consent', name: 'consent', html: textoConsentimento('e-mail') })}
        </div>
        <p class="form-status" id="news-status" role="status"></p>
      </form>
    </div>
  </section>`;
  return { titulo: 'Joias finas em Azul Tiffany', html, depois: ligarNewsletter };
}

function ligarNewsletter(main) {
  const form = $('#form-news', main);
  if (!form) return;
  const status = $('#news-status', form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.className = 'form-status'; status.textContent = '';
    const erros = validar(form, { email: V.email, consent: V.consent('Para assinar a newsletter, marque a caixa de consentimento.') });
    if (erros.length) {
      status.classList.add('erro');
      status.textContent = erros.length === 1 ? 'Há 1 campo para corrigir.' : `Há ${erros.length} campos para corrigir.`;
      erros[0].el.focus();
      return;
    }
    const email = form.elements.email.value.trim().toLowerCase();
    const lista = Store.get('newsletter', []);
    if (!lista.some(n => n.email === email)) {
      lista.push({ email, data: new Date().toISOString(), consentimento: true, finalidade: 'simulação de compra' });
      Store.set('newsletter', lista);
    }
    form.reset();
    status.classList.add('ok');
    status.textContent = 'Inscrição confirmada! Obrigado. (Simulação: o e-mail foi guardado apenas neste navegador.)';
  });
}

/* ----------------------------- 7.2 VITRINE (com filtros) ----------------------------- */
const FAIXAS = {
  todos: { rotulo: 'Todas as faixas', ok: () => true },
  ate500: { rotulo: 'Até R$ 500', ok: p => p <= 500 },
  '500-800': { rotulo: 'R$ 500 a R$ 800', ok: p => p > 500 && p <= 800 },
  '800-1200': { rotulo: 'R$ 800 a R$ 1.200', ok: p => p > 800 && p <= 1200 },
  acima1200: { rotulo: 'Acima de R$ 1.200', ok: p => p > 1200 }
};
const ORDENACOES = {
  relevancia: { rotulo: 'Relevância', fn: () => 0 },
  menor: { rotulo: 'Menor preço', fn: (a, b) => a.preco - b.preco },
  maior: { rotulo: 'Maior preço', fn: (a, b) => b.preco - a.preco },
  nome: { rotulo: 'Nome (A–Z)', fn: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') }
};

function viewColecao(_, params) {
  const est = {
    cat: CATEGORIAS.some(c => c.slug === params.get('cat')) ? params.get('cat') : 'todas',
    preco: FAIXAS[params.get('preco')] ? params.get('preco') : 'todos',
    ord: ORDENACOES[params.get('ord')] ? params.get('ord') : 'relevancia',
    q: params.get('q') || ''
  };
  const titulo = est.cat === 'todas' ? 'Coleção Tiffany Blue' : nomeCategoria(est.cat);
  const chips = [['todas', 'Todas'], ...CATEGORIAS.map(c => [c.slug, c.nome])];
  const html = `
  <div class="page-head">
    <div class="container">
      <nav class="breadcrumb" style="padding:0" aria-label="Você está em"><ol><li><a href="#/">Início</a></li><li aria-current="page">Coleção</li></ol></nav>
      <h1 id="col-titulo">${titulo}</h1>
      <p>Joias com cristais em azul-turquesa, feitas para brilhar.</p>
    </div>
  </div>
  <div class="container">
    <form class="filtros" id="filtros" role="search" aria-label="Filtrar produtos" novalidate>
      <fieldset>
        <legend class="sr-only">Categoria</legend>
        <div class="chips">
          ${chips.map(([v, t]) => `<label class="chip"><input type="radio" name="cat" value="${v}" ${est.cat === v ? 'checked' : ''}><span>${t}</span></label>`).join('')}
        </div>
      </fieldset>
      <div class="filtros-selects">
        <div class="field"><label for="f-q">Buscar peça</label><input id="f-q" name="q" type="search" value="${esc(est.q)}" autocomplete="off" placeholder="Ex.: flor, estrela, argola"></div>
        ${campoSelect({ id: 'f-preco', name: 'preco', label: 'Faixa de preço', obrig: false, opcoes: Object.entries(FAIXAS).filter(([k]) => k !== 'todos').map(([k, f]) => [k, f.rotulo]), valor: est.preco === 'todos' ? '' : est.preco, vazio: FAIXAS.todos.rotulo })}
        ${campoSelect({ id: 'f-ord', name: 'ord', label: 'Ordenar por', obrig: false, opcoes: Object.entries(ORDENACOES).map(([k, o]) => [k, o.rotulo]), valor: est.ord, vazio: 'Relevância' })}
      </div>
    </form>
    <p class="resultado" id="resultado" role="status" aria-live="polite"></p>
    <h2 class="sr-only">Produtos</h2>
    <ul class="grid-produtos" id="grade"></ul>
    <div class="vazio" id="vazio" hidden>
      <svg class="icon" aria-hidden="true"><use href="#i-gem"/></svg>
      <h2>Nenhuma peça encontrada</h2>
      <p>Tente outra categoria, faixa de preço ou termo de busca.</p>
      <button type="button" class="btn btn-outline" id="limpar-filtros">Limpar filtros</button>
    </div>
    <div style="height:4rem"></div>
  </div>`;

  const depois = (main) => {
    const form = $('#filtros', main), grade = $('#grade', main), resultado = $('#resultado', main), vazio = $('#vazio', main);
    let anuncio;
    function atualizar() {
      est.cat = form.elements.cat.value;
      est.q = form.elements.q.value.trim();
      est.preco = form.elements.preco.value || 'todos';
      est.ord = form.elements.ord.value || 'relevancia';
      const termo = normalizar(est.q);
      const lista = PRODUTOS
        .filter(p => (est.cat === 'todas' || p.categoria === est.cat)
          && FAIXAS[est.preco].ok(p.preco)
          && (!termo || normalizar(`${p.nome} ${p.resumo} ${p.descricao} ${p.pedras} ${nomeCategoria(p.categoria)}`).includes(termo)))
        .sort(ORDENACOES[est.ord].fn);
      grade.innerHTML = lista.map(p => `<li>${cardProduto(p)}</li>`).join('');
      vazio.hidden = lista.length > 0;
      $('#col-titulo', main).textContent = est.cat === 'todas' ? 'Coleção Tiffany Blue' : nomeCategoria(est.cat);
      // Atualiza a URL sem disparar novo roteamento (link compartilhável)
      const qs = new URLSearchParams();
      if (est.cat !== 'todas') qs.set('cat', est.cat);
      if (est.preco !== 'todos') qs.set('preco', est.preco);
      if (est.ord !== 'relevancia') qs.set('ord', est.ord);
      if (est.q) qs.set('q', est.q);
      history.replaceState(null, '', '#/colecao' + (qs.toString() ? '?' + qs : ''));
      marcarNavAtiva(est.cat);
      // Anúncio para leitores de tela (com atraso para não repetir a cada tecla digitada)
      clearTimeout(anuncio);
      anuncio = setTimeout(() => {
        resultado.textContent = lista.length === 0 ? 'Nenhuma peça encontrada.' : `${lista.length} ${lista.length === 1 ? 'peça encontrada' : 'peças encontradas'}`;
      }, 250);
    }
    form.addEventListener('input', atualizar);
    form.addEventListener('change', atualizar);
    form.addEventListener('submit', (e) => e.preventDefault());
    $('#limpar-filtros', main).addEventListener('click', () => { form.reset(); form.elements.cat.value = 'todas'; atualizar(); form.elements.q.focus(); });
    atualizar();
  };
  return { titulo, html, depois, categoriaNav: est.cat, descricao: `${titulo}: joias com cristais em azul-turquesa, de R$ 349 a R$ 2.490, em até ${CFG.PARCELAS}x sem juros. Filtre por categoria e preço.` };
}

/* ----------------------------- 7.3 PÁGINA DO PRODUTO ----------------------------- */
function viewProduto([id]) {
  const p = produtoPorId(id);
  if (!p) return view404();
  const ehAnel = p.categoria === 'aneis';
  const relacionados = [...PRODUTOS.filter(x => x.categoria === p.categoria && x.id !== p.id), ...PRODUTOS.filter(x => x.categoria !== p.categoria && x.id !== p.id)].slice(0, 4);
  const rotuloFoto = (f) => f.tipo === 'uso' ? 'Ver foto da peça em uso' : 'Ver foto da peça';
  const html = `
  <div class="container">
    <nav class="breadcrumb" aria-label="Você está em">
      <ol>
        <li><a href="#/">Início</a></li>
        <li><a href="#/colecao?cat=${p.categoria}">${nomeCategoria(p.categoria)}</a></li>
        <li aria-current="page">${esc(p.nome)}</li>
      </ol>
    </nav>

    <article class="produto-grid" aria-labelledby="produto-titulo">
      <section aria-label="Fotos do produto">
        <figure class="galeria-main"><img id="foto-principal" ${ir(p.fotos[0].src, '(min-width: 900px) 50vw, 100vw')} alt="${esc(p.fotos[0].alt)}" width="1024" height="1024" fetchpriority="high"></figure>
        ${p.fotos.length > 1 ? `<div class="thumbs" role="group" aria-label="Escolher foto">
          ${p.fotos.map((f, i) => `<button type="button" class="thumb" data-i="${i}" aria-pressed="${i === 0}" aria-label="${rotuloFoto(f)}"><img ${ir(f.src, '76px')} alt="" width="152" height="152"></button>`).join('')}
        </div>` : ''}
      </section>

      <div class="produto-info">
        <p class="eyebrow">${nomeCategoria(p.categoria)} · Coleção Tiffany Blue</p>
        <h1 id="produto-titulo">${esc(p.nome)}</h1>
        <p class="produto-preco">${moeda(p.preco)}</p>
        <p class="produto-parcelas">ou ${CFG.PARCELAS}x de ${parcela(p.preco)} sem juros</p>
        <p>${esc(p.resumo)}</p>

        <form id="form-compra" class="compra-form" novalidate>
          ${ehAnel ? campoSelect({ id: 'aro', name: 'aro', label: 'Aro (tamanho)', opcoes: CFG.AROS.map(a => [a, `Aro ${a}`]), hint: 'Dica: meça o dedo e escolha o aro correspondente.' }) : ''}
          <div class="field">
            <span class="label" id="qtd-rotulo">Quantidade</span>
            ${controleQtd({ idCampo: 'qtd', valor: 1 })}
          </div>
          <div class="compra-acoes">
            <button type="submit" class="btn" data-acao="add"><span class="btn-label">Adicionar ao carrinho</span></button>
            <button type="submit" class="btn btn-tiffany" data-acao="comprar">Comprar agora</button>
          </div>
        </form>

        <details class="acc" open><summary>Descrição</summary><div><p>${esc(p.descricao)}</p></div></details>
        <details class="acc"><summary>Ficha técnica</summary><div>
          <table class="ficha"><tbody>
            <tr><th scope="row">Categoria</th><td>${nomeCategoria(p.categoria)}</td></tr>
            <tr><th scope="row">Coleção</th><td>Tiffany Blue</td></tr>
            <tr><th scope="row">Material</th><td>${esc(p.material)}</td></tr>
            <tr><th scope="row">Pedras</th><td>${esc(p.pedras)}</td></tr>
            <tr><th scope="row">Código</th><td>ALQ-${p.id.toUpperCase()}</td></tr>
          </tbody></table>
        </div></details>
        <details class="acc"><summary>Envio, trocas e garantia</summary><div>
          <p>Frete grátis acima de R$&nbsp;500 (abaixo disso, ${moeda(CFG.FRETE_FIXO)}). Troca em até 30 dias e garantia de 1 ano contra defeitos de fabricação. <em>(Informações fictícias, para fins acadêmicos.)</em></p>
        </div></details>
      </div>
    </article>

    <section class="section" style="padding-top:1rem" aria-labelledby="rel-titulo">
      <div class="section-head"><h2 id="rel-titulo">Você também pode gostar</h2></div>
      <ul class="grid-produtos">${relacionados.map(r => `<li>${cardProduto(r)}</li>`).join('')}</ul>
    </section>
  </div>`;

  const depois = (main) => {
    // Galeria: troca a foto principal (e o texto alternativo) ao escolher uma miniatura
    $$('.thumb', main).forEach(btn => btn.addEventListener('click', () => {
      const f = p.fotos[Number(btn.dataset.i)];
      const principal = $('#foto-principal', main);
      principal.src = f.src; principal.srcset = srcsetDe(f.src); principal.alt = f.alt;
      $$('.thumb', main).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    }));

    const form = $('#form-compra', main);
    const campoQtd = form.elements.qtd;
    const limitar = () => { campoQtd.value = Math.min(CFG.QTD_MAX, Math.max(1, parseInt(campoQtd.value, 10) || 1)); };
    $$('.qty button', form).forEach(b => b.addEventListener('click', () => {
      campoQtd.value = (parseInt(campoQtd.value, 10) || 1) + (b.dataset.acao === 'mais' ? 1 : -1);
      limitar();
    }));
    campoQtd.addEventListener('change', limitar);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const acao = (e.submitter && e.submitter.dataset.acao) || 'add';
      const erros = validar(form, ehAnel ? { aro: V.obrig('Selecione o aro do anel para continuar.') } : {});
      if (erros.length) { erros[0].el.focus(); return; }
      limitar();
      Carrinho.adicionar(p.id, ehAnel ? form.elements.aro.value : '', parseInt(campoQtd.value, 10));
      if (acao === 'comprar') { location.hash = '#/checkout'; return; }
      feedbackAdicionado(e.submitter);
      toast(`${p.nome} foi adicionado ao carrinho.`, { href: '#/carrinho', rotulo: 'Ver carrinho' });
    });
  };
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.nome, description: p.descricao,
    category: nomeCategoria(p.categoria), image: p.fotos.map(f => f.src), sku: `ALQ-${p.id.toUpperCase()}`,
    brand: { '@type': 'Brand', name: 'Alquim' },
    offers: { '@type': 'Offer', priceCurrency: 'BRL', price: p.preco.toFixed(2), availability: 'https://schema.org/InStock' }
  };
  return { titulo: p.nome, descricao: `${p.nome}: ${p.resumo} ${moeda(p.preco)} em até ${CFG.PARCELAS}x sem juros. Coleção Tiffany Blue da Alquim.`, jsonld, html, depois };
}

/* ----------------------------- 7.4 CARRINHO ----------------------------- */
function passos(atual) {
  const itens = ['Carrinho', 'Dados e pagamento', 'Confirmação'];
  return `<ol class="passos" aria-label="Etapas da compra">${itens.map((t, i) =>
    `<li ${i + 1 === atual ? 'aria-current="step"' : ''} class="${i + 1 < atual ? 'feito' : ''}">${t}</li>`).join('')}</ol>`;
}

function blocoResumo(t, { comCupom = false, erroCupom = '' } = {}) {
  const cupomHtml = !comCupom ? '' : `
    <form id="form-cupom" class="cupom" novalidate>
      <div class="field ${erroCupom ? 'has-error' : ''}">
        <label for="cupom">Cupom de desconto</label>
        <input id="cupom" name="cupom" type="text" autocomplete="off" ${t.cupom ? `value="${t.cupom}" readonly` : ''} aria-describedby="cupom-dica cupom-err" ${erroCupom ? 'aria-invalid="true"' : ''}>
      </div>
      ${t.cupom ? '<button type="button" class="btn btn-outline btn-small" id="remover-cupom">Remover</button>' : '<button type="submit" class="btn btn-outline btn-small">Aplicar</button>'}
      <p class="hint" id="cupom-dica" style="grid-column:1/-1">Dica para a apresentação: use <strong>ALQUIM10</strong>.</p>
      <p class="field-error" id="cupom-err" style="grid-column:1/-1" ${erroCupom ? '' : 'hidden'}>${esc(erroCupom)}</p>
    </form>`;
  return `
    ${cupomHtml}
    <dl>
      <div class="linha"><dt>Subtotal</dt><dd>${moeda(t.subtotal)}</dd></div>
      ${t.cupom ? `<div class="linha desc"><dt>Cupom ${t.cupom}</dt><dd>− ${moeda(t.desconto)}</dd></div>` : ''}
      <div class="linha"><dt>Frete (simulado)</dt><dd>${t.frete === 0 ? 'Grátis' : moeda(t.frete)}</dd></div>
      <div class="linha total"><dt>Total</dt><dd>${moeda(t.total)}</dd></div>
    </dl>
    <p class="hint">ou ${CFG.PARCELAS}x de ${parcela(t.total)} sem juros</p>`;
}

function htmlCarrinhoInterno(erroCupom = '') {
  const linhas = Carrinho.linhas();
  if (linhas.length === 0) {
    return `<div class="vazio container">
      <svg class="icon" aria-hidden="true"><use href="#i-bag"/></svg>
      <h2>Seu carrinho está vazio</h2>
      <p>Que tal conhecer a coleção Tiffany Blue?</p>
      <a class="btn" href="#/colecao">Ver coleção</a>
    </div>`;
  }
  const t = Carrinho.totais();
  return `
  <div class="container layout-2col">
    <section aria-labelledby="itens-titulo">
      <h2 id="itens-titulo" class="sr-only">Itens do carrinho</h2>
      <ul class="cart-list">
        ${linhas.map(l => {
          const p = l.produto, f = p.fotos[0];
          return `<li class="cart-item">
            <img ${ir(f.src, '(min-width: 900px) 120px, 88px')} alt="${esc(f.alt)}" width="120" height="120" loading="lazy">
            <div>
              <h3><a href="#/produto/${p.id}">${esc(p.nome)}</a></h3>
              <p class="cart-meta">${l.tam ? `Aro ${esc(l.tam)} · ` : ''}${moeda(p.preco)} cada</p>
            </div>
            <div class="cart-line">
              ${controleQtd({ idCampo: `q-${l.chave.replace('|', '-')}`, valor: l.qtd, chave: l.chave, nomeItem: p.nome, pequeno: true })}
              <strong>${moeda(p.preco * l.qtd)}</strong>
              <button type="button" class="remove-btn" data-acao="remover" data-chave="${esc(l.chave)}" aria-label="Remover ${esc(p.nome)} do carrinho">
                <svg class="icon" aria-hidden="true"><use href="#i-trash"/></svg> Remover
              </button>
            </div>
          </li>`;
        }).join('')}
      </ul>
      <p style="margin-top:1.5rem"><a href="#/colecao">← Continuar comprando</a></p>
    </section>
    <aside class="resumo" aria-labelledby="resumo-titulo">
      <h2 id="resumo-titulo">Resumo do pedido</h2>
      ${blocoResumo(t, { comCupom: true, erroCupom })}
      <a class="btn btn-block" href="#/checkout">Finalizar compra</a>
    </aside>
  </div>`;
}

function viewCarrinho() {
  const html = `
  <div class="page-head">
    <div class="container">
      <h1 id="carrinho-titulo">Seu carrinho</h1>
      ${passos(1)}
    </div>
  </div>
  <p class="sr-only" id="carrinho-status" role="status"></p>
  <div id="carrinho-raiz">${htmlCarrinhoInterno()}</div>`;

  const depois = (main) => {
    const raiz = $('#carrinho-raiz', main);
    const status = $('#carrinho-status', main);
    // Redesenha só a área do carrinho e devolve o foco a um elemento equivalente
    const redesenhar = (seletorFoco, erroCupom = '') => {
      raiz.innerHTML = htmlCarrinhoInterno(erroCupom);
      atualizarCabecalho();
      const alvo = (seletorFoco && $(seletorFoco, raiz)) || $('#carrinho-titulo', main);
      if (alvo) { alvo.tabIndex = alvo.tabIndex < 0 ? -1 : alvo.tabIndex; alvo.focus({ preventScroll: true }); }
    };
    const itemPor = (chave) => Carrinho.itens.find(i => i.chave === chave);

    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-acao]');
      if (b) {
        const chave = b.dataset.chave, item = itemPor(chave);
        if (!item) return;
        const nome = produtoPorId(item.id).nome;
        if (b.dataset.acao === 'remover') {
          Carrinho.remover(chave);
          redesenhar('');
          status.textContent = `${nome} removido do carrinho.`;
          toast(`${nome} foi removido do carrinho.`);
        } else {
          const nova = item.qtd + (b.dataset.acao === 'mais' ? 1 : -1);
          if (nova < 1) return;
          Carrinho.definirQtd(chave, nova);
          redesenhar(`button[data-acao="${b.dataset.acao}"][data-chave="${chave}"]`);
          status.textContent = `Quantidade de ${nome}: ${Math.min(nova, CFG.QTD_MAX)}.`;
        }
        return;
      }
      if (e.target.id === 'remover-cupom') {
        Store.remove('cupom');
        redesenhar('#cupom');
        status.textContent = 'Cupom removido.';
      }
    });
    raiz.addEventListener('change', (e) => {
      const input = e.target.closest('input[name="qtd"]');
      if (!input) return;
      const chave = input.dataset.chave;
      Carrinho.definirQtd(chave, Math.max(1, parseInt(input.value, 10) || 1));
      redesenhar(`input[data-chave="${chave}"]`);
    });
    raiz.addEventListener('submit', (e) => {
      if (e.target.id !== 'form-cupom') return;
      e.preventDefault();
      const codigo = e.target.elements.cupom.value.trim().toUpperCase();
      if (CFG.CUPONS[codigo]) {
        Store.set('cupom', codigo);
        Metricas.evento('cupom');
        redesenhar('#cupom');
        status.textContent = `Cupom ${codigo} aplicado: ${CFG.CUPONS[codigo].rotulo}.`;
        toast(`Cupom ${codigo} aplicado: ${CFG.CUPONS[codigo].rotulo}.`);
      } else {
        redesenhar('#cupom', codigo ? 'Cupom inválido ou expirado.' : 'Digite o código do cupom.');
      }
    });
  };
  return { titulo: 'Carrinho', html, depois };
}

/* ----------------------------- 7.5 CHECKOUT (simulação) ----------------------------- */
function viewCheckout() {
  if (Carrinho.itens.length === 0) return { redirecionar: '#/carrinho' };
  const u = Sessao.atual();
  const t = Carrinho.totais();
  const html = `
  <div class="page-head">
    <div class="container">
      <h1>Finalizar compra</h1>
      ${passos(2)}
    </div>
  </div>
  <div class="container layout-2col">
    <form id="form-checkout" novalidate aria-label="Dados de entrega e pagamento">
      <div class="error-summary" role="alert" tabindex="-1" hidden></div>
      <p class="hint" style="margin-bottom:1rem">Campos marcados com <span class="req" aria-hidden="true">*</span><span class="sr-only">asterisco</span> são obrigatórios. <strong>Simulação:</strong> nenhum pagamento é processado.</p>
      <div class="form-grid">
        <fieldset class="fieldset-card form-grid">
          <legend>Seus dados</legend>
          ${campo({ id: 'co-nome', name: 'nome', label: 'Nome completo', autocomplete: 'name', valor: u ? u.nome : '' })}
          ${campo({ id: 'co-email', name: 'email', label: 'E-mail', type: 'email', autocomplete: 'email', valor: u ? u.email : '', hint: 'Usado apenas para identificar o pedido nesta simulação.' })}
        </fieldset>

        <fieldset class="fieldset-card form-grid">
          <legend>Entrega</legend>
          <div class="row-2">
            ${campo({ id: 'co-cep', name: 'cep', label: 'CEP', autocomplete: 'postal-code', inputmode: 'numeric', maxlength: '9', hint: 'Exemplo: 01310-100' })}
            <div></div>
          </div>
          ${campo({ id: 'co-rua', name: 'rua', label: 'Rua / Avenida', autocomplete: 'address-line1' })}
          <div class="row-2">
            ${campo({ id: 'co-numero', name: 'numero', label: 'Número', autocomplete: 'off', hint: 'Use “s/n” se não houver.' })}
            ${campo({ id: 'co-compl', name: 'compl', label: 'Complemento', obrig: false, autocomplete: 'address-line2' })}
          </div>
          ${campo({ id: 'co-bairro', name: 'bairro', label: 'Bairro', autocomplete: 'off' })}
          <div class="row-2">
            ${campo({ id: 'co-cidade', name: 'cidade', label: 'Cidade', autocomplete: 'address-level2' })}
            ${campoSelect({ id: 'co-uf', name: 'uf', label: 'Estado (UF)', opcoes: UFS.map(s => [s, s]) })}
          </div>
        </fieldset>

        <fieldset class="fieldset-card">
          <legend>Pagamento (simulado)</legend>
          <div class="pagto">
            <label><input type="radio" name="pagamento" value="Pix" checked> Pix <span class="hint">· aprovação imediata</span></label>
            <label><input type="radio" name="pagamento" value="Cartão de crédito"> Cartão de crédito <span class="hint">· até ${CFG.PARCELAS}x sem juros</span></label>
            <label><input type="radio" name="pagamento" value="Boleto"> Boleto bancário</label>
          </div>
          <p class="hint" style="margin-top:.75rem">Por privacidade (LGPD — princípio da minimização), <strong>não pedimos número de cartão, CPF ou outros dados de pagamento</strong>.</p>
        </fieldset>

        <!-- LGPD: consentimento obrigatório e específico -->
        <div class="consent-box">
          ${campoCheck({ id: 'co-consent', name: 'consent', html: textoConsentimento('nome, e-mail e endereço') })}
        </div>

        <button type="submit" class="btn btn-block" style="min-height:56px">Confirmar pedido (simulação)</button>
      </div>
    </form>

    <aside class="resumo" aria-labelledby="co-resumo-titulo">
      <h2 id="co-resumo-titulo">Seu pedido</h2>
      <ul class="mini-itens">
        ${Carrinho.linhas().map(l => `<li>
          <img ${ir(l.produto.fotos[0].src, '48px')} alt="${esc(l.produto.fotos[0].alt)}" width="48" height="48">
          <span>${esc(l.produto.nome)}${l.tam ? `, aro ${esc(l.tam)}` : ''} <span class="hint">× ${l.qtd}</span></span>
          <strong>${moeda(l.produto.preco * l.qtd)}</strong></li>`).join('')}
      </ul>
      ${blocoResumo(t)}
      <p><a href="#/carrinho">← Voltar ao carrinho</a></p>
    </aside>
  </div>`;

  const depois = (main) => {
    const form = $('#form-checkout', main);
    mascaraCEP(form.elements.cep);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const erros = validar(form, {
        nome: V.nome, email: V.email, cep: V.cep,
        rua: V.obrig('Informe a rua ou avenida.'), numero: V.obrig('Informe o número (ou “s/n”).'),
        bairro: V.obrig('Informe o bairro.'), cidade: V.obrig('Informe a cidade.'), uf: V.obrig('Selecione o estado (UF).'),
        consent: V.consent('Para finalizar, marque a caixa de consentimento sobre o uso dos seus dados na simulação.')
      });
      if (erros.length) { mostrarErros(form, erros); return; }

      // Monta e salva o pedido no localStorage
      const f = form.elements;
      const agora = new Date().toISOString();
      const totais = Carrinho.totais();
      const pedido = {
        id: 'ALQ-' + (Math.floor(Math.random() * 900000) + 100000),
        data: agora,
        cliente: { nome: f.nome.value.trim(), email: f.email.value.trim().toLowerCase() },
        endereco: { cep: f.cep.value, rua: f.rua.value.trim(), numero: f.numero.value.trim(), compl: f.compl.value.trim(), bairro: f.bairro.value.trim(), cidade: f.cidade.value.trim(), uf: f.uf.value },
        pagamento: f.pagamento.value,
        itens: Carrinho.linhas().map(l => ({ id: l.id, nome: l.produto.nome, tam: l.tam, qtd: l.qtd, preco: l.produto.preco, foto: l.produto.fotos[0].src, alt: l.produto.fotos[0].alt })),
        totais,
        consentimento: { aceito: true, data: agora, finalidade: 'simulação de compra' }
      };
      Store.set('orders', [...Store.get('orders', []), pedido]);
      Metricas.evento('compra');
      Carrinho.limpar();
      Store.remove('cupom');
      location.hash = '#/pedido/' + pedido.id;
    });
  };
  return { titulo: 'Finalizar compra', html, depois };
}

/* ----------------------------- 7.6 CONFIRMAÇÃO DO PEDIDO ----------------------------- */
function viewPedido([id]) {
  const p = Store.get('orders', []).find(o => o.id === id);
  if (!p) return view404();
  const html = `
  <div class="container narrow confirmacao">
    <div class="selo-ok"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg></div>
    <p class="eyebrow">Pedido ${esc(p.id)}</p>
    <h1>Pedido confirmado!</h1>
    <p class="lead" style="margin-inline:auto">Obrigado, ${esc(primeiroNome(p.cliente.nome))}. Esta foi uma <strong>simulação</strong> de compra: nenhuma cobrança foi feita e nenhuma joia será enviada.</p>
    <section class="resumo" aria-labelledby="ped-resumo">
      <h2 id="ped-resumo">Resumo</h2>
      <ul class="mini-itens">
        ${p.itens.map(i => `<li><img ${ir(i.foto, '48px')} alt="${esc(i.alt)}" width="48" height="48"><span>${esc(i.nome)}${i.tam ? `, aro ${esc(i.tam)}` : ''} <span class="hint">× ${i.qtd}</span></span><strong>${moeda(i.preco * i.qtd)}</strong></li>`).join('')}
      </ul>
      ${blocoResumo(p.totais)}
      <p class="hint" style="margin:0"><strong>Pagamento:</strong> ${esc(p.pagamento)}<br>
      <strong>Entrega:</strong> ${esc(p.endereco.rua)}, ${esc(p.endereco.numero)}${p.endereco.compl ? ' — ' + esc(p.endereco.compl) : ''} · ${esc(p.endereco.bairro)}, ${esc(p.endereco.cidade)}/${esc(p.endereco.uf)} · CEP ${esc(p.endereco.cep)}</p>
    </section>
    <div class="hero-cta" style="justify-content:center">
      <a class="btn" href="#/colecao">Continuar comprando</a>
      <a class="btn btn-outline" href="#/conta">Meus dados e pedidos</a>
    </div>
  </div>`;
  return { titulo: 'Pedido confirmado', html };
}

/* ----------------------------- 7.7 CONTA (cadastro, login, direitos do titular) ----------------------------- */
function viewConta() {
  const u = Sessao.atual();
  return u ? viewContaLogada(u) : viewContaDeslogada();
}

function viewContaDeslogada() {
  const html = `
  <div class="page-head"><div class="container">
    <h1>Minha conta</h1>
    <p>Entre ou crie uma conta de demonstração. Os dados ficam apenas neste navegador.</p>
  </div></div>
  <div class="container"><div class="conta-grid dois">
    <section class="card-form" aria-labelledby="entrar-titulo">
      <h2 id="entrar-titulo">Entrar</h2>
      <form id="form-login" novalidate>
        <div class="error-summary" role="alert" tabindex="-1" hidden></div>
        <div class="form-grid">
          ${campo({ id: 'log-email', name: 'email', label: 'E-mail', type: 'email', autocomplete: 'email' })}
          ${campo({ id: 'log-senha', name: 'senha', label: 'Senha', type: 'password', autocomplete: 'current-password' })}
          <label class="pw-toggle"><input type="checkbox" data-mostrar="log-senha"> Mostrar senha</label>
          <button type="submit" class="btn btn-block">Entrar</button>
        </div>
      </form>
    </section>

    <section class="card-form" aria-labelledby="cadastro-titulo">
      <h2 id="cadastro-titulo">Criar conta</h2>
      <form id="form-cadastro" novalidate>
        <div class="error-summary" role="alert" tabindex="-1" hidden></div>
        <p class="hint" style="margin-bottom:1rem">Campos marcados com <span class="req" aria-hidden="true">*</span><span class="sr-only">asterisco</span> são obrigatórios.</p>
        <div class="form-grid">
          ${campo({ id: 'reg-nome', name: 'nome', label: 'Nome completo', autocomplete: 'name' })}
          ${campo({ id: 'reg-email', name: 'email', label: 'E-mail', type: 'email', autocomplete: 'email' })}
          ${campo({ id: 'reg-senha', name: 'senha', label: 'Crie uma senha', type: 'password', autocomplete: 'new-password', hint: 'Mínimo de 8 caracteres, com letras e números. Use uma senha fictícia: isto é uma simulação.' })}
          <label class="pw-toggle"><input type="checkbox" data-mostrar="reg-senha"> Mostrar senha</label>
          <div class="consent-box">
            ${campoCheck({ id: 'reg-consent', name: 'consent', html: textoConsentimento('nome e e-mail') })}
          </div>
          <button type="submit" class="btn btn-block">Criar conta</button>
        </div>
      </form>
    </section>
  </div></div>`;

  const depois = (main) => {
    $$('[data-mostrar]', main).forEach(cb => cb.addEventListener('change', () => {
      document.getElementById(cb.dataset.mostrar).type = cb.checked ? 'text' : 'password';
    }));

    // --- Login ---
    const fl = $('#form-login', main);
    fl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const erros = validar(fl, { email: V.email, senha: V.obrig('Informe sua senha.') });
      if (erros.length) { mostrarErros(fl, erros); return; }
      const email = fl.elements.email.value.trim().toLowerCase();
      const espera = Tentativas.restante();
      if (espera > 0) { mensagemSimples(fl, `Muitas tentativas incorretas. Aguarde ${espera} segundos e tente de novo.`); return; }
      const usuario = usuarios().find(x => x.email === email);
      const ok = usuario ? await verificarSenha(usuario, fl.elements.senha.value) : false;
      if (!ok) { Tentativas.falhou(); mensagemSimples(fl, 'E-mail ou senha incorretos. Verifique os dados ou crie uma conta.'); return; }
      Tentativas.zerar();
      Sessao.entrar(usuario);
      rotear();
      toast(`Bem-vindo(a) de volta, ${primeiroNome(usuario.nome)}!`);
    });

    // --- Cadastro (LGPD: exige consentimento) ---
    const fc = $('#form-cadastro', main);
    fc.addEventListener('submit', async (e) => {
      e.preventDefault();
      const erros = validar(fc, {
        nome: V.nome, email: V.email, senha: V.senhaNova,
        consent: V.consent('Para criar a conta, marque a caixa de consentimento sobre o uso dos seus dados.')
      });
      const email = fc.elements.email.value.trim().toLowerCase();
      if (!erros.some(x => x.el === fc.elements.email) && usuarios().some(x => x.email === email)) {
        const msg = 'Este e-mail já está cadastrado. Use o formulário “Entrar”.';
        marcarErro(fc.elements.email, msg);
        erros.push({ el: fc.elements.email, msg });
      }
      if (erros.length) { mostrarErros(fc, erros); return; }
      const agora = new Date().toISOString();
      const novo = {
        nome: fc.elements.nome.value.trim(), email,
        ...(await criarCredencial(fc.elements.senha.value)),
        criadoEm: agora,
        consentimento: { aceito: true, data: agora, finalidade: 'simulação de compra' }
      };
      Store.set('users', [...usuarios(), novo]);
      Sessao.entrar(novo);
      rotear();
      toast(`Conta criada! Bem-vindo(a), ${primeiroNome(novo.nome)}.`);
    });
  };
  return { titulo: 'Minha conta', html, depois };
}

function viewContaLogada(u) {
  const pedidos = pedidosDe(u.email).slice().reverse();
  const registro = usuarios().find(x => x.email === u.email);
  const dataBR = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const html = `
  <div class="page-head"><div class="container">
    <h1>Olá, ${esc(primeiroNome(u.nome))}</h1>
    <p>Gerencie seus dados e acompanhe seus pedidos de demonstração.</p>
  </div></div>
  <div class="container"><div class="conta-grid dois">
    <section class="card-form" aria-labelledby="meus-dados">
      <h2 id="meus-dados">Meus dados</h2>
      <dl class="ficha" style="display:grid;gap:.25rem">
        <div><dt class="hint">Nome</dt><dd style="margin:0 0 .75rem;font-weight:600">${esc(u.nome)}</dd></div>
        <div><dt class="hint">E-mail</dt><dd style="margin:0 0 .75rem;font-weight:600">${esc(u.email)}</dd></div>
        ${registro ? `<div><dt class="hint">Consentimento registrado em</dt><dd style="margin:0;font-weight:600">${dataBR(registro.consentimento.data)}</dd></div>` : ''}
      </dl>
      <div class="notice">
        <h3 style="font-family:var(--font-body);font-size:1rem">Seus direitos (LGPD, art. 18)</h3>
        <p>Você pode baixar uma cópia dos seus dados (acesso e portabilidade) ou excluir sua conta e tudo o que foi guardado (eliminação).</p>
      </div>
      <div class="acoes-conta">
        <button type="button" class="btn btn-outline" id="baixar-dados">Baixar meus dados</button>
        <button type="button" class="btn btn-danger" id="excluir-conta">Excluir minha conta e dados</button>
        <button type="button" class="btn btn-outline" id="sair">Sair</button>
      </div>
    </section>

    <section class="card-form" aria-labelledby="meus-pedidos">
      <h2 id="meus-pedidos">Meus pedidos</h2>
      ${pedidos.length === 0 ? '<p>Você ainda não fez pedidos. <a href="#/colecao">Explore a coleção</a>.</p>' :
        pedidos.map(p => `<article class="pedido">
          <header><a href="#/pedido/${esc(p.id)}">${esc(p.id)}</a><span>${moeda(p.totais.total)}</span></header>
          <p>${dataBR(p.data)} · ${p.itens.reduce((s, i) => s + i.qtd, 0)} item(ns) · ${esc(p.pagamento)}</p>
        </article>`).join('')}
    </section>
  </div></div>`;

  const depois = (main) => {
    $('#sair', main).addEventListener('click', () => { Sessao.sair(); rotear(); toast('Você saiu da sua conta.'); });
    $('#baixar-dados', main).addEventListener('click', () => {
      const dados = {
        exportadoEm: new Date().toISOString(),
        perfil: registro ? { nome: registro.nome, email: registro.email, criadoEm: registro.criadoEm, consentimento: registro.consentimento } : { nome: u.nome, email: u.email },
        pedidos: pedidosDe(u.email),
        newsletter: Store.get('newsletter', []).filter(n => n.email === u.email),
        preferenciasDeCookies: Consentimento.ler()
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'meus-dados-alquim.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Download dos seus dados iniciado.');
    });
    $('#excluir-conta', main).addEventListener('click', async () => {
      const ok = await confirmar({
        titulo: 'Excluir conta e dados?',
        texto: 'Isto apagará sua conta, seus pedidos e sua inscrição na newsletter deste navegador. Não é possível desfazer.',
        rotulo: 'Sim, excluir tudo'
      });
      if (!ok) return;
      Store.set('users', usuarios().filter(x => x.email !== u.email));
      Store.set('orders', Store.get('orders', []).filter(p => p.cliente.email !== u.email));
      Store.set('newsletter', Store.get('newsletter', []).filter(n => n.email !== u.email));
      Store.set('solicitacoes', Store.get('solicitacoes', []).filter(x => x.email !== u.email));
      Sessao.sair();
      location.hash = '#/';
      toast('Sua conta e seus dados foram excluídos.');
    });
  };
  return { titulo: 'Minha conta', html, depois };
}

/* ----------------------------- 7.8 POLÍTICA DE PRIVACIDADE E TERMOS ----------------------------- */
function viewPrivacidade() {
  const html = `
  <div class="page-head"><div class="container narrow">
    <h1>Política de Privacidade</h1>
    <p class="meta">Última atualização: 5 de novembro de 2026 · Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</p>
  </div></div>
  <div class="container narrow prose">
    <div class="notice"><p><strong>Resumo em uma frase:</strong> a Alquim é uma loja <em>fictícia</em> feita para um trabalho acadêmico; tudo o que você digita fica somente no seu navegador e é usado exclusivamente para simular uma compra.</p>
    <p><strong>Aviso:</strong> este texto é um modelo educacional. Em um site real, a conformidade com a LGPD deve ser validada por profissional jurídico conforme o contexto do negócio.</p></div>

    <h2>1. Quem somos (controlador)</h2>
    <p>A Alquim é um projeto acadêmico de e-commerce, desenvolvido por <strong>[Seu nome]</strong> como trabalho de <strong>[curso / instituição]</strong>. Não há empresa, venda real, cobrança ou entrega. Contato sobre privacidade (fictício): <a href="mailto:privacidade@alquim.example">privacidade@alquim.example</a>.</p>

    <h2>2. Quais dados tratamos</h2>
    <ul>
      <li><strong>Cadastro:</strong> nome, e-mail e senha (guardada apenas como código criptográfico, nunca em texto puro).</li>
      <li><strong>Newsletter:</strong> e-mail.</li>
      <li><strong>Simulação de compra (checkout):</strong> nome, e-mail, endereço de entrega e forma de pagamento escolhida.</li>
      <li><strong>Navegação:</strong> itens do carrinho, sessão de login e sua escolha sobre cookies.</li>
    </ul>
    <p><strong>Não coletamos</strong> CPF, número de cartão, dados bancários, dados sensíveis nem dados de crianças e adolescentes. Seguimos o princípio da <em>minimização</em> (art. 6º, III).</p>

    <h3>Inventário de dados: o que, por quê, onde e com quem</h3>
    <table>
      <thead><tr><th>Dado</th><th>Quando coletamos</th><th>Finalidade</th><th>Base legal</th><th>Onde fica</th><th>Compartilhado com</th><th>Retenção</th></tr></thead>
      <tbody>
        <tr><td>Nome, e-mail, senha (hash)</td><td>Cadastro</td><td>Criar a conta de demonstração</td><td>Consentimento (art. 7º, I)</td><td>localStorage do navegador</td><td>Ninguém</td><td>Até excluir a conta</td></tr>
        <tr><td>E-mail</td><td>Newsletter</td><td>Simular o envio de novidades</td><td>Consentimento</td><td>localStorage</td><td>Ninguém</td><td>Até excluir/limpar</td></tr>
        <tr><td>Nome, e-mail, endereço, forma de pagamento</td><td>Checkout</td><td>Registrar o pedido fictício</td><td>Consentimento</td><td>localStorage</td><td>Ninguém</td><td>Até excluir/limpar</td></tr>
        <tr><td>Nome, e-mail, tipo do pedido</td><td>Canal do titular</td><td>Atender direitos da LGPD</td><td>Consentimento / obrigação legal</td><td>localStorage</td><td>Ninguém</td><td>Até excluir/limpar</td></tr>
        <tr><td>Itens do carrinho, sessão</td><td>Navegação</td><td>Funcionamento da loja</td><td>Execução do serviço (necessários)</td><td>localStorage</td><td>Ninguém</td><td>Até excluir/limpar</td></tr>
        <tr><td>Tamanho do texto e contraste</td><td>Barra de acessibilidade</td><td>Lembrar sua preferência</td><td>Consentimento (cookie “Preferências”)</td><td>localStorage</td><td>Ninguém</td><td>Até revogar</td></tr>
        <tr><td>Contagens anônimas e Web Vitals</td><td>Navegação</td><td>Medir uso e desempenho</td><td>Consentimento (cookie “Estatísticas”)</td><td>localStorage</td><td>Ninguém</td><td>Até revogar (apagadas na hora)</td></tr>
      </tbody>
    </table>

    <h2>3. Para que usamos seus dados (finalidade) e base legal</h2>
    <p>Usamos os dados <strong>estritamente para fins da simulação de compra</strong>: manter o carrinho, criar sua conta de demonstração, registrar pedidos fictícios e (se você pedir) mostrar novidades. A base legal é o <strong>seu consentimento</strong> (art. 7º, I), que você manifesta marcando a caixa específica em cada formulário. Itens estritamente necessários ao funcionamento (carrinho, sessão) não dependem de consentimento.</p>

    <h2>4. Onde os dados ficam e com quem são compartilhados</h2>
    <p>Todos os dados ficam <strong>somente no armazenamento local (localStorage) do seu navegador</strong>. Não há servidor, banco de dados, rastreadores ou serviços de terceiros, e por isso <strong>não há compartilhamento nem transferência internacional</strong> de dados. Se você limpar os dados do navegador, tudo será apagado.</p>

    <h2>5. Cookies e armazenamento local</h2>
    <table>
      <thead><tr><th>Categoria</th><th>Finalidade</th><th>Pode recusar?</th></tr></thead>
      <tbody>
        <tr><td>Estritamente necessários</td><td>Carrinho, sessão, pedidos e registro da sua escolha de cookies</td><td>Não (o site não funciona sem eles)</td></tr>
        <tr><td>Preferências</td><td>Lembrar o tamanho do texto e o alto contraste escolhidos na barra de acessibilidade</td><td>Sim</td></tr>
        <tr><td>Estatísticas</td><td>Contagens anônimas de páginas e ações, medição de desempenho (Core Web Vitals) e registro de erros; visíveis no <a href="#/metricas">Painel de métricas</a>. Nada sai do seu navegador.</td><td>Sim</td></tr>
        <tr><td>Marketing</td><td>Ofertas personalizadas (não ativo nesta simulação)</td><td>Sim</td></tr>
      </tbody>
    </table>
    <p>Você pode alterar sua escolha a qualquer momento em <em>Preferências de cookies</em>, no rodapé do site.</p>

    <h2>6. Seus direitos (art. 18 da LGPD)</h2>
    <p>Você pode, a qualquer momento: confirmar o tratamento; acessar seus dados; corrigi-los; pedir anonimização, bloqueio ou eliminação; solicitar portabilidade; saber com quem os dados foram compartilhados (com ninguém); e <strong>revogar o consentimento</strong>.</p>
    <p>Como exercer: na página <a href="#/conta">Minha conta</a> você pode <strong>baixar seus dados</strong> e <strong>excluir sua conta e todos os dados</strong> com um clique. Você também pode registrar qualquer pedido no <a href="#/titular">Canal do titular</a> (protocolo e resposta em até 15 dias) ou escrever para o e-mail de contato acima.</p>

    <h2>7. Por quanto tempo guardamos</h2>
    <p>Enquanto você não excluir sua conta ou limpar os dados do navegador. Não há cópia em nenhum outro local.</p>

    <h2>8. Segurança</h2>
    <p>Senhas são armazenadas apenas como hash com “sal” e nenhum dado de pagamento é solicitado. <strong>Importante:</strong> por ser uma demonstração, use somente dados fictícios e uma senha que você não usa em nenhum outro lugar.</p>

    <h2>9. Alterações nesta política</h2>
    <p>Esta política pode ser atualizada; a data de revisão aparece no topo desta página.</p>
    <p><a href="#/termos">Leia também os Termos de Uso</a>.</p>
  </div>`;
  return { titulo: 'Política de Privacidade', html };
}

function viewTermos() {
  const html = `
  <div class="page-head"><div class="container narrow">
    <h1>Termos de Uso</h1>
    <p class="meta">Última atualização: 5 de novembro de 2026</p>
  </div></div>
  <div class="container narrow prose">
    <h2>1. Aceitação</h2>
    <p>Ao navegar pelo site da Alquim você concorda com estes Termos. Se não concordar, pedimos que não utilize o site.</p>

    <h2>2. Natureza do projeto</h2>
    <p>A Alquim é uma <strong>loja fictícia</strong>, criada como trabalho acadêmico de front-end. Produtos, preços, prazos, cupons, garantias e políticas de troca são ilustrativos. <strong>Nenhuma venda, pagamento ou entrega é realizada.</strong></p>

    <h2>3. Cadastro e conta</h2>
    <p>O cadastro é opcional e serve apenas para demonstrar o fluxo de compra. Recomendamos usar dados fictícios. Você é responsável por manter sua senha de demonstração em sigilo e pode excluir sua conta a qualquer momento em <a href="#/conta">Minha conta</a>.</p>

    <h2>4. Simulação de compra</h2>
    <p>Ao “confirmar o pedido”, o sistema apenas grava um registro no seu navegador. Os números de pedido (ex.: ALQ-123456) não correspondem a nenhuma transação real.</p>

    <h2>5. Propriedade intelectual</h2>
    <p>Imagens e textos são utilizados exclusivamente para fins educacionais, sem finalidade comercial. Marcas e nomes de cores eventualmente citados pertencem aos seus respectivos titulares.</p>

    <h2>6. Privacidade</h2>
    <p>O tratamento de dados está descrito na <a href="#/privacidade">Política de Privacidade</a>, que integra estes Termos.</p>

    <h2>7. Limitação de responsabilidade</h2>
    <p>O site é fornecido “como está”, para demonstração. Os autores não se responsabilizam por eventuais perdas decorrentes do uso do site como se fosse uma loja real.</p>

    <h2>8. Lei aplicável</h2>
    <p>Estes Termos são regidos pelas leis da República Federativa do Brasil.</p>
  </div>`;
  return { titulo: 'Termos de Uso', html };
}

/* ----------------------------- 7.9 CANAL DO TITULAR (LGPD, art. 18 e 19) -----------------------------
   Procedimento para atender os direitos dos titulares: formulário → protocolo → prazo de resposta (15 dias). */
const TIPOS_SOLICITACAO = [
  ['confirmacao', 'Confirmação de que vocês tratam meus dados'],
  ['acesso', 'Acesso aos meus dados'],
  ['correcao', 'Correção de dados incompletos ou desatualizados'],
  ['eliminacao', 'Anonimização, bloqueio ou eliminação de dados'],
  ['portabilidade', 'Portabilidade dos dados'],
  ['compartilhamento', 'Informação sobre compartilhamento de dados'],
  ['revogacao', 'Revogação do consentimento']
];
function viewTitular() {
  const html = `
  <div class="page-head"><div class="container narrow">
    <h1>Canal do titular de dados</h1>
    <p>Exerça os direitos previstos no art. 18 da LGPD. Registre seu pedido e receba um número de protocolo.</p>
  </div></div>
  <div class="container narrow prose">
    <div class="notice"><p><strong>Atalho:</strong> com a sessão iniciada, você pode <a href="#/conta">baixar seus dados ou excluir a conta</a> na hora. Use este formulário para os demais pedidos ou se não tiver conta.</p></div>
    <div id="titular-area">
      <form id="form-titular" novalidate>
        <div class="error-summary" role="alert" tabindex="-1" hidden></div>
        <p class="hint" style="margin-bottom:1rem">Campos marcados com <span class="req" aria-hidden="true">*</span><span class="sr-only">asterisco</span> são obrigatórios.</p>
        <div class="form-grid">
          ${campo({ id: 'ti-nome', name: 'nome', label: 'Nome completo', autocomplete: 'name' })}
          ${campo({ id: 'ti-email', name: 'email', label: 'E-mail para resposta', type: 'email', autocomplete: 'email' })}
          ${campoSelect({ id: 'ti-tipo', name: 'tipo', label: 'O que você deseja solicitar?', opcoes: TIPOS_SOLICITACAO })}
          ${campoTexto({ id: 'ti-detalhes', name: 'detalhes', label: 'Detalhes do pedido', hint: 'Não informe dados sensíveis neste campo.' })}
          <div class="consent-box">
            ${campoCheck({ id: 'ti-consent', name: 'consent', html: 'Declaro que sou o titular dos dados e <strong>consinto com o uso do meu nome e e-mail estritamente para atender a esta solicitação</strong> (simulação). Veja a <a href="#/privacidade" target="_blank" rel="noopener">Política de Privacidade<span class="sr-only"> (abre em nova aba)</span></a>.' })}
          </div>
          <button type="submit" class="btn">Enviar solicitação</button>
        </div>
      </form>
    </div>
    <h2>Como tratamos o seu pedido</h2>
    <ol>
      <li>Você envia o formulário e recebe na hora um <strong>número de protocolo</strong>.</li>
      <li>A resposta completa é dada em até <strong>15 dias</strong> (LGPD, art. 19, II).</li>
      <li>Podemos pedir informações adicionais para confirmar que você é mesmo o titular.</li>
    </ol>
    <p>Encarregado pelo tratamento de dados (fictício): <strong>[Seu nome]</strong> — <a href="mailto:privacidade@alquim.example">privacidade@alquim.example</a>.</p>
  </div>`;

  const depois = (main) => {
    const form = $('#form-titular', main);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const erros = validar(form, {
        nome: V.nome, email: V.email, tipo: V.obrig('Selecione o tipo de solicitação.'),
        consent: V.consent('Para enviar, marque a declaração e o consentimento.')
      });
      if (erros.length) { mostrarErros(form, erros); return; }
      const f = form.elements;
      const agora = new Date(), prazo = new Date(agora.getTime() + 15 * 24 * 3600 * 1000);
      const sol = {
        protocolo: 'TIT-' + (Math.floor(Math.random() * 900000) + 100000),
        tipo: f.tipo.value, nome: f.nome.value.trim(), email: f.email.value.trim().toLowerCase(),
        detalhes: f.detalhes.value.trim(), data: agora.toISOString(), prazo: prazo.toISOString(), status: 'Recebida (simulação)'
      };
      Store.set('solicitacoes', [...Store.get('solicitacoes', []), sol]);
      const rotulo = TIPOS_SOLICITACAO.find(t => t[0] === sol.tipo)[1];
      $('#titular-area', main).innerHTML = `
        <div class="notice" id="titular-ok" tabindex="-1" role="status">
          <h2 style="margin-top:0">Solicitação registrada</h2>
          <p>Protocolo: <strong>${sol.protocolo}</strong></p>
          <p>Tipo: ${esc(rotulo)}</p>
          <p>Resposta completa até <strong>${prazo.toLocaleDateString('pt-BR')}</strong> (15 dias, LGPD art. 19, II).</p>
          <p class="hint">Simulação: o pedido foi guardado apenas neste navegador.</p>
        </div>`;
      $('#titular-ok', main).focus();
    });
  };
  return { titulo: 'Canal do titular de dados', html, depois, descricao: 'Canal para exercer os direitos da LGPD: acesso, correção, eliminação, portabilidade e revogação do consentimento.' };
}

/* ----------------------------- 7.10 GUIA DE ESTILO (Design System) -----------------------------
   Documenta os padrões reutilizáveis: cores (com contraste calculado ao vivo), tipografia e componentes. */
function luminancia(hexCor) {
  const [r, g, b] = hexCor.replace('#', '').match(/.{2}/g).map(h => parseInt(h, 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function razaoContraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const nivelContraste = (r) => r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'só texto grande e ícones' : 'reprovado para texto';
const tokenCSS = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

function viewGuiaEstilo() {
  const cores = [
    ['--tiffany', 'Azul Tiffany', 'Cor de destaque: fundos, selos e botões'],
    ['--tiffany-100', 'Tiffany 100', 'Fundos suaves de seções'],
    ['--teal', 'Teal', 'Texto e links sobre fundo claro'],
    ['--teal-dark', 'Teal escuro', 'Hover de links'],
    ['--ink', 'Grafite', 'Texto principal e botões'],
    ['--muted', 'Cinza de apoio', 'Texto secundário'],
    ['--mist', 'Névoa', 'Fundos neutros'],
    ['--line', 'Linha', 'Bordas e divisores'],
    ['--danger', 'Erro', 'Mensagens de erro']
  ];
  const pares = [
    ['--teal', '--white', 'Links e texto de destaque sobre branco'],
    ['--ink', '--tiffany', 'Texto sobre o Azul Tiffany (botões, selos)'],
    ['--ink', '--white', 'Texto principal sobre branco'],
    ['--muted', '--white', 'Texto secundário sobre branco'],
    ['--white', '--ink', 'Texto branco sobre grafite (botões, rodapé)'],
    ['--danger', '--white', 'Mensagens de erro sobre branco'],
    ['--tiffany', '--white', 'Azul Tiffany sobre branco (por isso nunca usado como texto)']
  ];
  const html = `
  <div class="page-head"><div class="container narrow">
    <h1>Guia de estilo</h1>
    <p>Design System da Alquim: padrões reutilizáveis para manter a consistência visual e a acessibilidade.</p>
  </div></div>
  <div class="container narrow prose">
    <h2>1. Princípios</h2>
    <ul>
      <li><strong>Elegância com clareza:</strong> muito espaço em branco, tipografia serifada nos títulos e uma única cor de destaque.</li>
      <li><strong>Acessibilidade primeiro:</strong> contraste mínimo AA, foco sempre visível e alvos de toque de 44 px.</li>
      <li><strong>Mobile-first:</strong> começamos pelo celular e ampliamos em 600, 900 e 1200 px.</li>
    </ul>

    <h2>2. Cores</h2>
    <ul class="swatches">
      ${cores.map(([v, nome, uso]) => { const h = tokenCSS(v); return `<li><span class="swatch" style="background:${h}" aria-hidden="true"></span><strong>${nome}</strong><code>${h}</code><span class="hint">${uso}</span></li>`; }).join('')}
    </ul>

    <h2>3. Contraste (calculado ao vivo, WCAG 2.2)</h2>
    <table>
      <thead><tr><th>Texto</th><th>Fundo</th><th>Uso</th><th>Razão</th><th>Nível</th></tr></thead>
      <tbody>
        ${pares.map(([t, f, uso]) => { const r = razaoContraste(tokenCSS(t), tokenCSS(f)); return `<tr><td><code>${tokenCSS(t)}</code></td><td><code>${tokenCSS(f)}</code></td><td>${uso}</td><td>${r.toFixed(1)}:1</td><td>${nivelContraste(r)}</td></tr>`; }).join('')}
      </tbody>
    </table>
    <p class="hint">Mínimos da WCAG: 4,5:1 para texto normal, 3:1 para texto grande e componentes de interface.</p>

    <h2>4. Tipografia</h2>
    <p class="hint">Títulos: serifada do sistema (Cormorant Garamond/Georgia). Corpo: sans-serif do sistema (sem fontes externas, por performance e privacidade).</p>
    <p style="font-family:var(--font-display);font-size:2.25rem;font-weight:600;line-height:1.15;margin:0 0 .5rem">Título 1 — O azul que transforma</p>
    <p style="font-family:var(--font-display);font-size:1.75rem;font-weight:600;margin:0 0 .5rem">Título 2 — Compre por categoria</p>
    <p style="font-family:var(--font-display);font-size:1.35rem;font-weight:600;margin:0 0 .5rem">Título 3 — Nome do produto</p>
    <p>Texto de corpo (1 rem, altura de linha 1,6): peças artesanais com cristais em azul-turquesa.</p>

    <h2>5. Botões</h2>
    <p class="estilo-linha">
      <button type="button" class="btn">Primário</button>
      <button type="button" class="btn btn-outline">Secundário</button>
      <button type="button" class="btn btn-tiffany">Destaque</button>
      <button type="button" class="btn btn-danger">Perigo</button>
      <button type="button" class="btn" disabled>Desabilitado</button>
    </p>

    <h2>6. Formulários e estados</h2>
    <div class="form-grid" style="max-width:420px">
      ${campo({ id: 'g-normal', name: 'g1', label: 'Campo normal', hint: 'Dica de preenchimento.' })}
      <div class="field has-error">
        <label for="g-erro">Campo com erro<span class="req" aria-hidden="true"> *</span></label>
        <input id="g-erro" type="email" value="maria@" aria-invalid="true" aria-describedby="g-erro-err">
        <p class="field-error" id="g-erro-err">Informe um e-mail válido, como nome@exemplo.com.</p>
      </div>
      ${campoCheck({ id: 'g-check', name: 'g3', html: 'Caixa de consentimento (LGPD)' })}
    </div>

    <h2>7. Mensagens</h2>
    <div class="notice"><p><strong>Aviso informativo:</strong> usado para dicas e explicações.</p></div>
    <div class="error-summary" style="margin-top:1rem"><h3 class="error-title">Corrija 2 campos para continuar:</h3><ul><li><a href="#/guia-de-estilo">Informe seu e-mail.</a></li><li><a href="#/guia-de-estilo">Marque a caixa de consentimento.</a></li></ul></div>

    <h2>8. Card de produto</h2>
    <div style="max-width:260px">${cardProduto(PRODUTOS.find(p => p.id === 'colar3'))}</div>

    <h2>9. Pontos de quebra (responsividade)</h2>
    <table>
      <thead><tr><th>Largura</th><th>Dispositivo</th><th>Mudanças principais</th></tr></thead>
      <tbody>
        <tr><td>até 599 px</td><td>Celular</td><td>2 colunas de produtos, menu hambúrguer</td></tr>
        <tr><td>600 a 899 px</td><td>Tablet</td><td>3 colunas de produtos, formulários em 2 colunas</td></tr>
        <tr><td>900 a 1199 px</td><td>Notebook</td><td>Menu horizontal, 4 colunas, resumo do pedido fixo</td></tr>
        <tr><td>1200 px ou mais</td><td>Desktop</td><td>Largura máxima do conteúdo de 1200 px</td></tr>
      </tbody>
    </table>
  </div>`;
  return { titulo: 'Guia de estilo', html, descricao: 'Design System da Alquim: cores com contraste calculado, tipografia, botões, formulários e componentes.' };
}

/* ----------------------------- 7.11 MAPA DO SITE (arquitetura da informação / eMAG) ----------------------------- */
function viewMapa() {
  const html = `
  <div class="page-head"><div class="container narrow">
    <h1>Mapa do site</h1>
    <p>Todas as páginas da Alquim organizadas por assunto.</p>
  </div></div>
  <div class="container narrow prose">
    <nav aria-label="Mapa do site">
      <ul>
        <li><a href="#/">Início</a></li>
        <li><a href="#/colecao">Coleção Tiffany Blue</a>
          <ul>
            ${CATEGORIAS.map(c => `<li><a href="#/colecao?cat=${c.slug}">${c.nome}</a>
              <ul>${PRODUTOS.filter(p => p.categoria === c.slug).map(p => `<li><a href="#/produto/${p.id}">${esc(p.nome)}</a></li>`).join('')}</ul></li>`).join('')}
          </ul>
        </li>
        <li>Compra
          <ul><li><a href="#/carrinho">Carrinho</a></li><li><a href="#/checkout">Finalizar compra</a></li></ul>
        </li>
        <li>Minha conta
          <ul><li><a href="#/conta">Entrar, cadastrar, meus dados e pedidos</a></li></ul>
        </li>
        <li>Privacidade e legal
          <ul>
            <li><a href="#/privacidade">Política de Privacidade</a></li>
            <li><a href="#/termos">Termos de Uso</a></li>
            <li><a href="#/titular">Canal do titular de dados (LGPD)</a></li>
          </ul>
        </li>
        <li>Documentação do projeto
          <ul><li><a href="#/guia-de-estilo">Guia de estilo (Design System)</a></li><li><a href="#/metricas">Painel de métricas</a></li></ul>
        </li>
      </ul>
    </nav>
  </div>`;
  return { titulo: 'Mapa do site', html, descricao: 'Mapa do site da Alquim: coleção, categorias, produtos, conta, privacidade e documentação.' };
}

/* ----------------------------- 7.12 PAINEL DE MÉTRICAS (analytics com consentimento) ----------------------------- */
function viewMetricas() {
  const ativa = Metricas.ativa();
  const m = Metricas.ler();
  const ev = (k) => m.eventos[k] || 0;
  const aviso = ativa ? '' : `
    <div class="notice"><p><strong>As métricas estão desligadas.</strong> Elas só são coletadas se você autorizar a categoria “Estatísticas” nos cookies (LGPD).</p>
      <p><button type="button" class="btn btn-small" id="abrir-prefs-metricas">Gerenciar preferências de cookies</button></p></div>`;

  const etapas = [['Peças visualizadas', 'ver_produto'], ['Adicionadas ao carrinho', 'add_carrinho'], ['Checkout iniciado', 'inicio_checkout'], ['Compras concluídas (simuladas)', 'compra']];
  const base = ev('ver_produto');
  const funil = etapas.map(([rotulo, k], i) => {
    const n = ev(k), ant = i ? ev(etapas[i - 1][1]) : 0;
    const larg = base ? Math.min(100, Math.round(n / base * 100)) : 0;
    return `<tr><th scope="row">${rotulo}</th><td>${n}</td><td>${i === 0 ? '—' : (ant ? Math.round(n / ant * 100) + '%' : '—')}</td><td><span class="barra" aria-hidden="true"><span style="width:${larg}%"></span></span></td></tr>`;
  }).join('');

  const faixas = { LCP: [2500, 4000, 'ms'], CLS: [0.1, 0.25, ''], INP: [200, 500, 'ms'] };
  const descVital = { LCP: 'Maior elemento visível carregado', CLS: 'Estabilidade visual (saltos de layout)', INP: 'Resposta às interações (aproximado)' };
  const vitais = Object.entries(faixas).map(([nome, [bom, medio, un]]) => {
    const v = m.vitais[nome];
    const estado = v === undefined ? '—' : (v <= bom ? 'Bom' : v <= medio ? 'Precisa melhorar' : 'Ruim');
    return `<tr><th scope="row">${nome}</th><td>${descVital[nome]}</td><td>${v === undefined ? '—' : v + (un ? ' ' + un : '')}</td><td>${estado}</td></tr>`;
  }).join('');

  const paginas = Object.entries(m.paginas).sort((a, b) => b[1] - a[1]);
  const produtos = Object.entries(m.produtos).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const log = Store.get('log', []);
  const html = `
  <div class="page-head"><div class="container narrow">
    <h1>Painel de métricas</h1>
    <p>Demonstração de analytics com privacidade: dados anônimos, agregados e guardados só neste navegador.</p>
  </div></div>
  <div class="container narrow prose">
    ${aviso}
    ${ativa ? `<p class="meta">Coletando desde ${new Date(m.desde).toLocaleString('pt-BR')} · ${paginas.reduce((s, [, n]) => s + n, 0)} visualizações de página.</p>
    <h2>Funil de compra</h2>
    <table>
      <thead><tr><th>Etapa</th><th>Quantidade</th><th>% da etapa anterior</th><th>Proporção</th></tr></thead>
      <tbody>${funil}</tbody>
    </table>
    <p class="hint">As adições feitas direto nos cards da vitrine contam como “adicionadas”, mesmo sem visitar a página do produto.</p>

    <h2>Core Web Vitals (desta sessão)</h2>
    <table>
      <thead><tr><th>Métrica</th><th>O que mede</th><th>Valor</th><th>Avaliação</th></tr></thead>
      <tbody>${vitais}</tbody>
    </table>
    <p class="hint">Referências do web.dev: LCP bom até 2,5 s; CLS bom até 0,1; INP bom até 200 ms.</p>

    <h2>Páginas mais vistas</h2>
    ${paginas.length ? `<table><thead><tr><th>Página</th><th>Visualizações</th></tr></thead><tbody>${paginas.map(([p, n]) => `<tr><td>${esc(p)}</td><td>${n}</td></tr>`).join('')}</tbody></table>` : '<p>Ainda sem dados. Navegue pelo site e volte aqui.</p>'}

    <h2>Peças mais vistas</h2>
    ${produtos.length ? `<ol>${produtos.map(([id, n]) => `<li>${produtoPorId(id) ? esc(produtoPorId(id).nome) : esc(id)} — ${n}</li>`).join('')}</ol>` : '<p>Ainda sem dados.</p>'}

    <h2>Monitoramento de erros</h2>
    ${log.length ? `<ul>${log.map(l => `<li><code>${esc(l.origem)}</code> — ${esc(l.msg)} <span class="hint">(${new Date(l.quando).toLocaleString('pt-BR')})</span></li>`).join('')}</ul>` : '<p>Nenhum erro registrado.</p>'}

    <p><button type="button" class="btn btn-outline" id="zerar-metricas">Apagar todas as métricas</button></p>` : ''}
  </div>`;

  const depois = (main) => {
    const abrir = $('#abrir-prefs-metricas', main); if (abrir) abrir.addEventListener('click', abrirPreferencias);
    const zerar = $('#zerar-metricas', main);
    if (zerar) zerar.addEventListener('click', () => { Metricas.zerar(); rotear(); toast('Métricas apagadas.'); });
  };
  return { titulo: 'Painel de métricas', html, depois };
}

/* ----------------------------- 7.9 PÁGINA NÃO ENCONTRADA ----------------------------- */
function view404() {
  return {
    titulo: 'Página não encontrada',
    html: `<div class="container vazio section">
      <svg class="icon" aria-hidden="true"><use href="#i-gem"/></svg>
      <h1>Página não encontrada</h1>
      <p>O endereço que você acessou não existe ou foi removido.</p>
      <a class="btn" href="#/">Voltar ao início</a>
    </div>`
  };
}

/* =========================================================================
   8. ROTEADOR (baseado em hash) E INICIALIZAÇÃO
   Rotas: #/ · #/colecao?cat=aneis · #/produto/anel1 · #/carrinho · #/checkout · #/pedido/ALQ-123456
          #/conta · #/privacidade · #/termos
   ========================================================================= */
const ROTAS = {
  '': viewHome, colecao: viewColecao, produto: viewProduto, carrinho: viewCarrinho,
  checkout: viewCheckout, pedido: viewPedido, conta: viewConta, privacidade: viewPrivacidade, termos: viewTermos,
  titular: viewTitular, 'guia-de-estilo': viewGuiaEstilo, 'mapa-do-site': viewMapa, metricas: viewMetricas
};
const SEM_INDEXACAO = ['carrinho', 'checkout', 'pedido', 'conta', 'metricas'];   // páginas privadas ou sem valor para buscadores
const DESCRICAO_PADRAO = 'Alquim: joias artesanais e finas. Conheça a coleção Tiffany Blue com anéis, brincos, colares, pulseiras e relógios. Projeto acadêmico de e-commerce.';

/* SEO: título, descrição, Open Graph, robots e dados estruturados (schema.org) de cada "página" da SPA */
function atualizarSEO(view, rota) {
  const desc = view.descricao || DESCRICAO_PADRAO;
  $('meta[name="description"]').setAttribute('content', desc);
  $('meta[property="og:title"]').setAttribute('content', document.title);
  $('meta[property="og:description"]').setAttribute('content', desc);
  $('meta[name="robots"]').setAttribute('content', SEM_INDEXACAO.includes(rota) ? 'noindex, nofollow' : 'index, follow');
  const antigo = $('#ld-pagina'); if (antigo) antigo.remove();
  if (view.jsonld) {
    const sc = document.createElement('script');
    sc.type = 'application/ld+json'; sc.id = 'ld-pagina'; sc.textContent = JSON.stringify(view.jsonld);
    document.head.appendChild(sc);
  }
}
let primeiraRenderizacao = true;

/* Tabelas largas ficam dentro de um contêiner rolável. Só quando realmente há rolagem, o contêiner vira
   uma região com nome e entra na ordem do Tab, para que usuários de teclado consigam rolar (WCAG 2.1.1). */
function envolverTabelas(raiz) {
  $$('table', raiz).forEach(t => {
    if (t.parentElement.classList.contains('tabela-scroll')) return;
    const titulo = (t.previousElementSibling && /^H[2-4]$/.test(t.previousElementSibling.tagName)) ? t.previousElementSibling.textContent : 'Tabela';
    const w = document.createElement('div');
    w.className = 'tabela-scroll'; w.dataset.rotulo = `${titulo.trim()} (tabela com rolagem)`;
    t.parentNode.insertBefore(w, t); w.appendChild(t);
  });
  ajustarTabelas();
}
function ajustarTabelas() {
  $$('.tabela-scroll').forEach(w => {
    if (w.scrollWidth > w.clientWidth + 1) { w.tabIndex = 0; w.setAttribute('role', 'region'); w.setAttribute('aria-label', w.dataset.rotulo); }
    else { w.removeAttribute('tabindex'); w.removeAttribute('role'); w.removeAttribute('aria-label'); }
  });
}
window.addEventListener('resize', ajustarTabelas);

/* Marca o link do menu da página atual com aria-current="page" */
function marcarNavAtiva(categoria) {
  $$('#menu-principal a').forEach(a => {
    if (categoria && a.dataset.nav === categoria) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}
function fecharMenu() {
  $('#menu-principal').classList.remove('is-open');
  $('#nav-toggle').setAttribute('aria-expanded', 'false');
}

function rotear() {
  const hash = location.hash;
  if (hash && !hash.startsWith('#/')) return;            // âncoras comuns (ex.: #conteudo) não são rotas
  const [caminho, consulta = ''] = hash.slice(1).split('?');
  const partes = caminho.split('/').filter(Boolean);
  const params = new URLSearchParams(consulta);
  const decodificar = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  const view = (ROTAS[partes[0] || ''] || view404)(partes.slice(1).map(decodificar), params);

  if (view.redirecionar) { history.replaceState(null, '', view.redirecionar); return rotear(); }

  const main = $('#conteudo');
  main.innerHTML = view.html;
  main.removeAttribute('data-carregando');   // libera a altura reservada (ver style.css)
  envolverTabelas(main);
  document.title = `${view.titulo} — Alquim`;
  atualizarSEO(view, partes[0] || 'home');
  // Analytics (só registra com consentimento de "Estatísticas")
  Metricas.pagina(partes[0] || 'home');
  if (partes[0] === 'produto' && produtoPorId(partes[1])) Metricas.evento('ver_produto', partes[1]);
  if (partes[0] === 'checkout') Metricas.evento('inicio_checkout');
  fecharMenu();
  marcarNavAtiva(partes[0] === 'colecao' ? view.categoriaNav : null);
  window.scrollTo(0, 0);
  if (view.depois) view.depois(main);

  // Acessibilidade: ao trocar de página, move o foco para o título (h1) para o leitor de tela anunciar a nova página.
  // Na primeira carga não movemos o foco, para não "roubar" o foco do banner de cookies.
  if (!primeiraRenderizacao) {
    const h1 = $('h1', main);
    if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); } else main.focus({ preventScroll: true });
  }
  primeiraRenderizacao = false;
}

function iniciar() {
  atualizarCabecalho();
  iniciarCookies();

  // Menu móvel (botão hambúrguer)
  const botaoMenu = $('#nav-toggle'), nav = $('#menu-principal');
  botaoMenu.addEventListener('click', () => {
    const aberto = nav.classList.toggle('is-open');
    botaoMenu.setAttribute('aria-expanded', String(aberto));
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) fecharMenu(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { fecharMenu(); botaoMenu.focus(); }
  });

  // Barra de acessibilidade (padrão eMAG): tamanho do texto e alto contraste
  Visual.carregar();
  $('#fonte-menos').addEventListener('click', () => Visual.ajustarFonte(-1));
  $('#fonte-normal').addEventListener('click', () => Visual.ajustarFonte(0));
  $('#fonte-mais').addEventListener('click', () => Visual.ajustarFonte(1));
  $('#btn-contraste').addEventListener('click', () => Visual.alternarContraste());

  // Busca interna (arquitetura da informação): painel abaixo do cabeçalho que leva à vitrine filtrada
  const botaoBusca = $('#busca-toggle'), painelBusca = $('#busca-painel'), campoBusca = $('#busca-q');
  const abrirBusca = (sim) => {
    painelBusca.hidden = !sim;
    botaoBusca.setAttribute('aria-expanded', String(sim));
    if (sim) campoBusca.focus();
  };
  botaoBusca.addEventListener('click', () => abrirBusca(painelBusca.hidden));
  painelBusca.addEventListener('keydown', (e) => { if (e.key === 'Escape') { abrirBusca(false); botaoBusca.focus(); } });
  $('#form-busca').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = campoBusca.value.trim();
    Metricas.evento('busca');
    abrirBusca(false);
    location.hash = '#/colecao' + (q ? '?q=' + encodeURIComponent(q) : '');
  });

  // Atalhos "Pular para…" — precisam tratar o clique porque o hash é usado pelo roteador
  const destinos = {
    conteudo: () => $('#conteudo'),
    menu: () => (nav.offsetParent !== null ? $('a', nav) : botaoMenu),
    busca: () => { abrirBusca(true); return campoBusca; },
    rodape: () => $('#rodape')
  };
  $$('.skip-links a').forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    const alvo = destinos[a.dataset.alvo]();
    if (alvo) alvo.focus();
  }));

  // Botões "Adicionar" dos cards (Home, Vitrine, Relacionados): um único ouvinte delegado
  $('#conteudo').addEventListener('click', (e) => {
    const botao = e.target.closest('button[data-add]');
    if (!botao) return;
    const p = produtoPorId(botao.dataset.add);
    Carrinho.adicionar(p.id, '', 1);
    feedbackAdicionado(botao);
    toast(`${p.nome} foi adicionado ao carrinho.`, { href: '#/carrinho', rotulo: 'Ver carrinho' });
  });

  window.addEventListener('hashchange', rotear);
  rotear();
}
iniciar();
