// Tudo o que é específico da rotina do Marcos fica aqui.
// Quando a nutricionista ou o personal mudarem o plano, basta editar este arquivo.
window.PLAN = {
  nome: 'Marcos',

  refeicoes: [
    { id: 'shake', hora: '06:30', nome: 'Pré-treino', desc: 'Shake: leite desnatado, banana, beterraba em pó, whey e beta-alanina.' },
    { id: 'antiinflamatoria', hora: '08:15', nome: 'Estratégia anti-inflamatória', desc: 'Própolis verde, maca peruana e feno-grego dissolvidos em água.' },
    { id: 'cafe', hora: '08:30', nome: 'Café da manhã', desc: 'Panqueca de farelo de aveia com 3 ovos e café coado.' },
    { id: 'lanche_manha', hora: '10:40', nome: 'Lanche da manhã', desc: 'Melão ou uma das frutas substitutas.' },
    { id: 'almoco', hora: '12:00', nome: 'Almoço', desc: 'Salada com azeite, frango ou patinho, ovo, arroz e feijão.' },
    { id: 'lanche_tarde', hora: '15:30', nome: 'Lanche da tarde', desc: 'Pão integral com frango desfiado, requeijão light ou ricota e vegetais.' },
    { id: 'lanche_18', hora: '18:00', nome: 'Lanche da tarde 2', desc: 'Omeletão proteico ou carne gratinada com queijo.', destaque: true },
    { id: 'pre_jantar', hora: 'Antes do jantar', nome: 'Chá com psyllium', desc: 'Chá sem açúcar e 1 colher de sopa de psyllium.' },
    { id: 'jantar', hora: '21:00', nome: 'Jantar', desc: 'Salada, legumes, frango ou carne, arroz (ou substituto) e salada de frutas.' },
  ],

  blocos: [
    { id: 'manha', titulo: 'Refeições da manhã', ids: ['shake', 'antiinflamatoria', 'cafe', 'lanche_manha'] },
    { id: 'tarde', titulo: 'Refeições da tarde', ids: ['almoco', 'lanche_tarde', 'lanche_18'] },
    { id: 'noite', titulo: 'Refeições da noite', ids: ['pre_jantar', 'jantar'] },
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
