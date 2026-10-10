// Tudo o que é específico da rotina do Marcos fica aqui.
// Quando a nutricionista ou o personal mudarem o plano, basta editar este arquivo.
window.PLAN = {
  nome: 'Marcos',

  // Plano de out a nov/2026 (prescrito em 10/10/2026)
  refeicoes: [
    { id: 'shake', hora: '06:30', nome: 'Café da manhã (pré-treino)', desc: 'Shake: leite desnatado, banana, beterraba em pó, whey, feno-grego, maca, guaraná e beta-alanina.' },
    { id: 'cafe', hora: '08:30', nome: 'Café da manhã', desc: 'Panqueca de farelo de aveia com 3 ovos e café coado.' },
    { id: 'lanche_manha', hora: '10:40', nome: 'Lanche da manhã', desc: 'Melão ou uma das frutas substitutas.' },
    { id: 'almoco', hora: '12:00', nome: 'Almoço', desc: 'Salada com azeite, frango, patinho ou outra carne magra, arroz e feijão.' },
    { id: 'lanche_tarde', hora: '15:30', nome: 'Lanche da tarde 1', desc: 'Torradinhas Magic Toast com frango e requeijão light, café e morango.' },
    { id: 'lanche_18', hora: '18:00', nome: 'Lanche da tarde 2', desc: 'Pão francês com frango, carne ou atum e muçarela, ou vitamina com whey vegano, banana, aveia e pasta de amendoim.', destaque: true },
    { id: 'jantar', hora: '21:00', nome: 'Jantar', desc: 'Salada e legumes, frango ou carne moída, arroz (ou substituto) e abacaxi.' },
  ],

  blocos: [
    { id: 'manha', titulo: 'Refeições da manhã', ids: ['shake', 'cafe', 'lanche_manha'] },
    { id: 'tarde', titulo: 'Refeições da tarde e da noite', ids: ['almoco', 'lanche_tarde', 'lanche_18', 'jantar'] },
  ],

  treinos: [
    { id: 'A', nome: 'Treino A', desc: 'Peito, ombros e tríceps' },
    { id: 'B', nome: 'Treino B', desc: 'Costas, posterior de ombro e bíceps' },
    { id: 'C', nome: 'Treino C', desc: 'Perna, ênfase posterior' },
    { id: 'D', nome: 'Treino D', desc: 'Superior completo' },
    { id: 'E', nome: 'Treino E', desc: 'Perna, quadríceps e glúteos' },
    { id: 'outro', nome: 'Outro treino', desc: '' },
    { id: 'nao', nome: 'Não treinei', desc: '' },
  ],
  treinosDePerna: ['C', 'E'],

  atividades: [
    { id: 'muaythai', nome: 'Muay Thai' },
    { id: 'volei', nome: 'Vôlei' },
    { id: 'bike_ergo', nome: 'Bike ergométrica' },
    { id: 'bike_rua', nome: 'Bike de rua' },
    { id: 'fisio', nome: 'Sessão de fisioterapia' },
    { id: 'caminhada', nome: 'Caminhada' },
  ],

  suplementos: [
    { id: 'creatina', nome: 'Creatina 5 g' },
    { id: 'omega3', nome: 'Ômega 3' },
    { id: 'multi', nome: 'Multivitamínico' },
    { id: 'vitd', nome: 'Vitamina D' },
    { id: 'vite', nome: 'Vitamina E' },
    { id: 'cardo', nome: 'Cardo mariano' },
    { id: 'glifage_almoco', nome: 'Glifage após o almoço' },
    { id: 'glifage_jantar', nome: 'Glifage após o jantar' },
  ],

  // Régua combinada: o que a dor FAZ com o movimento.
  escalaDor: [
    { ate: 0, texto: 'Sem dor.' },
    { ate: 2, texto: 'Percebe se prestar atenção, mas esquece logo.' },
    { ate: 4, texto: 'Incomoda, mas o movimento continua igual.' },
    { ate: 6, texto: 'A dor mudou o movimento: corrimão, poupar a perna, evitar agachar.' },
    { ate: 8, texto: 'Interrompe ou faz evitar a atividade. Dói mesmo parado.' },
    { ate: 10, texto: 'Não consegue apoiar o peso ou dormir. Procure o médico.' },
  ],
};
