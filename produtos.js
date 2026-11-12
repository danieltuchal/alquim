/* =========================================================================
   ALQUIM — CATÁLOGO DE PRODUTOS (dados)
   -------------------------------------------------------------------------
   Arquivo separado da lógica (script.js) para facilitar a manutenção:
   para incluir/alterar uma peça basta editar este arquivo.

   Cada produto possui:
   - id, categoria, nome, preco (R$), selo (opcional), destaque (home)
   - resumo (card) e descricao (página do produto)
   - material e pedras (ficha técnica)
   - fotos: [{ src, alt, tipo }]  → "alt" descritivo para leitores de tela (WCAG 1.1.1)
   ========================================================================= */

/* Categorias da loja (slug usado na URL: #/colecao?cat=aneis) */
const CATEGORIAS = [
  { slug: 'aneis',     nome: 'Anéis',     capa: { id: 'anel5',     tipo: 'uso' } },
  { slug: 'brincos',   nome: 'Brincos',   capa: { id: 'brinco3',   tipo: 'uso' } },
  { slug: 'colares',   nome: 'Colares',   capa: { id: 'colar3',    tipo: 'uso' } },
  { slug: 'pulseiras', nome: 'Pulseiras', capa: { id: 'pulseira3', tipo: 'uso' } },
  { slug: 'relogios',  nome: 'Relógios',  capa: { id: 'relogio1',  tipo: 'produto' } }
];

const PRODUTOS = [
  /* ------------------------------ ANÉIS ------------------------------ */
  {
    id: 'anel1', categoria: 'aneis', nome: 'Anel Onda Cristal', preco: 489, selo: '', destaque: false,
    resumo: 'Formato fluido com faixa de cristais azul-turquesa.',
    descricao: 'Uma curva escultural que lembra o movimento de uma onda. A faixa de cristais azul-turquesa em pavê ganha destaque contra o brilho do metal polido. O aro aberto e ajustável acompanha diferentes tamanhos de dedo.',
    material: 'Metal com banho de ródio', pedras: 'Cristais azul-turquesa em pavê',
    fotos: [
      { tipo: 'produto', src: 'img/anel1-produto.jpg', alt: 'Anel prateado em formato de onda, com faixa de cristais azul-turquesa em pavê e aro aberto, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/anel1-pessoa.jpg',  alt: 'Mão feminina apoiada sobre uma mesa clara usando o anel prateado com faixa de cristais azul-turquesa.' }
    ]
  },
  {
    id: 'anel2', categoria: 'aneis', nome: 'Anel Flor de Lago', preco: 899, selo: 'Mais vendido', destaque: true,
    resumo: 'Flor de cristais azul-água com centro amarelo.',
    descricao: 'Cinco pétalas em cristais lapidados em gota, na cor azul-água, desabrocham em torno de um miolo amarelo com detalhes cor-de-rosa. Uma peça-statement para quem gosta de joias que contam uma história.',
    material: 'Metal com banho de ródio', pedras: 'Cristais lapidados azul-água, amarelo e rosa',
    fotos: [
      { tipo: 'produto', src: 'img/anel2-produto.jpg', alt: 'Anel prateado em forma de flor grande, com cinco pétalas de cristais azul-água em formato de gota e centro amarelo com detalhes rosa, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/anel2-pessoa.jpg',  alt: 'Mão feminina com unhas em tom nude usando o anel de flor de cristais azul-água, sobre tecido cinza.' }
    ]
  },
  {
    id: 'anel3', categoria: 'aneis', nome: 'Anel Estrela Boreal', preco: 349, selo: '', destaque: false,
    resumo: 'Estrela azul-turquesa e laterais cravejadas.',
    descricao: 'Um cristal azul-turquesa em formato de estrela repousa sobre um aro delicado, com laterais cravejadas de pedras claras. Discreto para o dia a dia e luminoso o bastante para a noite.',
    material: 'Metal com banho de ródio', pedras: 'Cristal azul-turquesa e zircônias claras',
    fotos: [
      { tipo: 'produto', src: 'img/anel3-produto.jpg', alt: 'Anel prateado com cristal azul-turquesa em formato de estrela e laterais cravejadas de pedras claras, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/anel3-pessoa.jpg',  alt: 'Mãos femininas sobrepostas; uma delas usa o anel prateado com estrela azul-turquesa, sobre tecido acinzentado.' }
    ]
  },
  {
    id: 'anel4', categoria: 'aneis', nome: 'Anel Halo Aqua', preco: 1290, selo: '', destaque: true,
    resumo: 'Pedra central clara com halo azul-turquesa.',
    descricao: 'Uma pedra central de corte quadrado, cristalina, é emoldurada por um halo e por um aro de pequenas pedras azul-turquesa. A combinação de transparência e cor é o retrato da nossa coleção Tiffany Blue.',
    material: 'Metal com banho de ródio', pedras: 'Pedra central cristalina e pavê azul-turquesa',
    fotos: [
      { tipo: 'produto', src: 'img/anel4-produto.jpg', alt: 'Anel com grande pedra central clara de corte quadrado, rodeada por halo e aro de pedras azul-turquesa, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/anel4-pessoa.jpg',  alt: 'Mão feminina de unhas rosadas usando o anel com pedra clara central e halo azul-turquesa, sobre tecido cinza.' }
    ]
  },
  {
    id: 'anel5', categoria: 'aneis', nome: 'Anel Jardim Aberto', preco: 729, selo: '', destaque: false,
    resumo: 'Anel aberto com flor azul-turquesa e toques rosa.',
    descricao: 'O aro aberto termina em uma gota cor-de-rosa e dá espaço para uma flor de pétalas azul-turquesa com miolo de cristais claros. Leve, delicado e fácil de combinar com outros anéis.',
    material: 'Metal com banho de ródio', pedras: 'Cristais azul-turquesa, claros e rosa',
    fotos: [
      { tipo: 'produto', src: 'img/anel5-produto.jpg', alt: 'Anel aberto prateado com flor de pétalas azul-turquesa, miolo de cristais claros e detalhes cor-de-rosa, e uma gota rosa na ponta do aro, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/anel5-pessoa.jpg',  alt: 'Mão feminina usando o anel aberto em forma de flor azul-turquesa com detalhes rosa, diante de uma blusa cinza.' }
    ]
  },

  /* ------------------------------ BRINCOS ------------------------------ */
  {
    id: 'brinco1', categoria: 'brincos', nome: 'Argola Mosaico', preco: 759, selo: '', destaque: false,
    resumo: 'Argolas com cristais em tons de azul e uma pérola.',
    descricao: 'Cristais de cortes e tonalidades variadas, do azul-claro ao azul-turquesa intenso, formam um mosaico ao longo da argola. Uma pérola azul completa o desenho e dá movimento à peça.',
    material: 'Metal com banho de ródio', pedras: 'Cristais multicorte em tons de azul e pérola sintética',
    fotos: [
      { tipo: 'produto', src: 'img/brinco1-produto.jpg', alt: 'Par de argolas prateadas cravejadas de cristais azul-turquesa e azul-claro em cortes variados, com uma pérola azul, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/brinco1-pessoa.jpg',  alt: 'Orelha de uma mulher usando a argola de cristais em tons de azul-turquesa, com cabelo escuro preso ao fundo.' }
    ]
  },
  {
    id: 'brinco2', categoria: 'brincos', nome: 'Argola Espiral', preco: 589, selo: '', destaque: true,
    resumo: 'Argolas entrelaçadas com cristais retangulares.',
    descricao: 'Duas voltas de metal polido se cruzam em uma espiral elegante, cravejada de cristais retangulares azul-turquesa. Perfeita para compor looks sofisticados sem exageros.',
    material: 'Metal com banho de ródio', pedras: 'Cristais retangulares azul-turquesa',
    fotos: [
      { tipo: 'produto', src: 'img/brinco2-produto.jpg', alt: 'Par de argolas prateadas com duas voltas entrelaçadas, cravejadas de cristais retangulares azul-turquesa, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/brinco2-pessoa.jpg',  alt: 'Perfil de uma mulher de cabelo preso e blusa de cetim clara usando a argola entrelaçada com cristais azul-turquesa.' }
    ]
  },
  {
    id: 'brinco3', categoria: 'brincos', nome: 'Brinco Flor Cristal', preco: 429, selo: 'Novo', destaque: true,
    resumo: 'Flor de cristais com pedra central azul-turquesa.',
    descricao: 'Pétalas cravejadas de cristais claros emolduram uma grande pedra redonda azul-turquesa. Um clássico atemporal que vai do trabalho ao jantar, com fechamento seguro tipo tarraxa.',
    material: 'Metal com banho de ródio', pedras: 'Pedra central azul-turquesa e cristais claros',
    fotos: [
      { tipo: 'produto', src: 'img/brinco3-produto.jpg', alt: 'Par de brincos de botão em forma de flor, com pétalas cravejadas de cristais claros e uma grande pedra redonda azul-turquesa ao centro, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/brinco3-pessoa.jpg',  alt: 'Perfil de uma mulher de cabelo preso usando o brinco em forma de flor com pedra central azul-turquesa.' }
    ]
  },

  /* ------------------------------ COLARES ------------------------------ */
  {
    id: 'colar1', categoria: 'colares', nome: 'Colar Gota Aqua', preco: 459, selo: '', destaque: false,
    resumo: 'Corrente fina com pingente em gota vazada.',
    descricao: 'Uma gota vazada com pavê de cristais azul-turquesa pende de uma corrente longa e fina, com ajuste de comprimento. Ideal para sobrepor a outros colares ou usar sozinho.',
    material: 'Metal com banho de ródio', pedras: 'Pavê de cristais azul-turquesa',
    fotos: [
      { tipo: 'produto', src: 'img/colar1-produto.jpg', alt: 'Colar prateado de corrente fina e ajustável com pingente em gota vazada e pavê de cristais azul-turquesa, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/colar1-pessoa.jpg',  alt: 'Mulher de blusa de cetim clara, em uma joalheria, tocando o colar fino com pingente em gota azul-turquesa.' }
    ]
  },
  {
    id: 'colar2', categoria: 'colares', nome: 'Colar Trio Aqua', preco: 389, selo: '', destaque: false,
    resumo: 'Delicado, com trio de cristais azul-turquesa.',
    descricao: 'Três cristais azul-turquesa reunidos em um pequeno pingente sobre uma corrente delicada. Minimalista e luminoso, é a escolha certa para quem quer um toque de cor todos os dias.',
    material: 'Metal com banho de ródio', pedras: 'Três cristais azul-turquesa',
    fotos: [
      { tipo: 'produto', src: 'img/colar2-produto.jpg', alt: 'Colar prateado de corrente delicada com pequeno pingente formado por três cristais azul-turquesa e fecho ajustável, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/colar2-pessoa.jpg',  alt: 'Colo e pescoço de uma mulher de cabelo cacheado usando o colar delicado com trio de cristais azul-turquesa.' }
    ]
  },
  {
    id: 'colar3', categoria: 'colares', nome: 'Colar Cisne Cristal', preco: 699, selo: 'Novo', destaque: true,
    resumo: 'Cisne cravejado com asa azul-turquesa.',
    descricao: 'O cisne, símbolo de graça e elegância, ganha corpo em cristais claros e uma grande pedra azul-turquesa na asa. A corrente em elos finos completa o visual sofisticado.',
    material: 'Metal com banho de ródio', pedras: 'Cristais claros e pedra azul-turquesa',
    fotos: [
      { tipo: 'produto', src: 'img/colar3-produto.jpg', alt: 'Colar prateado com pingente em forma de cisne, coberto de cristais claros e com uma grande pedra azul-turquesa na asa, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/colar3-pessoa.jpg',  alt: 'Mulher de blazer branco usando o colar com pingente de cisne cravejado e pedra azul-turquesa.' }
    ]
  },
  {
    id: 'colar4', categoria: 'colares', nome: 'Colar Trio de Flores', preco: 949, selo: '', destaque: true,
    resumo: 'Três flores de cristais em azul-turquesa e transparente.',
    descricao: 'Duas flores de pétalas azul-turquesa e uma de cristais transparentes se encontram no centro da corrente. Uma peça de presença, pensada para decotes e ocasiões especiais.',
    material: 'Metal com banho de ródio', pedras: 'Cristais lapidados azul-turquesa e transparentes',
    fotos: [
      { tipo: 'produto', src: 'img/colar4-produto.jpg', alt: 'Colar prateado com três flores de cristais: duas de pétalas azul-turquesa e uma de cristais transparentes, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/colar4-pessoa.jpg',  alt: 'Mulher de blusa preta ombro a ombro usando o colar com trio de flores em azul-turquesa e cristal.' }
    ]
  },
  {
    id: 'colar5', categoria: 'colares', nome: 'Colar Floco Estelar', preco: 819, selo: '', destaque: false,
    resumo: 'Pingente estrelado com pontas azul-turquesa.',
    descricao: 'Inspirado em um floco de neve, o pingente combina pontas de cristais azul-turquesa com um miolo de pedras claras. Reflete a luz de todos os ângulos.',
    material: 'Metal com banho de ródio', pedras: 'Cristais azul-turquesa e claros',
    fotos: [
      { tipo: 'produto', src: 'img/colar5-produto.jpg', alt: 'Colar prateado com pingente em formato de floco de neve, com pontas de cristais azul-turquesa e centro de cristais claros, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/colar5-pessoa.jpg',  alt: 'Mulher de blusa preta de decote em V usando o colar com pingente de floco de cristais azul-turquesa e claros.' }
    ]
  },

  /* ------------------------------ PULSEIRAS ------------------------------ */
  {
    id: 'pulseira1', categoria: 'pulseiras', nome: 'Bracelete Abraço Aqua', preco: 679, selo: '', destaque: false,
    resumo: 'Bracelete aberto com pedras em formato de coração.',
    descricao: 'Um bracelete rígido e aberto, com uma fileira de cristais azul-turquesa em um dos lados e duas pedras em formato de coração nas pontas, como um abraço no pulso.',
    material: 'Metal com banho de ródio', pedras: 'Cristais azul-turquesa',
    fotos: [
      { tipo: 'produto', src: 'img/pulseira1-produto.jpg', alt: 'Bracelete aberto prateado com fileira de cristais azul-turquesa em um dos lados e duas pedras azul-turquesa em formato de coração nas pontas, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/pulseira1-pessoa.jpg',  alt: 'Pulso feminino usando o bracelete aberto com pedras azul-turquesa nas pontas, com a mulher sentada em um sofá bege.' }
    ]
  },
  {
    id: 'pulseira2', categoria: 'pulseiras', nome: 'Bracelete Constelação', preco: 889, selo: '', destaque: false,
    resumo: 'Bracelete duplo com estrelas azul-turquesa.',
    descricao: 'Duas voltas paralelas de metal polido, com faixas de cristais claros e estrelas lapidadas em azul-turquesa. Uma peça que parece um pedaço do céu noturno.',
    material: 'Metal com banho de ródio', pedras: 'Estrelas azul-turquesa e cristais claros',
    fotos: [
      { tipo: 'produto', src: 'img/pulseira2-produto.jpg', alt: 'Bracelete duplo prateado com estrelas de cristal azul-turquesa e faixas de cristais claros, em close, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/pulseira2-pessoa.jpg',  alt: 'Pulso de uma mulher de blusa branca usando o bracelete duplo com estrelas azul-turquesa.' }
    ]
  },
  {
    id: 'pulseira3', categoria: 'pulseiras', nome: 'Bracelete Flor Aqua', preco: 799, selo: '', destaque: true,
    resumo: 'Bracelete curvo com flor de cristais em gota.',
    descricao: 'O aro curvo e aberto termina em uma flor de cristais azul-turquesa em formato de gota. Uma pedra azul na outra ponta equilibra o desenho e alonga o pulso.',
    material: 'Metal com banho de ródio', pedras: 'Cristais azul-turquesa lapidados em gota',
    fotos: [
      { tipo: 'produto', src: 'img/pulseira3-produto.jpg', alt: 'Bracelete aberto prateado em curva com flor de cristais azul-turquesa em formato de gota e uma pedra azul na ponta, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/pulseira3-pessoa.jpg',  alt: 'Antebraço de uma mulher de blusa branca usando o bracelete com flor de cristais azul-turquesa.' }
    ]
  },
  {
    id: 'pulseira4', categoria: 'pulseiras', nome: 'Bracelete Libélula', preco: 859, selo: 'Mais vendido', destaque: false,
    resumo: 'Libélula azul-turquesa com pérola e cristais.',
    descricao: 'Uma libélula de cristais azul-turquesa com uma pérola no corpo pousa sobre um bracelete cravejado de pedras claras. Delicadeza e brilho em um só gesto.',
    material: 'Metal com banho de ródio', pedras: 'Cristais azul-turquesa, claros e pérola sintética',
    fotos: [
      { tipo: 'produto', src: 'img/pulseira4-produto.jpg', alt: 'Bracelete aberto prateado com libélula de cristais azul-turquesa e uma pérola, fileira de cristais claros e uma gota azul na ponta, sobre fundo branco.' },
      { tipo: 'uso',     src: 'img/pulseira4-pessoa.jpg',  alt: 'Pulso de uma mulher usando o bracelete com libélula azul-turquesa e pérola, ao lado de uma manga branca.' }
    ]
  },

  /* ------------------------------ RELÓGIOS ------------------------------ */
  {
    id: 'relogio1', categoria: 'relogios', nome: 'Relógio Maré Cristal', preco: 2490, selo: 'Edição limitada', destaque: true,
    resumo: 'Mostrador em madrepérola e aro de cristais.',
    descricao: 'Mostrador em madrepérola com índices de cristais azul-turquesa, envolvido por um aro de cristais em curvas assimétricas. A pulseira em aço articulado garante conforto e brilho.',
    material: 'Aço inoxidável', pedras: 'Cristais azul-turquesa no aro e nos índices',
    fotos: [
      { tipo: 'produto', src: 'img/relogio1-produto.jpg', alt: 'Relógio feminino com pulseira de aço prateada, mostrador em madrepérola e aro de cristais azul-turquesa em curvas assimétricas, sobre fundo branco.' }
    ]
  }
];

/* Ajuda: acha a foto de um produto pelo tipo ('produto' ou 'uso') */
function fotoDe(id, tipo) {
  const p = PRODUTOS.find(x => x.id === id);
  if (!p) return null;
  return p.fotos.find(f => f.tipo === tipo) || p.fotos[0];
}
