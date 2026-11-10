# Convocatoria de streamers

English: [../TOURNAMENT_CALL.md](../TOURNAMENT_CALL.md)

La convocatoria es una página informativa independiente del torneo operativo. Su ruta es `/convocatorias/fortnite-streamers`; la guía pública está en `/docs/convocatorias`. El organizador seguirá creando las partidas y la clasificación desde `/features/torneos`.

## Preparar el contenido

El dueño de la plataforma entra en `/admin/convocatorias`, también disponible desde el hub de administración. La primera pestaña, **Guía**, explica los pasos. En **Contenido** puede cargar una propuesta inicial, editar título, presentación, descripción de imagen y requisitos en español e inglés, y seleccionar una portada real.

Se incluye una captura ilustrativa del mapa de Fortnite procedente de la [ficha oficial de Epic Games](https://store.epicgames.com/p/fortnite). No representa un mapa confirmado para la futura jornada. También se pueden elegir imágenes PNG, JPG o WebP de la biblioteca de `/admin/brand`. Antes de publicar, verificar los permisos de uso; registrar autor y fuente HTTPS. La interfaz exige una descripción de imagen en ambos idiomas.

Los colores, tipografía y formas se reutilizan desde `/admin/estilo`; el logo público respeta `/admin/brand`. La página pública mantiene tema oscuro y el editor sigue el tema de la aplicación.

## Borrador y publicación

**Guardar borrador** conserva los cambios sin modificar la versión pública. **Ver borrador** muestra una vista previa con el contenido actual. Se debe guardar antes de publicar. **Publicar página informativa** copia el borrador guardado a la versión pública; **Retirar publicación** oculta la página y conserva el borrador. Si otra sesión cambió el contenido, hay que recargar antes de guardar para no sobrescribirla.

Sin versión publicada, el público ve un aviso de convocatoria no publicada. Si la carga falla, puede volver a intentar. El borrador no se entrega desde la API pública. Las operaciones administrativas exigen sesión y el permiso de dueño de sistema en el servidor.

## Alcance actual

La información inicial muestra solitario, cero construcción, servidor Brasil, uso del bot y transmisión durante el torneo. La base declarada por el organizador es US$30 y objetos regalables hasta 2.800 paVos; el reparto sigue pendiente. Dinero y objetos se presentan por separado.

Los enlaces **Quiero participar** y **Quiero colaborar** llevan a sus secciones. Cuando el dueño abre las solicitudes, las personas con sesión pueden completar el formulario correspondiente. Los aportes se habilitan por separado. El botón **Colaborar** abre un panel dentro de la propia convocatoria: el dinero se paga ahí, sin esperar aprobación, y paVos, tarjetas y regalos se ofrecen con una solicitud. El flujo libre de `/supporters?call=fortnite-streamers#donar` sigue disponible como respaldo y conserva el destino de la convocatoria; la donación general de `/supporters` sigue independiente. Un cobro no confirma automáticamente disponibilidad para premios.

## Solicitudes y revisión

Publicar el contenido no abre las solicitudes. En la pestaña **Guía**, el dueño puede abrirlas después de publicar y cerrarlas cuando lo necesite. Retirar la publicación también cierra las solicitudes. El estado inicial es cerrado.

La solicitud usa la identidad autenticada y sus canales propios de Twitch o Kick vinculados. No utiliza el canal seleccionado para moderar. Si hay varios canales propios, se elige uno. El contacto disponible se propone para completar el formulario; el solicitante puede corregirlo. La cuenta de Epic y la inscripción definitiva pertenecen al paso posterior del torneo.

Un interesado declara que usa el bot y que transmitirá durante el torneo. Esa declaración no certifica automáticamente su actividad. Un colaborador ofrece paVos o una tarjeta regalo, con cantidad, moneda cuando corresponda y cómo puede difundir la iniciativa, y acepta el aviso de custodia (ver más abajo). El dinero ya no se ofrece con este formulario: se aporta pagando. Las solicitudes de dinero que ya existían se conservan y se pueden seguir editando. La oferta no cobra dinero ni se suma a los premios.

Las solicitudes quedan pendientes. El dueño las consulta en **Interesados** o **Colaboradores**, filtra por estado y aprueba, rechaza o devuelve a pendiente con un comentario visible para el solicitante. Aprobar una solicitud no confirma cupo final, uso verificado del bot ni recepción del aporte.

El solicitante puede consultar su estado, actualizar la solicitud o retirarla. Una actualización devuelve la solicitud a pendiente y oculta su ficha hasta una nueva aprobación. Retirarla oculta la ficha y el dueño no puede aprobar esa solicitud retirada; la persona puede volver a enviarla mientras las solicitudes estén abiertas. Cuando se cierran, aún puede consultar o retirar la solicitud desde la página publicada.

Solo se muestran nombre, imagen y canal si la solicitud está aprobada y la persona autorizó su publicación. El contacto, notas, moneda e importe ofrecido no salen por la API pública. La ficha de colaborador indica que su solicitud fue revisada; no lo presenta como un aporte recibido. Se conserva una copia de los requisitos aceptados y se rechaza un envío si cambió el contenido publicado desde que se abrió la página.

## Aporte directo de dinero

El dinero no necesita aprobación. La persona pulsa **Colaborar**, elige la pestaña **Dinero**, indica el importe USD de referencia y paga con Culqi sin salir de la página, con un solo botón **Pagar**. Sin sesión, el aporte es anónimo y no crea ficha. Con sesión, elige su canal propio y puede marcar «quiero aparecer como colaborador»: el nombre propuesto es el de su canal y puede editarse.

Al completarse el cobro, el servidor une el pago a la ficha de colaborador de esa persona. Si no tenía ficha de colaborador, crea una pendiente con origen «creada por un pago». Si ya tenía una enviada por formulario, la liga sin modificarla ni aprobarla. La unión es accesoria: si falla, el pago queda registrado igualmente, el organizador sigue viendo quién pagó y, al confirmar la recepción, la unión se repara sola. Nunca se repite un cobro.

El organizador ve en **Aportes** el nombre de la cuenta y el canal de quien pagó con sesión, y en **Colaboradores** los aportes ligados a cada ficha. Al **confirmar la recepción** de un aporte ligado, la ficha creada por ese pago pasa a aprobada, y es pública solo si la persona lo autorizó al pagar. Si el aporte se revierte y no queda otro confirmado, la ficha vuelve a pendiente. Retirar la identidad pública desde el recibo oculta esa ficha. Un pago de prueba nunca se confirma ni aprueba una ficha. Las fichas enviadas por formulario no se aprueban solas.

Quien tiene sesión ve **Mis aportes y mi solicitud** en la convocatoria: estado de su ficha y de cada aporte (con etiqueta de prueba), y los montos recibidos y destinados a premios solo después de la confirmación. No depende del recibo guardado en una pestaña. No hay notificación automática: el estado se ve al volver a la página.

### Enlace al torneo y estado del bot

En la pestaña **Guía**, el campo **Enlace a la inscripción del torneo** acepta solo una ruta interna `/torneos/<canal>/<edición>` (por ejemplo `/torneos/pixipnj/decatron-streamers-cup`); cualquier otra cosa se rechaza. Con el enlace y las solicitudes abiertas, la convocatoria muestra el botón **Inscribirme en el torneo**, que lleva a la inscripción oficial; el formulario de interés sigue disponible. En **Interesados**, cada solicitud indica si el bot está **encendido** o **apagado** en el canal del solicitante, o «sin dato». Es solo el interruptor del bot: no demuestra que lo use, y la revisión del uso sigue siendo manual. El estado solo lo ve el organizador.

## Custodia de paVos, tarjetas y regalos

Los aportes en paVos, tarjetas o regalos quedan bajo custodia del colaborador que los ofrece: él los gestiona y los entrega al ganador según lo que acuerden. El organizador y Decatron muestran lo que el colaborador declara, pero no custodian ni entregan estos premios. El dinero cobrado con la pasarela lo recibe y administra el organizador.

Al ofrecerlos se muestra el aviso de custodia y se exige aceptarlo con una casilla. Se guarda la fecha y la versión exacta del texto aceptado; si el texto cambia de versión, un formulario abierto con el texto anterior se rechaza hasta recargar. Mostrar la cantidad públicamente es un consentimiento aparte (solo disponible si la ficha pública está autorizada) y no se reutiliza del consentimiento de la ficha.

Los paVos no se pueden regalar directamente en Fortnite: solo se regalan objetos de la Tienda de Objetos del día o tarjetas de regalo, con autenticación en dos pasos, nivel 2 o superior, amistad de al menos 2 días y un máximo de 5 regalos cada 24 horas. El formulario lo recuerda al ofrecer paVos.

Las ofertas aprobadas, con ficha pública y cantidad autorizada, aparecen en una lista aparte, **Premios bajo custodia de colaboradores**, con «lo gestiona y entrega [nombre]». Son un dato declarado: no suman a los premios disponibles ni se mezclan con el dinero. El texto del aviso se mantiene en `custody.notice` de los textos de la convocatoria y su versión en `TournamentCallApplicationRules.CustodyNoticeVersion`.

## API de solicitudes

| Ruta | Acceso y efecto |
|---|---|
| `GET /api/me/convocatorias/fortnite-streamers` | Sesión propia: canales vinculados, contacto y solicitudes propias. |
| `PUT /api/me/convocatorias/fortnite-streamers` | Crea o actualiza una solicitud propia, con requisitos aceptados y revisión actual. |
| `POST /api/me/convocatorias/fortnite-streamers/{kind}/withdraw` | Retira la solicitud propia de ese tipo. |
| `GET /api/admin/convocatorias/fortnite-streamers/applications` | Solo dueño: bandeja paginada por tipo y estado. |
| `PUT /api/admin/convocatorias/fortnite-streamers/applications/{id}` | Solo dueño: cambia revisión y comentario. |
| `PUT /api/admin/convocatorias/fortnite-streamers/applications-open` | Solo dueño: abre o cierra solicitudes de la página publicada. |

Las revisiones de concurrencia evitan sobrescribir cambios de otra sesión. Dos canales de la misma cuenta no crean dos solicitudes del mismo tipo. Interés y colaboración son solicitudes distintas, y una persona puede enviar ambas.

La relación de solicitudes no bloquea la eliminación existente de cuentas o canales: al eliminarlos se retiran sus solicitudes asociadas. Si se elimina una cuenta revisora, se conserva la solicitud y se libera esa referencia.

## Instalación y verificación

Aplicar en orden `Decatron.Data/Migrations/Add_Tournament_Call_Page.sql`, `Decatron.Data/Migrations/Add_Tournament_Call_Applications.sql`, `Decatron.Data/Migrations/Add_Tournament_Call_Contributions.sql` y `Decatron.Data/Migrations/Add_Tournament_Call_Direct_Contribution.sql` antes de iniciar una versión del backend que use esta función. Son idempotentes. La primera crea la fila de borrador; la segunda añade apertura y la tabla privada de solicitudes; la tercera añade aportes, historial, intentos de pago y apertura de aportes inicialmente cerrada; la cuarta añade el origen de la ficha, la aceptación de custodia con su versión, el consentimiento de oferta pública y el usuario y canal del intento de pago. `Decatron.Data/Schema/baseline.sql` incluye las definiciones generadas; para crear la fila inicial se necesita la migración. Si las fases 1 a 3 ya están aplicadas, solo falta la cuarta migración, que debe aplicarse antes de reiniciar el backend.

No se publica contenido automáticamente al aplicar el SQL. Compilar no reinicia servicios ni despliega la página.

Validaciones: `node ClientApp/tools/validate-tournament-call.mjs`, `dotnet test Decatron.Tests/Decatron.Tests.csproj --filter FullyQualifiedName~TournamentCall`, tipos y build del frontend. Los tests de base exigen `DECATRON_APP_CONN` apuntando exclusivamente a `decatron_schema` y revierten sus transacciones; las pruebas nuevas de aportes fallan explícitamente sin esa conexión y las anteriores de solicitudes se reportan omitidas. Una omisión no cuenta como aprobada. La prueba visual con respuestas simuladas no sustituye una comprobación autenticada de los endpoints desplegados.


## Aportes y premios

En `/admin/convocatorias`, la pestaña **Aportes** registra dinero, tarjetas de regalo y objetos disponibles. Usa una referencia privada única y estable; si el aporte corresponde a una donación existente, vincula su ID en lugar de volver a contarlo como manual. Se puede enlazar una solicitud de colaborador, pero su aprobación no acredita recepción. La base declarada de US$30 y regalos hasta 2.800 paVos tampoco se confirma automáticamente.

Completa descripción pública ES/EN, moneda (sin moneda para unidades de objetos), cantidad neta recibida, cantidad destinada a premios, quién administra, quién entrega y evidencia privada de recepción/disponibilidad. Para dinero vinculado a un pago, el neto no puede superar lo cobrado y la moneda debe coincidir. Los pagos de prueba y los tiers no pueden confirmarse como premios. El importe cobrado, el neto y la asignación se muestran por separado; no se calculan comisiones estimadas ni se convierten monedas para sumar premios.

**Pendiente de revisión** no suma premios. **Recibido y confirmado** publica solo la cantidad asignada, descripción y responsables. **Revertido** retira el aporte de los premios, mantiene el historial y no ejecuta un reembolso. Un aporte revertido no se reactiva. Las correcciones y retiradas de consentimiento quedan en el historial privado; si otra sesión modifica el registro, hay que recargar antes de guardar.

El anonimato público es el estado inicial. Para publicar nombre, canal y aporte hace falta autorización específica y una constancia privada; el permiso previo de ficha de colaborador no sirve para este fin. No incluyas datos personales en la descripción de un aporte anónimo. La API pública excluye referencias, pagos, contacto, evidencia e identificadores internos. El dinero se agrupa por moneda y las tarjetas y objetos se muestran separados. La página no anuncia transferencia de paVos ni reparto sin confirmar.

## Donación destinada a premios

Desde la convocatoria, el botón **Colaborar** abre el pago dentro de la misma página cuando el dueño habilita aportes desde **Guía**; el bloque libre de `/supporters?call=fortnite-streamers#donar` sigue disponible como respaldo y usa el mismo panel. La apertura es independiente de las solicitudes; retirar la página cierra ambas entradas. El estado inicial es cerrado.

El donante elige importe USD de referencia y, solo con sesión, puede autorizar publicar su nombre, canal y aporte. Antes del pago se muestra el importe exacto a cobrar en PEN, obtenido del servidor. Se explica el margen orientativo de US$12 para intentar destinar US$10, sin afirmar una tarifa ni garantizar el neto. La donación no compra un tier, una plaza ni una recompensa.

La referencia y el destino se conservan antes de contactar al proveedor. El intento usa el importe preparado, no un importe enviado al cobrar. La confirmación privada se conserva en la misma pestaña del navegador y permite consultar estado, ver el neto recibido y la asignación confirmados, y retirar identidad pública. El nombre del pagador no se publica por defecto. Ocultar la identidad no resta un aporte confirmado de los premios.

El cobro confirmado queda pendiente de que el dueño compruebe lo recibido y disponible. Ante resultado incierto, no se debe volver a pagar: el dueño revisa la referencia en Culqi y usa **Consultar y conciliar cargo** con el ID comprobado. Esta acción solo consulta un cargo existente y verifica su referencia, importe, moneda, captura y ausencia de devoluciones. No genera cobros. Los reintentos del mismo intento y la repetición de confirmaciones no aumentan los premios. El reintento 3DS conserva token, dispositivo, referencia e importe. Si cambia el modo o la clave pública de pago, un intento sin cobrar debe cancelarse y prepararse de nuevo.

Un intento puede cancelarse antes del primer cobro o mientras espera autenticación bancaria. Si ya se está procesando o su resultado es incierto, se requiere conciliación. Las devoluciones posteriores se reflejan mediante revisión y reversión administrativa; no existe sincronización nueva de reembolsos ni reembolsos automáticos en esta fase. El organizador debe comprobar esa disponibilidad antes de confirmar y revisar incidencias posteriores.

### Colaboraciones aprobadas de dinero ya existentes

Las solicitudes de dinero enviadas antes de este flujo siguen existiendo. Si una está aprobada, su titular ve en su solicitud el enlace a realizar o consultar su aporte; el pago se hace igual que cualquier otro desde **Colaborar**, y la cantidad ofrecida en la solicitud no se cobra automáticamente. Para tarjetas, paVos y regalos aprobados, la persona ve las instrucciones de coordinación en el comentario del organizador, que debe indicar un medio privado de entrega al revisarla. No se envía una notificación automática. La publicación de la ficha y la autorización de identidad del aporte siguen separadas, y la aprobación no acredita recepción ni disponibilidad para premios.

## API de aportes

| Ruta | Acceso y efecto |
|---|---|
| `GET/POST /api/admin/convocatorias/fortnite-streamers/contributions` | Dueño: listar o registrar aportes. |
| `PUT /api/admin/convocatorias/fortnite-streamers/contributions/{id}` | Dueño: revisar, confirmar o revertir con revisión concurrente. |
| `GET /api/admin/convocatorias/fortnite-streamers/contributions/{id}/history` | Dueño: historial privado. |
| `GET /api/admin/convocatorias/fortnite-streamers/contributions/recovery` | Dueño: hasta 100 intentos pendientes de conciliación. |
| `PUT /api/admin/convocatorias/fortnite-streamers/donations-open` | Dueño: abrir/cerrar aportes; no abre solicitudes. |
| `POST /api/supporters/call-donations/prepare` | Preparar importe, referencia privada y destino. Con sesión valida y guarda el canal elegido (`channelUserId`). |
| `GET /api/supporters/call-donations/mine` | Sesión propia: sus aportes; montos recibidos y de premios solo tras la confirmación. |
| `POST /api/supporters/call-donations/charge` | Cobrar el intento preparado; 3DS si lo solicita el proveedor. |
| `POST /api/supporters/call-donations/receipt` | Consultar mediante clave privada de confirmación enviada en el cuerpo. |
| `POST /api/supporters/call-donations/withdraw-identity` | Titular de la confirmación: ocultar identidad. |
| `POST /api/supporters/call-donations/cancel` | Cancelar un intento que aún no permite acreditar un cobro. |
| `POST /api/supporters/call-donations/reconcile/{id}` | Dueño: verificar y registrar un cargo existente en Culqi. |

Cambios del flujo directo en las demás rutas: `GET /api/convocatorias/fortnite-streamers` añade `custodyOffers` (solo ofertas aprobadas, con ficha pública y cantidad autorizada) y `custodyNoticeVersion`; `PUT /api/me/convocatorias/fortnite-streamers` acepta `acceptedCustody`, `publicOffer` y `custodyNoticeVersion` y rechaza dinero nuevo con `money_via_payment`; la bandeja de solicitudes del dueño incluye `origin`, lo aceptado en custodia y los aportes ligados; el listado de aportes del dueño incluye quién pagó con sesión. Códigos nuevos: `custody_required`, `notice_changed`, `public_offer_requires_listing`, `money_via_payment`, `channel_not_owned`.

La clave de confirmación es privada: no se pone en URLs ni en el listado público y se almacena como hash en servidor. Las nuevas tablas son `tournament_call_contributions`, `tournament_call_contribution_events` y `tournament_call_donation_intents`; la migración aditiva es `Add_Tournament_Call_Contributions.sql`. No vinculan una edición del torneo ni alteran sus premios operativos.

Referencias del proveedor consultadas para implementar captura y revisión: [API de Culqi](https://apidocs.culqi.com/), [flujo 3DS](https://docs.culqi.com/es/documentacion/culqi-3ds/flujo-con-3ds/) y [estado de cuenta y neto](https://docs.culqi.com/es/documentacion/pagos-online/depositos/estado-cuenta/). Las tarifas concretas de la cuenta no se infieren de estas guías.

Los aportes vinculados a premios y los pagos de prueba se excluyen del progreso mensual de apoyo general en `/supporters`. El cobro general y la compra de tiers conservan su recorrido. Una denegación bancaria explícita termina el intento sin confirmar un aporte y permite preparar otro de forma voluntaria; una respuesta ambigua sigue requiriendo conciliación.
