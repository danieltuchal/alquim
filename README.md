# Alquim — E-commerce de joias (Projeto Final)

Loja virtual fictícia de joias finas, com a coleção em destaque **Tiffany Blue**.
Feita com **HTML5, CSS3 e JavaScript puros** (sem frameworks, sem servidor, sem bibliotecas no navegador).

> **Aviso:** projeto acadêmico. Nenhuma compra, pagamento ou entrega é real.

**Disciplina:** Desenvolvimento de Sites Profissionais · **Tema:** livre (e-commerce) · **Apresentação/defesa:** final de novembro
**Grupo:** preencha a tabela da seção 7.

---

## 1. Como abrir, testar e publicar

| Quero… | Faça |
|---|---|
| Ver o site | Dois cliques em `index.html` (funciona sem servidor). |
| Ver no celular | Publique a pasta no Netlify (`app.netlify.com/drop`, arrastando a pasta) e abra o link. |
| Rodar os testes automáticos | `npm install` → `npx playwright install chromium` → `npm test` (98 verificações) |
| Rodar só um grupo de testes | `npm run test:e2e` · `test:seguranca` · `test:responsivo` · `test:a11y` |
| Recomeçar a demonstração do zero | F12 → *Application* → *Local Storage* → apague as chaves `alquim:*` e recarregue. |
| Gerar de novo as imagens WebP | `pip install pillow` → `python3 tools/gerar-webp.py` |

## 2. Estrutura de arquivos

```
alquim/
├── index.html           Esqueleto: landmarks, CSP, SEO, banner de cookies, barra de acessibilidade, rodapé
├── style.css            Visual mobile-first, organizado em seções numeradas (inclui alto contraste)
├── produtos.js          Dados do catálogo (18 produtos, textos alternativos das fotos)
├── script.js            Toda a lógica, em seções numeradas (rotas, carrinho, LGPD, métricas, páginas)
├── img/ e img/webp/     Fotos em JPG e versões WebP de 480 e 960 px (srcset)
├── tests/               Testes automáticos: e2e, segurança, responsividade, acessibilidade (axe)
├── tools/gerar-webp.py  Gera as imagens WebP a partir do produtos.js
├── docs/PLANEJAMENTO-UX.md   Personas, jornada, arquitetura da informação, roteiro de teste de usabilidade
├── _headers             Cabeçalhos de segurança/cache para produção (Netlify)
├── robots.txt           SEO
├── .github/workflows/testes.yml   CI: roda os testes a cada push no GitHub
└── package.json · .gitignore
```

**Como funciona:** SPA simples. O `index.html` tem só o esqueleto; o `script.js` desenha cada página dentro do `<main>` conforme o endereço (`#/colecao`, `#/produto/anel1`, `#/carrinho`…). Evita recarregar a página e permite usar o botão "voltar".

## 3. Checklist do professor (slide 20) → o que foi feito e como provar

| Item do checklist | O que foi feito | Onde está | Como comprovar |
|---|---|---|---|
| **Requisitos e objetivos definidos** | Objetivo, metas mensuráveis, personas e jornada documentados | `docs/PLANEJAMENTO-UX.md` §1–3 | Abrir o documento |
| **HTML/CSS/JS e arquitetura adequados** | HTML semântico, CSS por tokens e seções, JS em módulos de seção, dados separados da lógica | Cabeçalhos numerados em `style.css` e `script.js` | Ler o sumário no topo de cada arquivo |
| **UX/UI e arquitetura da informação** | Menu por categoria, busca no cabeçalho, filtros, breadcrumbs, mapa do site, guia de estilo (design system) | `#/mapa-do-site`, `#/guia-de-estilo`, `docs/PLANEJAMENTO-UX.md` §4–5 | Navegar pelas páginas; conferir a árvore do site no documento |
| **Responsividade e compatibilidade** | Mobile-first; layout testado em 7 telas (360 a 1920 px, retrato e paisagem), sem rolagem horizontal, alvos de toque ≥ 40 px, texto ampliado a 150%, banner de cookies que não cobre a tela em paisagem | `style.css` §13, `tests/responsivo.js` | `npm run test:responsivo` (30 verificações) |
| **Acessibilidade** | WCAG 2.2 e boas práticas do eMAG: barra de acessibilidade (A−/A/A+ e **alto contraste**), "pular para…", foco visível, `alt` descritivo, formulários com resumo de erros, mapa do site | `index.html` (barra), `style.css` §3 e §17, `script.js` §5 | `npm run test:a11y`: axe-core sem violações em 14 páginas nos 2 temas. Lighthouse: 100 |
| **LGPD, privacidade e cookies** | Banner com 3 opções; preferências por categoria que **valem de verdade** (sem aceitar "Preferências" ou "Estatísticas", nada é gravado); registro do consentimento com data; política com inventário de dados (o que, por quê, onde, com quem); termos; **Canal do titular** (protocolo e prazo de 15 dias); baixar e excluir dados; checkbox de consentimento específico em cada formulário; sem CPF nem dados de cartão (minimização) | `script.js` §3, páginas `#/privacidade`, `#/termos`, `#/titular`, `#/conta` | `npm run test:e2e` (bloco "LGPD") |
| **Segurança** | CSP (só scripts do próprio site), proteção contra XSS (todo texto digitado é escapado), senha com **PBKDF2-SHA256 (150 mil iterações) e sal único**, bloqueio de login após 5 erros (30 s), nenhuma requisição a terceiros, `rel="noopener"`, `autocomplete` correto para gerenciadores de senha | `index.html` (CSP), `_headers`, `script.js` §2 | `npm run test:seguranca` (10 verificações, inclui injetar um script e ver a CSP bloquear) |
| **Performance** | Imagens WebP responsivas (`srcset`), imagem principal pré-carregada, dimensões reservadas, altura do `<main>` reservada enquanto o JS carrega (corrigiu um CLS de 0,7), sem fontes nem bibliotecas externas | `tools/gerar-webp.py`, `style.css`, `index.html` | Lighthouse (tabela da seção 4) |
| **SEO** | Título e descrição por página, `robots` por página (privadas = noindex), Open Graph, JSON-LD (`Store` na Home e `Product` em cada peça), um único `<h1>` por página, `robots.txt` | `index.html`, `script.js` §8 | `npm run test:e2e` (bloco "SEO"); Lighthouse SEO: 100 |
| **Testes e monitoramento** | 98 verificações automáticas + CI no GitHub. Monitoramento: painel de métricas com funil de compra e Core Web Vitals (LCP, CLS, INP) | `tests/`, `.github/workflows/testes.yml`, `#/metricas` | `npm test`; aceitar "Estatísticas" e navegar; abrir o painel |
| **Deploy, backup e manutenção** | Publicação gratuita com HTTPS (Netlify ou GitHub Pages); backup = repositório Git; manutenção simples (produtos em `produtos.js`, imagens por script) | Seção 1 e `_headers` | Abrir o link publicado |

### Outros temas dos slides

- **Analytics e métricas:** as métricas só funcionam se o visitante aceitar "Estatísticas" (consentimento antes da medição). São contadores anônimos, guardados só no navegador; ao revogar, são apagados (`script.js` §3.2, `#/metricas`).
- **Git e colaboração:** ver seção 7.
- **IA aplicada ao desenvolvimento:** ver seção 8.
- **Governança, ética e responsabilidade profissional:** ver seção 8.

## 4. Resultados medidos

Lighthouse (celular simulado, rede lenta), antes e depois da **correção do CLS** (o conteúdo é montado por JavaScript e o rodapé "pulava" para baixo; agora o `<main>` reserva a altura da tela até o conteúdo chegar). As imagens WebP responsivas já estavam aplicadas nas duas medições e mantêm a página em ~420 KB:

| Categoria | Antes | Depois |
|---|---|---|
| Performance (celular) | 69 | **98** |
| Performance (desktop) | 78 | **100** |
| Acessibilidade | 100 | **100** |
| Boas práticas | 100 | **100** |
| SEO | 100 | **100** |
| CLS (estabilidade visual) | 0,73 | **0** |
| LCP (celular simulado) | 3,1 s | **1,9 s** |

Testes automáticos: **98 verificações passando** (e2e 30 · segurança 10 · responsividade 30 · acessibilidade 28).
Medição feita servindo a pasta em `http://localhost` (sem compressão, o que penaliza o resultado; hospedagens reais comprimem os arquivos).

## 5. Roteiro de apresentação (~12 minutos)

| Tempo | O que mostrar | O que dizer |
|---|---|---|
| 0:00 | **Abrir o site pela 1ª vez** (com `localStorage` limpo) | O banner de cookies já aparece (LGPD). Mostrar as 3 opções; abrir **Gerenciar preferências**. |
| 1:30 | **Home** | Hierarquia visual: hero, categorias, destaques, coleção Tiffany Blue, newsletter com consentimento. |
| 2:30 | **Acessibilidade ao vivo** | `Tab`: aparecem os atalhos "Pular para…" e o foco é sempre visível. Na barra de acessibilidade: **A+** (150%) e **Alto contraste**. |
| 4:00 | **Busca e vitrine** | Buscar "flor" no cabeçalho; filtrar por preço e ordenar. A URL muda (link compartilhável). |
| 5:00 | **Produto e carrinho** | Anel sem aro → erro acessível; escolher aro; animação "Adicionado!". No carrinho, cupom `ALQUIM10`. |
| 6:30 | **Checkout** | Enviar vazio: resumo de erros com links. Preencher, marcar o consentimento, confirmar. |
| 7:30 | **LGPD na prática** | Política (inventário de dados) → **Canal do titular** (gera protocolo e prazo) → **Minha conta**: baixar dados e excluir a conta. |
| 9:00 | **Segurança** | F12 → *Application* → *Local Storage*: a senha é um hash (`pbkdf2-sha256`) com sal, nunca texto puro. Citar CSP e o teste que injeta um script. |
| 10:00 | **Medir** | Aceitar "Estatísticas", navegar e abrir **Painel de métricas** (funil + Web Vitals). Mostrar o Lighthouse (seção 4). |
| 11:00 | **Qualidade** | Rodar `npm test` ou mostrar o ✔ do GitHub Actions. Mostrar `docs/PLANEJAMENTO-UX.md` e o **Guia de estilo**. |
| 11:45 | **Fechamento** | Desenvolver → testar → medir → aprender → melhorar (mensagem do slide final). |

**Dados para a demonstração:** e-mail `maria@exemplo.com`, senha `senha1234` (fictícia: 8+ caracteres, letras e números), CEP `01310-100`, cupom `ALQUIM10`.

## 6. Decisões de projeto (para justificar à banca)

- **JavaScript puro e SPA por hash:** funciona abrindo o arquivo, sem servidor, e demonstra domínio da linguagem.
- **Azul Tiffany só como destaque:** não tem contraste para texto sobre branco; usamos um verde-azulado escuro para texto e texto escuro sobre o azul claro (razões de contraste calculadas e exibidas no Guia de estilo).
- **Fontes do sistema, sem CDN:** evita enviar o IP do visitante a terceiros (LGPD), melhora a performance e funciona offline.
- **Consentimento que muda o comportamento:** o banner de cookies não é decorativo; sem consentimento, métricas e preferências não são gravadas.
- **Sem dados de pagamento nem CPF:** princípio da minimização (LGPD, art. 6º, III).
- **CSP com `'unsafe-inline'` só em estilos:** alguns componentes usam atributos `style`; scripts continuam restritos ao próprio site. Em produção, o ideal é mover esses estilos para o CSS e remover o `'unsafe-inline'`.

## 7. Trabalho em grupo e Git (slide 15)

**Integrantes** (preencher):

| Nome | RA / matrícula | Responsabilidade principal |
|---|---|---|
| | | |
| | | |
| | | |
| | | |

**Sugestão de divisão de tarefas:**
1. **UX/UI e conteúdo:** `docs/PLANEJAMENTO-UX.md`, teste de usabilidade com pessoas, protótipo no Figma, textos.
2. **Front-end:** `index.html`, `style.css`, responsividade e acessibilidade.
3. **JavaScript/funcionalidades:** carrinho, checkout, conta, filtros.
4. **LGPD, segurança e qualidade:** política, canal do titular, CSP, testes, Lighthouse.

**Fluxo Git recomendado:** repositório no GitHub → uma *branch* por tarefa (`feat/carrinho`, `fix/contraste`) → *commits* curtos e claros em português (`Corrige contraste do botão de alto contraste`) → *Pull Request* revisado por outro integrante → só então entra na `main`. O CI (`.github/workflows/testes.yml`) roda os testes em cada *push*. Quem usa o GitHub Desktop deve, antes da defesa, praticar `git status`, `git log` e `git revert` no terminal.

## 8. Uso de IA, ética e responsabilidade profissional (slides 18 e 19)

**Declaração de uso de IA** (ajuste para refletir o que o grupo de fato fez):
> A primeira versão do código, dos textos, dos testes automáticos e dos documentos deste projeto foi gerada com apoio da IA **Claude (Anthropic)**, a partir dos requisitos definidos pelo grupo. A IA foi tratada como ferramenta de apoio: a responsabilidade técnica é do grupo.

**O que já foi validado automaticamente (não confie só na IA):**
- Contraste de cores calculado, não estimado (Guia de estilo, `#/guia-de-estilo`).
- axe-core em 14 páginas, nos dois temas; Lighthouse; 98 verificações automáticas; testes de XSS e de CSP.

**O que o grupo ainda precisa fazer (a IA não substitui):**
- [ ] **Ler e entender o código** que vai defender. Qualquer integrante pode ser chamado a explicar qualquer arquivo.
- [ ] **Testar com leitor de tela real** (NVDA no Windows, VoiceOver no Mac/iPhone, TalkBack no Android). Os testes automáticos não substituem isso.
- [ ] **Testar em Firefox e Safari**. Os testes automáticos rodam em Chromium (Chrome/Edge).
- [ ] **Aplicar o teste de usabilidade** com pessoas reais (`docs/PLANEJAMENTO-UX.md` §6).
- [ ] **Licença das imagens:** as fotos foram fornecidas pelo grupo e parecem vir de um catálogo de marca real (há logotipo visível em duas fotos). Verifique se há permissão de uso; para qualquer uso fora da disciplina, troque por fotos próprias ou com licença livre.
- [ ] **Validação jurídica:** conforme o slide de LGPD, a conformidade deve ser validada conforme o contexto. A política e os termos são modelos educacionais e **não foram revisados por advogado**.

**Ética e governança aplicadas:** dados fictícios incentivados; consentimento específico e revogável; direito de acessar, baixar e apagar os dados; acessibilidade tratada como requisito (e não como acabamento); transparência sobre o uso de IA e sobre as limitações deste projeto.

## 9. Limitações (seja transparente na apresentação)

- **Não há servidor.** Tudo fica no navegador; os dados não vão para outros dispositivos e somem ao limpar o navegador. Pagamento, frete, estoque e e-mails são simulados.
- **A autenticação é só uma demonstração.** A senha usa PBKDF2 com sal, mas o bloqueio de tentativas e a verificação rodam no navegador (quem controla o navegador pode contorná-los). Em produção: servidor, HTTPS, sessões seguras e limite de tentativas no back-end.
- **SEO e URLs com `#`:** buscadores ignoram o que vem depois do `#`, então as páginas de produto não são indexadas individualmente. Em produção: rotas limpas (`/produto/anel2`) com *History API* e reescrita no servidor, ou geração de páginas estáticas, mais `sitemap.xml`.
- **Métricas só locais:** o painel mostra os dados de *este* navegador. Em produção usaríamos uma ferramenta de análise com consentimento e anonimização.
- **Compatibilidade:** testes automáticos só em Chromium. Faltam testes manuais em Firefox e Safari.
- **Produtos, preços e textos são fictícios.**
- **Arquivos de imagem não usados:** a pasta `img/` contém JPGs e WebPs antigos que nenhuma página usa (~5 MB). Podem ser apagados com segurança se quiserem uma entrega mais leve; as 35 fotos em uso estão em `produtos.js`.

## 10. Possíveis perguntas da banca

- **Por que não usaram React/Vue?** O foco foi demonstrar HTML, CSS e JS puros e entregar algo que abre com dois cliques.
- **Os dados são seguros?** Ficam só no navegador do usuário, sem envio a servidores. A senha vai como hash PBKDF2 com sal; em produção a autenticação seria no back-end.
- **Como a LGPD foi atendida?** Consentimento prévio e granular de cookies que muda o comportamento do site, finalidade clara, minimização, política com inventário de dados, canal do titular com prazo, e direitos de acesso, portabilidade e exclusão.
- **Como garantiram a acessibilidade?** HTML semântico, teclado, foco visível, `alt` descritivo, contraste calculado, barra de acessibilidade, erros de formulário associados aos campos, testes com axe-core e Lighthouse. Falta o teste com leitor de tela real (dito com transparência).
- **O que melhorou na performance?** Medimos com o Lighthouse, achamos que o rodapé causava um deslocamento de layout (CLS 0,73) e o corrigimos reservando a altura do conteúdo: a nota no celular foi de 69 para 98 e o CLS foi a 0. As imagens WebP responsivas mantêm a página em ~420 KB.
- **Como sabem que está funcionando?** 98 verificações automáticas, rodando também no GitHub a cada alteração.
- **O que mudaria numa versão real?** Back-end e banco de dados, autenticação segura, gateway de pagamento, frete por CEP, estoque, rotas limpas para SEO, encarregado de dados real e revisão jurídica.

## 11. Antes de entregar

- [ ] Preencher a tabela de integrantes (seção 7) e trocar os placeholders: `[Nome do grupo]` e `[Seu nome]` / `[Curso / Instituição]` em `index.html` (meta *author* e rodapé), e `[Seu nome]` / `[curso / instituição]` na política de privacidade dentro de `script.js` (procure por `[Seu nome]`).
- [ ] Trocar o e-mail fictício `privacidade@alquim.example`, se quiser.
- [ ] Criar o repositório no GitHub, subir o código e ver o CI passar.
- [ ] Publicar (Netlify ou GitHub Pages) e testar o link no celular.
- [ ] Fazer o teste de usabilidade e preencher `docs/PLANEJAMENTO-UX.md` §6.
- [ ] Testar com leitor de tela e em Firefox/Safari.
- [ ] Conferir a licença das imagens.
