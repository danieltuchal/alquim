# Planejamento de UX da Alquim

> Documento do slide **"UX — User Experience e Usabilidade"** (personas, jornada, arquitetura da informação, fluxos e testes com usuários).
> As **personas são hipóteses** do grupo, baseadas em suposições sobre o público de joias, e não em pesquisa real.
> A seção 6 (testes de usabilidade) está **em branco de propósito**: o grupo precisa aplicar o roteiro com pessoas de verdade e preencher.

## 1. Objetivo do site (requisito)

Permitir que uma pessoa **escolha uma joia e conclua uma compra simulada em poucos cliques**, sentindo confiança (qualidade da imagem, preço claro, privacidade respeitada) e podendo usar o site com teclado, leitor de tela ou celular.

Metas mensuráveis do projeto:

| Meta | Como medir | Resultado atual |
|---|---|---|
| Comprar em até 5 telas (Home → Peça → Carrinho → Checkout → Confirmação) | Fluxo do teste e2e (`npm run test:e2e`) | Atingido (com "Comprar agora": Home → Peça → Checkout → Confirmação, 4 telas) |
| Nota de acessibilidade máxima | Lighthouse + axe-core (`npm run test:a11y`) | 100 no Lighthouse; 0 violações no axe em 14 páginas, nos 2 temas |
| Página estável e rápida (Core Web Vitals) | Lighthouse / painel `#/metricas` | CLS 0; LCP 1,9 s no celular simulado |

## 2. Personas (hipóteses)

**Marina, 29 anos, analista de marketing: "quero presentear sem errar"**
- Objetivo: comprar um presente para a mãe, sem tempo de visitar loja.
- Dores: medo de escolher o tamanho errado, quer ver a peça "em uso", quer saber o frete antes de decidir.
- Como o site ajuda: fotos do produto e em uso; aro obrigatório nos anéis (evita erro); frete e total visíveis no carrinho; cupom e parcelamento claros.

**Seu Antônio, 63 anos, aposentado: "letras pequenas me cansam"**
- Objetivo: comprar um relógio e acompanhar o pedido.
- Dores: texto pequeno, medo de golpes, dificuldade com menus complexos.
- Como o site ajuda: barra de acessibilidade (A−/A/A+ e alto contraste), botões grandes, política de privacidade clara, mapa do site.

**Júlia, 22 anos, estudante com baixa visão: "uso leitor de tela e teclado"**
- Objetivo: comprar um colar de forma independente.
- Dores: sites sem rótulos, foco invisível, erros de formulário que ninguém anuncia.
- Como o site ajuda: HTML semântico, `alt` descritivo em todas as fotos, foco sempre visível, "pular para o conteúdo", resumo de erros anunciado e com links para os campos.

## 3. Jornada principal (compra)

| Etapa | O que a pessoa faz | O que sente / precisa | Solução no site |
|---|---|---|---|
| Descobrir | Chega na Home | "Isso é para mim? É confiável?" | Hero com chamada clara, coleção em destaque, selos de frete/parcelas/troca |
| Explorar | Usa menu, busca ou filtros | "Quero achar rápido" | Menu por categoria, busca no cabeçalho, filtros de preço, ordenação, contador de resultados |
| Avaliar | Abre a peça | "Como é no corpo? Qual tamanho?" | Galeria produto/em uso, ficha técnica, preço em 10x |
| Decidir | Adiciona ao carrinho | "Deu certo?" | Botão vira "Adicionado!", sacola anima, aviso com atalho para o carrinho |
| Revisar | Abre o carrinho | "Quanto vai custar no total?" | Quantidade, remoção, cupom, frete e total |
| Pagar (simulado) | Preenche o checkout | "Meus dados estão seguros?" | Só os dados necessários, resumo de erros, consentimento específico (LGPD) |
| Concluir | Vê a confirmação | "Deu certo mesmo?" | Número do pedido, resumo, histórico em "Minha conta" |
| Pós-compra | Gerencia seus dados | "Posso apagar tudo?" | Baixar dados, excluir conta, Canal do titular |

## 4. Arquitetura da informação

```
Início (#/)
├── Coleção Tiffany Blue (#/colecao) ── filtros: categoria · preço · ordenação · busca
│   ├── Anéis · Brincos · Colares · Pulseiras · Relógios (#/colecao?cat=...)
│   └── Produto (#/produto/<id>)  [breadcrumb: Início / Categoria / Peça]
├── Carrinho (#/carrinho) → Finalizar compra (#/checkout) → Pedido confirmado (#/pedido/<id>)
├── Minha conta (#/conta): entrar · criar conta · pedidos · baixar/excluir dados
├── Privacidade e legal
│   ├── Política de Privacidade (#/privacidade)
│   ├── Termos de Uso (#/termos)
│   ├── Canal do titular (#/titular)
│   └── Preferências de cookies (diálogo, no rodapé)
└── Apoio e transparência
    ├── Mapa do site (#/mapa-do-site)
    ├── Guia de estilo / design system (#/guia-de-estilo)
    └── Painel de métricas (#/metricas), demonstração
```

Princípios usados: **poucos níveis** (no máximo 3 cliques da Home até uma peça), **rótulos em linguagem do cliente**, **breadcrumbs** nas páginas de produto, **busca interna** sempre disponível e **mapa do site** como rota alternativa.

## 5. Fluxos críticos e prevenção de erros (heurísticas de usabilidade)

| Risco de erro | Prevenção | Recuperação |
|---|---|---|
| Esquecer o aro do anel | Campo obrigatório com dica | Mensagem junto ao campo + foco nele |
| Preencher o checkout errado | Máscara de CEP, e-mail e campos validados | Resumo de erros no topo, com link para cada campo |
| Cupom errado | Dica do cupom de demonstração | Mensagem "Cupom inválido ou expirado." |
| Apagar a conta sem querer | Diálogo de confirmação, com "Cancelar" como foco inicial | Nada é apagado até confirmar |
| Perder o carrinho | Carrinho salvo no navegador | Continua ao voltar ao site |

## 6. Roteiro de teste de usabilidade (preencher com pessoas reais)

**Como aplicar:** convidar de 3 a 5 pessoas fora do grupo (idealmente 1 com mais de 50 anos e 1 que use leitor de tela ou zoom). Dizer apenas a tarefa, sem ensinar o caminho. Observar em silêncio e anotar hesitações. Medir o tempo. Pedir uma nota de 1 a 5 de facilidade ao final de cada tarefa.

**Tarefas:**
1. Encontrar um **colar** com preço de até R$ 700.
2. Adicionar um **anel** ao carrinho (tamanho 16) e aplicar o cupom `ALQUIM10`.
3. Concluir a compra simulada.
4. **Baixar seus dados** e depois **excluir a conta**.
5. Aumentar o tamanho do texto e ativar o alto contraste.

**Tabela de resultados (a ser preenchida pelo grupo):**

| Participante (idade / perfil) | Tarefa | Concluiu? (S/N) | Tempo | Nota (1–5) | Onde hesitou / observação |
|---|---|---|---|---|---|
| | 1 | | | | |
| | 2 | | | | |
| | 3 | | | | |
| | 4 | | | | |
| | 5 | | | | |

**Depois do teste:** liste os 3 maiores problemas encontrados, o que o grupo mudou por causa deles e o que ficou para o futuro. Isso mostra ao professor o ciclo *desenvolver → testar → medir → aprender → melhorar*.

## 7. Design system

Os componentes (botões, formulários, cards, mensagens, cores com a razão de contraste calculada ao vivo) estão em **`#/guia-de-estilo`**. Para o Figma (ferramenta citada no slide de UI), uma boa atividade é redesenhar nele os componentes dessa página a partir dos *tokens* definidos no início do `style.css`.
