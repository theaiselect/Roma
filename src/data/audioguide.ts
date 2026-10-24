// Miniaudioguía (F28): 1–2 minutos por lugar, leída con la voz del móvil.
export interface Track { id: string; placeId: string; title: string; text: string }

export const audioguide: Track[] = [
  {
    id: 'coliseo', placeId: 'colosseo', title: 'El Coliseo',
    text: 'Estáis delante del Anfiteatro Flavio, el nombre que tenía en su época. Lo empezó el emperador Vespasiano hacia el año 70 y lo inauguró su hijo Tito en el año 80 con cien días de juegos. Cabían unas cincuenta mil personas, que entraban por arcos numerados, como las puertas de un estadio actual. Cuando hacía sol se desplegaba un enorme toldo, el velarium, manejado por marineros. Bajo la arena estaba el hipogeo: pasillos, jaulas y montacargas que subían a fieras y gladiadores por trampillas. Los terremotos y siglos de usarlo como cantera se llevaron buena parte de la fachada: muchos palacios e iglesias de Roma están hechos con su piedra. Los agujeros que veis en los muros son las marcas de las grapas de metal que se arrancaron para fundirlas.',
  },
  {
    id: 'foro', placeId: 'foro-romano', title: 'El Foro Romano',
    text: 'Esto era el corazón de la ciudad: mercado, tribunal, parlamento y templo a la vez. Por la Vía Sacra desfilaban los generales victoriosos hacia el Capitolio. Buscad la Curia, el edificio de ladrillo donde se reunía el Senado, y el arco de Septimio Severo. Las columnas que siguen en pie junto al Capitolio son del templo de Saturno, que guardaba el tesoro del Estado. En el templo redondo de Vesta, las vestales mantenían encendido el fuego sagrado de Roma. Y en un pequeño recinto en el centro está el lugar donde se incineró a Julio César en el año 44 antes de Cristo: todavía hoy hay quien le deja flores.',
  },
  {
    id: 'palatino', placeId: 'palatino', title: 'El Palatino',
    text: 'Según la leyenda, en esta colina Rómulo fundó Roma en el año 753 antes de Cristo, después de matar a su hermano Remo. Aquí vivieron después los emperadores, y su residencia, el Palatium, dio nombre a la palabra palacio en casi todas las lenguas europeas. Desde el lado sur se ve el Circo Máximo, donde se corrían las carreras de carros; los emperadores las seguían desde su palco en esta colina.',
  },
  {
    id: 'panteon', placeId: 'pantheon', title: 'El Panteón',
    text: 'La inscripción de la fachada dice que lo hizo Marco Agripa, pero el edificio que veis es una reconstrucción del emperador Adriano, de hacia el año 125. Su cúpula sigue siendo la mayor del mundo hecha de hormigón sin armar, casi dos mil años después. Mide lo mismo de alto que de ancho, unos 43 metros: dentro cabría una esfera perfecta. La única luz entra por el óculo, de unos nueve metros; cuando llueve, el agua cae al suelo y se va por pequeños desagües. Se salvó porque en el año 609 se convirtió en iglesia. Aquí está enterrado Rafael.',
  },
  {
    id: 'trevi', placeId: 'trevi', title: 'La Fontana di Trevi',
    text: 'La fuente marca el final del acueducto del Aqua Virgo, que Agripa construyó en el año 19 antes de Cristo y que todavía trae agua. La fachada barroca es obra de Nicola Salvi y se terminó en 1762. En el centro, Océano sobre su carro de concha, tirado por caballos marinos: uno tranquilo y otro desbocado, el mar en calma y el mar en tormenta. Fellini la hizo eterna en «La dolce vita».',
  },
  {
    id: 'espana', placeId: 'piazza-spagna', title: 'Plaza de España',
    text: 'La plaza se llama así por la embajada de España ante la Santa Sede, que sigue aquí desde el siglo diecisiete. La escalinata, de 135 escalones, se construyó entre 1723 y 1725 para unir la plaza con la iglesia de Trinità dei Monti. Abajo, la fuente de la Barcaccia, con forma de barca medio hundida, es de Pietro Bernini y su hijo Gian Lorenzo. Recordad: aquí no se puede sentar nadie.',
  },
  {
    id: 'navona', placeId: 'navona', title: 'Piazza Navona',
    text: 'Fijaos en la forma alargada de la plaza: es exactamente la del estadio que el emperador Domiciano construyó aquí en el siglo primero; las casas se levantaron sobre sus gradas. En el centro, la fuente de los Cuatro Ríos de Bernini, de 1651, con el Nilo, el Ganges, el Danubio y el Río de la Plata. Dice una leyenda, falsa pero divertida, que el Nilo se tapa los ojos para no ver la fachada de Sant’Agnese, obra de su rival Borromini.',
  },
  {
    id: 'castel', placeId: 'castel-santangelo', title: 'Castel Sant’Angelo',
    text: 'Empezó siendo la tumba del emperador Adriano, terminada en el año 139. Después fue fortaleza, cárcel y refugio de los papas, unido al Vaticano por un pasadizo elevado, el Passetto. Por él escapó el papa Clemente VII durante el saqueo de Roma de 1527. Desde la terraza, una de las mejores vistas de la ciudad, con San Pedro a un lado y el Tíber a los pies.',
  },
  {
    id: 'sanpedro', placeId: 'san-pietro', title: 'La Basílica de San Pedro',
    text: 'Se levantó entre 1506 y 1626 sobre la basílica que Constantino había construido encima de la tumba de San Pedro. Trabajaron en ella Bramante, Rafael, Miguel Ángel, que diseñó la cúpula, y Bernini, autor del baldaquino de bronce y de la columnata de la plaza, que abraza a quien llega como dos brazos. A la derecha al entrar está la Piedad de Miguel Ángel, que la esculpió con unos veinticuatro años: es la única obra que firmó, en la banda que cruza el pecho de la Virgen.',
  },
  {
    id: 'bocca', placeId: 'bocca-verita', title: 'La Boca de la Verdad',
    text: 'Es un gran disco de mármol con la cara de un dios, probablemente una tapa de alcantarilla o parte de una fuente de época romana. Está en el pórtico de Santa Maria in Cosmedin desde el siglo diecisiete. La leyenda de que muerde a los mentirosos es medieval, y el cine la hizo famosa con Gregory Peck y Audrey Hepburn en «Vacaciones en Roma».',
  },
  {
    id: 'popolo', placeId: 'piazza-popolo', title: 'Piazza del Popolo',
    text: 'Era la entrada norte de Roma para quien llegaba por la Vía Flaminia. El obelisco del centro lo trajo de Egipto el emperador Augusto. Las dos iglesias gemelas que abren las tres calles hacia el centro parecen iguales, pero no lo son. En Santa Maria del Popolo, en la capilla Cerasi, a la izquierda del altar mayor, hay dos cuadros de Caravaggio: la Conversión de San Pablo y la Crucifixión de San Pedro.',
  },
  {
    id: 'gianicolo', placeId: 'gianicolo', title: 'El Gianicolo',
    text: 'La fuente del Acqua Paola, que los romanos llaman el Fontanone, se construyó para el papa Pablo V a principios del siglo diecisiete. Desde aquí tenéis Roma entera a vuestros pies: buscad las cúpulas y el Vittoriano blanco. En esta colina Garibaldi defendió la República Romana en 1849, y cada día a mediodía todavía se dispara un cañonazo de salva.',
  },
];
