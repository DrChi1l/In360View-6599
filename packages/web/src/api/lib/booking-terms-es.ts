/**
 * Spanish courtesy translation of the booking terms and the privacy &
 * data-retention notice in ./booking-terms.ts. Same structure, same section
 * ids, same version strings — the English text governs. Whenever the English
 * wording changes in substance, update this file in the same change.
 */
import {
  COMPLETED_RETENTION_YEARS,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  UNCONFIRMED_RETENTION_MONTHS,
  type LegalBlock,
  type LegalSection,
} from "./booking-terms";

export const LEGAL_UPDATED_ES = "11 de octubre de 2026";

/** Shown above the Spanish text wherever it appears. */
export const TRANSLATION_NOTICE_ES =
  "Esta es una traducción de cortesía. El contrato se rige por la versión en inglés, que prevalece en caso de discrepancia.";

const p = (text: string): LegalBlock => ({ kind: "p", text });
const list = (...items: string[]): LegalBlock => ({ kind: "list", items });

export const KEY_POINTS_ES: string[] = [
  "Enviar este formulario es una solicitud de reserva. El contrato solo existe cuando confirmamos la visita por correo electrónico.",
  "No se cobra nada por internet. Las tarifas son las de nuestra lista de precios vigente o las de un presupuesto por escrito, y se facturan después de la visita, con pago a 14 días.",
  "Cancelar con menos de 24 horas de antelación puede costar el 50 % de la tarifa; una visita que no podamos realizar por problemas de acceso puede cobrarse íntegramente.",
  "Usamos sus datos, los del inmueble y los de cualquier inquilino únicamente para organizar y realizar el inventario o la inspección, elaborar el informe y atender consultas o disputas sobre él.",
  `Las solicitudes de reserva que no siguen adelante se eliminan automáticamente a los ${UNCONFIRMED_RETENTION_MONTHS} meses. Las reservas confirmadas y los informes que generan se conservan durante ${COMPLETED_RETENTION_YEARS} años, porque los informes se utilizan como prueba en disputas sobre fianzas y reclamaciones, y después se eliminan.`,
  "Nunca vendemos sus datos ni los usamos con fines comerciales, y puede pedirnos en cualquier momento que los consultemos, corrijamos o eliminemos.",
];

export const BOOKING_TERMS_ES: LegalSection[] = [
  {
    id: "about",
    title: "1. Quiénes somos y estas condiciones",
    blocks: [
      p(
        `Estas condiciones se aplican cuando reserva un inventario, una entrada (check-in), una salida (check-out) o una inspección con In360View ("nosotros") a través de este sitio web. Puede contactarnos por correo electrónico en ${CONTACT_EMAIL} o por teléfono en el ${CONTACT_PHONE}.`,
      ),
      p(
        '"Usted" es la persona que envía la reserva: un propietario, una agencia de alquiler o de gestión, o alguien autorizado para actuar en su nombre. Si reserva en nombre de una empresa o de otra persona, confirma que tiene autoridad para aceptar estas condiciones en su nombre.',
      ),
      p(
        "Algunas partes de estas condiciones se aplican de forma distinta según sea usted un consumidor (un particular que reserva con fines ajenos a una actividad comercial o empresarial, como un propietario particular que alquila una sola vivienda) o una empresa. Cuando una cláusula se aplica solo a uno de ellos, así se indica.",
      ),
    ],
  },
  {
    id: "booking",
    title: "2. Solicitudes de reserva y confirmación",
    blocks: [
      p(
        "Enviar el formulario de reserva es una solicitud de visita; no es una cita garantizada. La fecha y la hora que elija son su franja preferida.",
      ),
      p(
        "El contrato entre usted y nosotros solo se forma cuando le confirmamos la reserva por correo electrónico. Podemos ofrecerle otra fecha u hora, pedirle más información o rechazar una solicitud, por ejemplo si el inmueble está fuera de nuestra zona de servicio o no hay ningún inspector disponible. Si la rechazamos, no se forma ningún contrato y no tiene que pagar nada.",
      ),
      p(
        "Revise los datos de su confirmación y avísenos de inmediato si algo es incorrecto. Tenemos derecho a basarnos en la información que nos facilite.",
      ),
    ],
  },
  {
    id: "services",
    title: "3. Nuestros servicios",
    blocks: [
      p(
        "Elaboramos registros escritos y fotográficos del estado, la limpieza y el contenido de viviendas de alquiler, incluidos inventarios, informes de entrada, inspecciones intermedias e informes de salida, junto con cualquier extra que solicite, como visitas virtuales en 360°.",
      ),
      p(
        "Nuestras inspecciones son visuales y no invasivas. No movemos muebles pesados ni pertenencias, no levantamos revestimientos de suelo, no desmontamos nada ni accedemos a desvanes, sótanos o zonas a las que no se pueda llegar con seguridad desde el nivel del suelo. Un informe no es un estudio estructural, una tasación ni un certificado de gas, electricidad, seguridad contra incendios, legionela, HHSRS u otra normativa. El descargo de responsabilidad completo, los avisos de seguridad y las condiciones del informe se incluyen en cada informe y forman parte de estas condiciones.",
      ),
      p(
        "Prestamos nuestros servicios con un cuidado y una pericia razonables. Cuando dejamos constancia de que un elemento no se probó o no pudo inspeccionarse, no somos responsables de su estado.",
      ),
    ],
  },
  {
    id: "responsibilities",
    title: "4. Sus responsabilidades",
    blocks: [
      p("Para que podamos realizar la visita, usted se compromete a:"),
      list(
        "facilitar información exacta y completa, incluida la dirección completa con código postal, el número de dormitorios y baños, el nivel de amueblado y el tipo de informe que necesita;",
        "asegurarse de que es el propietario del inmueble o de que el propietario le ha autorizado a contratarnos;",
        "organizar un acceso legal: si el inmueble está ocupado, dar al inquilino u ocupante el preaviso que exijan su contrato de arrendamiento y la ley (normalmente al menos 24 horas por escrito para una inspección rutinaria) e informarle de la visita;",
        "proporcionar llaves que funcionen, los códigos de acceso necesarios e instrucciones claras sobre dónde recogerlas y devolverlas;",
        "asegurarse de que es seguro entrar en el inmueble, con iluminación en funcionamiento y, siempre que sea posible, con luz y agua conectadas;",
        "avisarnos con antelación de cualquier cosa que pueda afectar a la seguridad o al acceso, como animales, alarmas, obras, peligros u ocupantes que puedan necesitar apoyo;",
        "en una salida, facilitar el inventario o el informe de entrada correspondiente. Si no se facilita, utilizaremos el más reciente que tengamos registrado y podremos cobrar los costes adicionales razonables de cualquier nueva visita o reelaboración causada por un informe ausente o incorrecto.",
      ),
    ],
  },
  {
    id: "keys",
    title: "5. Llaves y datos de acceso",
    blocks: [
      p(
        "Cuidamos razonablemente las llaves, los mandos y la información de acceso que se nos confían y los usamos solo para realizar su reserva. Las llaves se devuelven según lo acordado por escrito. Salvo acuerdo distinto por escrito, no somos responsables de las pérdidas causadas por dejar o recoger llaves de un tercero que usted designe.",
      ),
      p(
        "Comparta los códigos de alarma o de cajas de llaves solo cuando sean necesarios para la visita, y cámbielos una vez terminada la visita o el cambio de inquilino.",
      ),
    ],
  },
  {
    id: "prices",
    title: "6. Precios y pago",
    blocks: [
      p(
        "No se cobra nada al reservar. Nuestras tarifas son las que figuran en la lista de precios vigente de este sitio web, o en un presupuesto por escrito, en el momento en que confirmamos su reserva. Se aplican cargos adicionales, por ejemplo por visitas en el mismo día, dormitorios o baños adicionales, desplazamientos fuera de nuestra zona habitual, nuevas visitas o inmuebles grandes y HMO (viviendas compartidas), según la lista de precios o lo acordado con usted antes de la visita.",
      ),
      p(
        "Le enviaremos la factura después de la visita. Las facturas deben pagarse en un plazo de 14 días. Si una factura no se paga a tiempo, podemos suspender otros trabajos y, en el caso de clientes empresariales, reclamar intereses y compensación según lo permitido por la Late Payment of Commercial Debts (Interest) Act 1998.",
      ),
    ],
  },
  {
    id: "cancellation",
    title: "7. Cambios, cancelaciones y visitas fallidas",
    blocks: [
      p(
        `Puede pedir cambiar o cancelar una reserva en cualquier momento escribiendo a ${CONTACT_EMAIL} o llamando al ${CONTACT_PHONE}. No hay ningún cargo si nos avisa con al menos 24 horas de antelación respecto a la cita confirmada.`,
      ),
      list(
        "Cancelar o cambiar la fecha con menos de 24 horas de antelación puede cobrarse al 50 % de la tarifa acordada, para cubrir el tiempo del inspector que ya no puede volver a reservarse.",
        "Si el inspector acude pero no puede realizar la visita —porque no hay llaves, se niega o se retrasa el acceso más de 30 minutos, o el inmueble no es seguro—, la visita puede considerarse fallida y cobrarse con la tarifa completa.",
        "Es posible que tengamos que reorganizar una visita por enfermedad, mal tiempo grave u otros hechos fuera de nuestro control razonable. En ese caso se lo comunicaremos lo antes posible y le ofreceremos otra franja; si no le conviene, podrá cancelar sin cargo.",
      ),
      p(
        "Estos cargos reflejan una estimación real de nuestra pérdida y no afectan a sus derechos legales como consumidor descritos en la sección 8.",
      ),
    ],
  },
  {
    id: "consumer",
    title: "8. Su derecho de desistimiento si es consumidor",
    blocks: [
      p(
        "Si es usted consumidor, las Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 le dan derecho a cancelar este contrato en un plazo de 14 días desde el día en que confirmamos su reserva, sin necesidad de justificación. Para cancelar, comuníquenoslo claramente por correo electrónico o por teléfono usando los datos de contacto indicados arriba.",
      ),
      p(
        "Si nos pide que realicemos la visita dentro de esos 14 días, nos está pidiendo que empecemos a prestar el servicio durante el plazo de desistimiento. Si después cancela una vez iniciada la visita pero antes de que el informe esté terminado, deberá pagar una cantidad proporcional al servicio prestado hasta el momento en que nos lo comunique. Una vez prestado el servicio por completo, el derecho de desistimiento deja de aplicarse.",
      ),
      p(
        "Nada de lo dispuesto en estas condiciones afecta a sus derechos legales como consumidor, incluidos sus derechos según la Consumer Rights Act 2015 a que los servicios se presten con un cuidado y una pericia razonables.",
      ),
    ],
  },
  {
    id: "reports",
    title: "9. Informes, plazo de revisión y revisión del inquilino",
    blocks: [
      p(
        "Procuramos emitir los informes con rapidez después de la visita. Puede pedirnos que corrijamos una inexactitud de hecho en un plazo de siete (7) días desde la emisión del informe. Pasado ese plazo, el informe se considera aceptado por quienes lo recibieron, esté firmado o no. Una vez firmado, el informe queda bloqueado; cualquier corrección posterior se emite como un anexo independiente y referenciado.",
      ),
      p(
        "Si nos lo pide, enviaremos al inquilino un enlace seguro de revisión para que pueda añadir comentarios, fotografías y su firma. La respuesta del inquilino se guarda junto al registro original del inspector y nunca lo modifica.",
      ),
      p(
        "Los informes pueden compartirse con el propietario, el inquilino, la agencia gestora, el árbitro de un sistema de protección de fianzas, una aseguradora o un tribunal. No deben editarse, cambiarse de marca ni publicarse parcialmente de forma que tergiverse sus conclusiones.",
      ),
    ],
  },
  {
    id: "liability",
    title: "10. Nuestra responsabilidad",
    blocks: [
      p(
        "Somos responsables de las pérdidas o daños que sufra y que sean una consecuencia previsible de que incumplamos estas condiciones o no actuemos con un cuidado y una pericia razonables. No somos responsables de pérdidas imprevisibles, de cuestiones excluidas por el descargo de responsabilidad del informe, de defectos latentes u ocultos ni del resultado de una disputa sobre la fianza, que decide el árbitro o el tribunal.",
      ),
      p(
        "Si es usted un cliente empresarial, no somos responsables de la pérdida de beneficios, rentas, negocio u oportunidades, ni de pérdidas indirectas o consecuentes, y nuestra responsabilidad total derivada de una reserva se limita a la tarifa pagada o pagadera por esa reserva.",
      ),
      p(
        "Nada de lo dispuesto en estas condiciones limita ni excluye la responsabilidad por muerte o lesiones personales causadas por negligencia, por fraude o declaración fraudulenta, ni cualquier otra responsabilidad que no pueda limitarse o excluirse legalmente.",
      ),
    ],
  },
  {
    id: "complaints",
    title: "11. Reclamaciones",
    blocks: [
      p(
        `Si no está satisfecho con nuestro servicio, contacte con nosotros en ${CONTACT_EMAIL}. Acusaremos recibo de su reclamación en un plazo de cinco días hábiles y le daremos una respuesta completa en un plazo de 21 días. Si no podemos resolverla, le informaremos de cualquier sistema de resolución de conflictos a su disposición.`,
      ),
    ],
  },
  {
    id: "data",
    title: "12. Datos personales",
    blocks: [
      p(
        "Tratamos los datos personales de su reserva tal como se describe en el Aviso de Privacidad y Conservación de Datos que figura a continuación, que forma parte de la información que declara haber leído al reservar.",
      ),
    ],
  },
  {
    id: "general",
    title: "13. Disposiciones generales",
    blocks: [
      p(
        "A cada reserva se le aplica la versión de estas condiciones que se muestra en el momento de enviarla. Podemos actualizar estas condiciones para futuras reservas; la fecha y la versión figuran en la parte superior.",
      ),
      p(
        "Si alguna parte de estas condiciones se declara inaplicable, el resto sigue en vigor. Nadie más que usted y nosotros tiene derecho a hacer cumplir estas condiciones. Si no exigimos el cumplimiento de una cláusula de inmediato, podemos exigirlo más adelante.",
      ),
      p(
        "Estas condiciones se rigen por la legislación de Inglaterra y Gales, y los tribunales de Inglaterra y Gales son competentes. Si es usted un consumidor residente en Escocia o Irlanda del Norte, también puede acudir a los tribunales de su lugar de residencia.",
      ),
    ],
  },
];

export const PRIVACY_NOTICE_ES: LegalSection[] = [
  {
    id: "who",
    title: "1. Quién es responsable de sus datos",
    blocks: [
      p(
        `In360View es el responsable del tratamiento de los datos personales enviados a través de este formulario de reserva y utilizados para gestionarla. Si tiene alguna pregunta sobre sus datos, contacte con nosotros en ${CONTACT_EMAIL} o en el ${CONTACT_PHONE}.`,
      ),
      p(
        "Cuando una agencia de alquiler o un propietario nos encarga un informe sobre un arrendamiento, ese cliente decide por lo general para qué se necesitan los registros del arrendamiento y actúa como responsable de los datos del informe, y nosotros los tratamos siguiendo sus instrucciones. En ambos casos cumplimos el Reglamento General de Protección de Datos del Reino Unido (UK GDPR) y la Data Protection Act 2018.",
      ),
    ],
  },
  {
    id: "collect",
    title: "2. Qué datos recogemos",
    blocks: [
      list(
        "Sus datos: nombre, correo electrónico y teléfono y, en su caso, la organización a la que representa.",
        "Datos del inmueble y de la reserva: la dirección del inmueble, el nivel de amueblado, el tipo de servicio, la fecha y hora preferidas y cualquier indicación sobre llaves o acceso que nos dé.",
        "Datos del inquilino u ocupante, si decide facilitarlos: nombre, correo electrónico y teléfono.",
        "Un registro de su aceptación: las versiones de estas condiciones y de este aviso que aceptó, y la fecha y hora en que lo hizo.",
        "Información generada al prestar el servicio: fotografías y vídeo del inmueble (que pueden mostrar de forma incidental objetos personales), anotaciones escritas sobre el estado, lecturas de contadores, firmas y cualquier comentario o fotografía que añada un inquilino mediante un enlace de revisión.",
        "Nuestra correspondencia con usted y los registros de facturación y pago.",
      ),
      p(
        "No incluya información sensible —por ejemplo sobre salud, discapacidad o las circunstancias de cualquier persona— en los campos de texto libre salvo que sea realmente necesaria para la visita, como la petición de un ocupante que necesite apoyo. Si lo hace, la usaremos únicamente para organizar la visita de forma segura.",
      ),
    ],
  },
  {
    id: "why",
    title: "3. Para qué los usamos y nuestra base jurídica",
    blocks: [
      {
        kind: "table",
        head: ["Finalidad", "Base jurídica según el UK GDPR"],
        rows: [
          [
            "Revisar su solicitud, confirmar la visita, contactar con usted y realizar el inventario o la inspección",
            "Ejecución de un contrato con usted, o adopción de las medidas que nos pida antes de celebrarlo (artículo 6(1)(b)). Si reserva para una empresa, nuestro interés legítimo en prestar el servicio a nuestro cliente (artículo 6(1)(f)).",
          ],
          [
            "Contactar con un inquilino u ocupante sobre el acceso y, si nos lo pide, enviarle un enlace de revisión",
            "Intereses legítimos, nuestros y suyos, en organizar el acceso y elaborar un registro exacto y justo del inmueble (artículo 6(1)(f)).",
          ],
          [
            "Conservar informes, fotografías y firmas para que puedan utilizarse en disputas sobre fianzas, reclamaciones de seguros o procedimientos judiciales",
            "Intereses legítimos en formular, ejercer o defender reclamaciones (artículo 6(1)(f)).",
          ],
          [
            "Conservar un registro de las condiciones que aceptó",
            "Intereses legítimos en poder demostrar qué se acordó y cuándo (artículo 6(1)(f)).",
          ],
          [
            "Facturación, contabilidad y registros fiscales",
            "Obligación legal (artículo 6(1)(c)) y ejecución de nuestro contrato con usted.",
          ],
        ],
      },
      p(
        "No nos basamos en el consentimiento para estas finalidades, porque el tratamiento es necesario para prestar el servicio que reserva. Marcar la casilla en la ventana de reserva confirma que ha leído este aviso —incluido cuánto tiempo conservamos sus datos— y que acepta las condiciones de reserva. No limita ninguno de los derechos que se indican más abajo.",
      ),
      p(
        "No vendemos datos personales, no los usamos con fines comerciales ni tomamos decisiones sobre nadie basadas únicamente en un tratamiento automatizado.",
      ),
    ],
  },
  {
    id: "third-party",
    title: "4. Datos de inquilinos y otros terceros",
    blocks: [
      p(
        "Si nos facilita datos de un inquilino, ocupante u otra persona, confirma que tiene derecho a compartirlos con nosotros para esta finalidad y que informará a esa persona de que sus datos se han comunicado a In360View y de dónde puede leer este aviso. Facilite solo los datos que necesitamos para organizar el acceso y, si se solicita, enviar un enlace de revisión.",
      ),
    ],
  },
  {
    id: "share",
    title: "5. Con quién los compartimos",
    blocks: [
      list(
        "Las partes del informe según sus instrucciones: el propietario, la agencia gestora o de alquiler y el inquilino.",
        "Proveedores que gestionan nuestros sistemas siguiendo nuestras instrucciones y bajo contrato, como proveedores de alojamiento web, bases de datos, almacenamiento seguro de archivos y envío de correo electrónico.",
        "Sistemas de protección de fianzas y sus árbitros, aseguradoras, tribunales y nuestros asesores profesionales, cuando se necesite un informe o registro para resolver una disputa o reclamación.",
        "Organismos reguladores, la policía u otras autoridades cuando la ley nos lo exija.",
      ),
      p(
        "Algunos de nuestros proveedores pueden almacenar o tratar datos fuera del Reino Unido. En ese caso, nos aseguramos de que la transferencia esté amparada por una decisión de adecuación del Reino Unido o por garantías adecuadas, como el UK International Data Transfer Agreement o su Addendum.",
      ),
    ],
  },
  {
    id: "retention",
    title: "6. Cuánto tiempo los conservamos",
    blocks: [
      p(
        "Conservamos los datos personales solo mientras los necesitamos para prestar el servicio y para atender después consultas o disputas sobre el informe. Las disputas sobre fianzas y las reclamaciones pueden surgir años después de una visita —por lo general, una reclamación por incumplimiento de contrato puede presentarse durante un máximo de seis años—, y por eso los registros completados se conservan durante ese periodo.",
      ),
      {
        kind: "table",
        head: ["Registro", "Cuánto tiempo lo conservamos"],
        rows: [
          [
            "Solicitudes de reserva que nunca se confirman, se rechazan o no siguen adelante",
            `${UNCONFIRMED_RETENTION_MONTHS} meses desde la fecha de envío de la solicitud; después se eliminan automáticamente.`,
          ],
          [
            "Registros de reservas confirmadas y completadas, incluido el registro de su aceptación",
            `${COMPLETED_RETENTION_YEARS} años desde la última actualización de la reserva (normalmente, la finalización del servicio); después se eliminan automáticamente.`,
          ],
          [
            "Informes de inventario e inspección, fotografías, firmas, comentarios de inquilinos y los datos del inmueble y de contacto relacionados",
            `${COMPLETED_RETENTION_YEARS} años desde el final del arrendamiento al que se refieren o, si no se nos informa de cuándo terminó, desde la fecha del informe. Revisamos estos registros al menos una vez al año y después los eliminamos o anonimizamos de forma segura.`,
          ],
          [
            "Correos electrónicos y correspondencia sobre reservas",
            "Durante el mismo periodo que la reserva o el informe a los que se refieren; después se eliminan.",
          ],
          [
            "Facturas y registros contables",
            "Durante el tiempo que exija la normativa fiscal y mercantil, normalmente seis años desde el final del ejercicio al que se refieren.",
          ],
        ],
      },
      p(
        "Solo podemos conservar un registro durante más tiempo cuando sea necesario para una disputa, reclamación, demanda o investigación en curso, o cuando la ley lo exija, y únicamente hasta que ese asunto concluya. Los datos eliminados pueden permanecer durante poco tiempo en copias de seguridad cifradas hasta que se sobrescriban en el ciclo normal de copias; mientras tanto no se usan ni se restauran.",
      ),
    ],
  },
  {
    id: "security",
    title: "7. Cómo los protegemos",
    blocks: [
      p(
        "Los datos se envían mediante conexiones cifradas y se almacenan con proveedores que aplican medidas de seguridad estándar del sector. El acceso se limita a las personas que lo necesitan para hacer nuestro trabajo. Los enlaces de revisión para inquilinos contienen un código imposible de adivinar, y solo se guarda una versión cifrada (hash) de ese código.",
      ),
    ],
  },
  {
    id: "rights",
    title: "8. Sus derechos",
    blocks: [
      p("Usted —y cualquier inquilino u otra persona cuyos datos se nos faciliten— tiene derecho a:"),
      list(
        "pedir una copia de los datos personales que tenemos sobre usted;",
        "pedirnos que corrijamos datos inexactos o incompletos;",
        "pedirnos que eliminemos sus datos o que limitemos su uso;",
        "oponerse al uso de sus datos cuando nos basamos en intereses legítimos;",
        "pedirnos que transfiramos a otra organización los datos que nos facilitó, cuando proceda.",
      ),
      p(
        `Para ejercer cualquiera de estos derechos, escriba a ${CONTACT_EMAIL}. Le responderemos en el plazo de un mes. Algunos derechos tienen límites —por ejemplo, puede que tengamos que conservar un informe firmado para resolver una disputa sobre la fianza en curso— y, si es así, le explicaremos el motivo. Cuando tratamos datos de informes por cuenta de una agencia de alquiler o un propietario, podemos trasladarle su solicitud y ayudarle a responder.`,
      ),
    ],
  },
  {
    id: "complain",
    title: "9. Reclamaciones sobre datos",
    blocks: [
      p(
        "Si no está satisfecho con el tratamiento que hemos dado a sus datos, contacte primero con nosotros para que podamos intentar solucionarlo. También tiene derecho a presentar una reclamación ante la Information Commissioner's Office (ICO), la autoridad de protección de datos del Reino Unido, en ico.org.uk o en el 0303 123 1113.",
      ),
    ],
  },
  {
    id: "changes",
    title: "10. Cambios en este aviso",
    blocks: [
      p(
        "Actualizaremos este aviso si cambia la forma en que usamos los datos personales. La versión y la fecha figuran en la parte superior, y cada reserva registra la versión vigente cuando se hizo.",
      ),
    ],
  },
];
