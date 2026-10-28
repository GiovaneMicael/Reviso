// Base estática de repertório. Os temas de 2009 a 2025 são os oficiais do ENEM.
// Os "eixos prováveis" são apostas de estudo, NÃO previsões: o Inep não divulga o tema antes da prova.

export const TEMAS_ANTERIORES = [
  { ano: 2025, tema: "Perspectivas acerca do envelhecimento na sociedade brasileira", eixo: "Sociedade e idosos" },
  { ano: 2024, tema: "Desafios para a valorização da herança africana no Brasil", eixo: "Cultura e racismo" },
  { ano: 2023, tema: "Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil", eixo: "Gênero e trabalho" },
  { ano: 2022, tema: "Desafios para a valorização de comunidades e povos tradicionais no Brasil", eixo: "Cultura e cidadania" },
  { ano: 2021, tema: "Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil", eixo: "Cidadania" },
  { ano: 2020, tema: "O estigma associado às doenças mentais na sociedade brasileira", eixo: "Saúde" },
  { ano: 2019, tema: "Democratização do acesso ao cinema no Brasil", eixo: "Cultura" },
  { ano: 2018, tema: "Manipulação do comportamento do usuário pelo controle de dados na internet", eixo: "Tecnologia" },
  { ano: 2017, tema: "Desafios para a formação educacional de surdos no Brasil", eixo: "Educação e inclusão" },
  { ano: 2016, tema: "Caminhos para combater a intolerância religiosa no Brasil", eixo: "Direitos humanos" },
  { ano: 2015, tema: "A persistência da violência contra a mulher na sociedade brasileira", eixo: "Gênero e violência" },
  { ano: 2014, tema: "Publicidade infantil em questão no Brasil", eixo: "Infância e consumo" },
  { ano: 2013, tema: "Efeitos da implantação da Lei Seca no Brasil", eixo: "Segurança e legislação" },
  { ano: 2012, tema: "Movimento imigratório para o Brasil no século XXI", eixo: "Migração" },
  { ano: 2011, tema: "Viver em rede no século XXI: os limites entre o público e o privado", eixo: "Tecnologia e privacidade" },
  { ano: 2010, tema: "O trabalho na construção da dignidade humana", eixo: "Trabalho" },
  { ano: 2009, tema: "O indivíduo frente à ética nacional", eixo: "Ética e cidadania" },
];

export const EIXOS_PROVAVEIS = [
  { eixo: "Saúde mental e bem-estar", exemplos: ["Impactos do uso excessivo de telas na saúde mental de jovens", "Desafios para ampliar o acesso à saúde mental no SUS"], dica: "Já caiu em 2020. Observe o ângulo: prevenção, acesso ou estigma." },
  { eixo: "Inteligência artificial e trabalho", exemplos: ["Impactos da inteligência artificial no mercado de trabalho brasileiro", "Desafios para regular o uso de inteligência artificial no Brasil"], dica: "Tecnologia é eixo recorrente (2011, 2018)." },
  { eixo: "Educação e evasão escolar", exemplos: ["Desafios para reduzir a evasão escolar no ensino médio brasileiro", "Caminhos para a educação digital nas escolas públicas"], dica: "Educação aparece quase sempre ligada a inclusão." },
  { eixo: "Meio ambiente e emergência climática", exemplos: ["Desafios para a adaptação das cidades brasileiras aos eventos climáticos extremos", "Caminhos para combater o desmatamento e as queimadas no Brasil"], dica: "Eixo ainda pouco explorado em formato direto." },
  { eixo: "Desigualdade e direitos sociais", exemplos: ["Desafios para o combate à insegurança alimentar no Brasil", "Caminhos para garantir moradia digna nas grandes cidades"], dica: "Sempre exige intervenção com agente, ação, meio e finalidade." },
  { eixo: "Gênero, raça e inclusão", exemplos: ["Desafios para a inclusão de pessoas com deficiência no mercado de trabalho", "Caminhos para combater o racismo estrutural no ambiente escolar"], dica: "Eixo muito frequente: prepare repertório sociológico." },
  { eixo: "Desinformação e democracia digital", exemplos: ["Impactos das fake news na democracia brasileira", "Desafios para a educação midiática no Brasil"], dica: "Combina bem com Debord, Bauman e Han." },
  { eixo: "Cultura, leitura e patrimônio", exemplos: ["Desafios para o incentivo à leitura no Brasil", "Caminhos para a preservação do patrimônio cultural brasileiro"], dica: "Cultura apareceu em 2019, 2022 e 2024." },
];

export const LIVROS_AUTORES = [
  // Sociologia e filosofia
  { nome: "Zygmunt Bauman", obra: "Modernidade Líquida", area: "Sociologia", ideia: "Relações, trabalho e identidade frágeis na sociedade de consumo.", serve: ["tecnologia", "consumo", "relações", "trabalho"] },
  { nome: "Hannah Arendt", obra: "Eichmann em Jerusalém (banalidade do mal)", area: "Filosofia", ideia: "A omissão e o 'cumprir ordens' como forma de violência.", serve: ["ética", "violência", "cidadania", "omissão"] },
  { nome: "Michel Foucault", obra: "Vigiar e Punir", area: "Filosofia", ideia: "Vigilância e disciplina dos corpos; base para falar de controle de dados.", serve: ["vigilância", "privacidade", "sistema prisional"] },
  { nome: "Guy Debord", obra: "A Sociedade do Espetáculo", area: "Sociologia", ideia: "As relações sociais mediadas por imagens e aparências.", serve: ["redes sociais", "mídia", "consumo"] },
  { nome: "Byung-Chul Han", obra: "Sociedade do Cansaço", area: "Filosofia", ideia: "Autoexploração, desempenho e adoecimento psíquico.", serve: ["saúde mental", "trabalho", "tecnologia"] },
  { nome: "Pierre Bourdieu", obra: "A Reprodução / capital cultural", area: "Sociologia", ideia: "A escola pode reproduzir desigualdades por meio do capital cultural.", serve: ["educação", "desigualdade"] },
  { nome: "Émile Durkheim", obra: "conceito de anomia", area: "Sociologia", ideia: "Enfraquecimento das normas sociais e dos vínculos coletivos.", serve: ["violência", "saúde mental", "crise de valores"] },
  { nome: "Karl Marx", obra: "alienação do trabalho", area: "Sociologia", ideia: "O trabalhador se distancia do que produz e de si mesmo.", serve: ["trabalho", "desigualdade"] },
  { nome: "Jean-Jacques Rousseau", obra: "Do Contrato Social", area: "Filosofia", ideia: "O Estado existe para garantir o bem comum; sustenta a cobrança por políticas públicas.", serve: ["Estado", "cidadania", "políticas públicas"] },
  { nome: "Thomas Hobbes", obra: "Leviatã", area: "Filosofia", ideia: "Sem Estado forte, prevalece o conflito entre os indivíduos.", serve: ["segurança", "Estado"] },
  { nome: "Immanuel Kant", obra: "imperativo categórico", area: "Filosofia", ideia: "Agir de modo que a ação possa valer como regra universal.", serve: ["ética", "responsabilidade"] },
  { nome: "Platão", obra: "Alegoria da Caverna (A República)", area: "Filosofia", ideia: "Ignorância, aparência e a importância da educação para enxergar a realidade.", serve: ["desinformação", "educação", "fake news"] },
  { nome: "Simone de Beauvoir", obra: "O Segundo Sexo", area: "Filosofia", ideia: "'Não se nasce mulher, torna-se': a construção social do gênero.", serve: ["gênero", "violência contra a mulher", "trabalho de cuidado"] },
  { nome: "Paulo Freire", obra: "Pedagogia do Oprimido", area: "Educação", ideia: "Educação como prática de liberdade e consciência crítica.", serve: ["educação", "cidadania", "desigualdade"] },
  { nome: "Pierre Lévy", obra: "Cibercultura", area: "Tecnologia", ideia: "Inteligência coletiva e transformações da cultura na internet.", serve: ["tecnologia", "internet", "educação digital"] },
  // Brasil
  { nome: "Sérgio Buarque de Holanda", obra: "Raízes do Brasil ('homem cordial')", area: "Sociologia brasileira", ideia: "Relações pessoais se sobrepõem às regras impessoais.", serve: ["cidadania", "corrupção", "ética"] },
  { nome: "Darcy Ribeiro", obra: "O Povo Brasileiro", area: "Antropologia", ideia: "A formação miscigenada do Brasil e suas desigualdades.", serve: ["povos tradicionais", "racismo", "identidade"] },
  { nome: "Milton Santos", obra: "O Espaço do Cidadão", area: "Geografia", ideia: "Cidadania incompleta e desigualdade no acesso aos direitos.", serve: ["cidadania", "cidade", "desigualdade"] },
  { nome: "Djamila Ribeiro", obra: "Pequeno Manual Antirracista / Lugar de Fala", area: "Sociologia", ideia: "Racismo estrutural e a necessidade de ações ativas contra ele.", serve: ["racismo", "herança africana", "igualdade"] },
  { nome: "Silvio Almeida", obra: "Racismo Estrutural", area: "Direito", ideia: "O racismo como parte da organização das instituições.", serve: ["racismo", "desigualdade"] },
  { nome: "Ailton Krenak", obra: "Ideias para Adiar o Fim do Mundo", area: "Pensamento indígena", ideia: "Crítica à relação predatória com a natureza.", serve: ["meio ambiente", "povos indígenas"] },
  { nome: "Davi Kopenawa", obra: "A Queda do Céu", area: "Pensamento indígena", ideia: "Visão yanomami sobre a floresta e o impacto do garimpo.", serve: ["meio ambiente", "povos tradicionais"] },
  // Literatura
  { nome: "Carolina Maria de Jesus", obra: "Quarto de Despejo", area: "Literatura", ideia: "O cotidiano da fome e da pobreza vivido por uma catadora.", serve: ["fome", "desigualdade", "moradia"] },
  { nome: "Graciliano Ramos", obra: "Vidas Secas", area: "Literatura", ideia: "Miséria, seca e falta de acesso à linguagem e à cidadania.", serve: ["desigualdade", "educação", "seca"] },
  { nome: "Conceição Evaristo", obra: "Olhos d'água / Becos da Memória", area: "Literatura", ideia: "Vivências de mulheres negras e da periferia ('escrevivência').", serve: ["racismo", "gênero", "periferia"] },
  { nome: "George Orwell", obra: "1984", area: "Literatura", ideia: "Vigilância total e manipulação da informação.", serve: ["vigilância", "dados", "desinformação"] },
  { nome: "Aldous Huxley", obra: "Admirável Mundo Novo", area: "Literatura", ideia: "Sociedade anestesiada por prazer, consumo e condicionamento.", serve: ["consumo", "tecnologia", "alienação"] },
  { nome: "Ray Bradbury", obra: "Fahrenheit 451", area: "Literatura", ideia: "Desvalorização da leitura e do pensamento crítico.", serve: ["leitura", "cultura", "mídia"] },
  { nome: "Lima Barreto", obra: "Triste Fim de Policarpo Quaresma", area: "Literatura", ideia: "Crítica ao nacionalismo ingênuo e à burocracia.", serve: ["cidadania", "ética"] },
  { nome: "Clarice Lispector", obra: "A Hora da Estrela", area: "Literatura", ideia: "Invisibilidade social de Macabéa.", serve: ["invisibilidade", "pobreza", "gênero"] },
];

export const LEIS_DOCUMENTOS = [
  { nome: "Constituição Federal de 1988", ideia: "Art. 5º (direitos e garantias), art. 6º (direitos sociais), art. 196 (saúde como dever do Estado), art. 205 (educação como direito).", serve: ["quase todos os temas"] },
  { nome: "Declaração Universal dos Direitos Humanos (1948)", ideia: "Dignidade, igualdade e liberdade como direitos de todos.", serve: ["direitos humanos", "cidadania"] },
  { nome: "Lei Maria da Penha (Lei 11.340/2006)", ideia: "Mecanismos para coibir a violência doméstica e familiar contra a mulher.", serve: ["violência contra a mulher"] },
  { nome: "Estatuto da Criança e do Adolescente (Lei 8.069/1990)", ideia: "Proteção integral e prioridade absoluta à infância.", serve: ["infância", "publicidade infantil", "educação"] },
  { nome: "Estatuto da Pessoa Idosa (Lei 10.741/2003)", ideia: "Direitos, proteção e prioridade para pessoas com 60 anos ou mais.", serve: ["envelhecimento", "etarismo"] },
  { nome: "Lei Brasileira de Inclusão (Lei 13.146/2015)", ideia: "Direitos e acessibilidade para pessoas com deficiência.", serve: ["inclusão", "surdos", "acessibilidade"] },
  { nome: "Marco Civil da Internet (Lei 12.965/2014)", ideia: "Princípios de uso da internet, liberdade de expressão e privacidade.", serve: ["internet", "privacidade", "dados"] },
  { nome: "Lei Geral de Proteção de Dados (Lei 13.709/2018)", ideia: "Regras sobre coleta e uso de dados pessoais.", serve: ["dados", "privacidade", "tecnologia"] },
  { nome: "Lei de Cotas (Lei 12.711/2012)", ideia: "Reserva de vagas em instituições federais de ensino.", serve: ["educação", "racismo", "desigualdade"] },
  { nome: "Lei de Diretrizes e Bases da Educação (Lei 9.394/1996)", ideia: "Organiza a educação nacional.", serve: ["educação"] },
];
