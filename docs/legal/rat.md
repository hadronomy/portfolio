# Registro de Actividades de Tratamiento (RAT)

## Pendiente del titular

- [ ] Anotar nombre legal, NIF, domicilio y correo exactamente como aparecen en los ajustes del emisor.
- [ ] Aprobar cada finalidad y los plazos de conservación.
- [ ] Anotar los proveedores de agentes MCP realmente autorizados.
- [ ] Registrar fecha y firma de aprobación: __________.

Responsable: profesional autónomo establecido en Santa Cruz de Tenerife. Contacto: correo y dirección de los ajustes del emisor. La aplicación tiene un solo titular. No se ha designado DPD. Revisar esa decisión si cambian las actividades o su escala.

Interesados: clientes particulares, autónomos, contactos y representantes de empresas. Origen: el interesado, la empresa a la que representa o la relación comercial con el titular. No se solicitan categorías especiales. La imagen de firma no se usa para identificación biométrica.

## Actividades

| Actividad y finalidad | Datos | Base jurídica | Destinatarios | Supresión |
| --- | --- | --- | --- | --- |
| Preparar y comunicar presupuestos, registrar respuestas y prestar el servicio | Identidad, contacto, dirección, contenido del presupuesto, elección de plan y mensajes | Contrato o medidas solicitadas por la persona (6.1.b). Para contactos profesionales, interés legítimo en la relación profesional (6.1.f y art. 19 LOPDGDD) | Vercel, Cloudflare, Neon/Databricks, Resend, agentes autorizados, Photon para el texto de dirección | No aceptados: un año. Aceptados: contrato y cinco años desde exigibilidad, con ampliaciones justificadas |
| Facturar y conservar registros contables y fiscales | Nombre, NIF, dirección, servicio, importes, impuestos, factura, PDF, justificantes | Obligación legal (6.1.c): normativa contable, facturación, LGT e IGIC | Infraestructura, Resend para entrega, Stripe para la copia de cobro, asesoría, administraciones y juzgados cuando corresponda | Seis años desde el último asiento, o el plazo fiscal más largo |
| Gestionar cobros | Factura, importe, estado, identificadores Stripe, referencia y fecha del pago. Stripe recoge la tarjeta | Contrato (6.1.b), contacto profesional (6.1.f), conservación fiscal (6.1.c) | Stripe, bancos y redes de tarjetas, Worker Cloudflare, Vercel, Neon, agentes autorizados | Cobro y conservación del justificante junto con la factura |
| Dar acceso al portal del cliente | Correo, hash del código, caducidad, intentos, sesión y usuario | Acceso solicitado en la relación contractual (6.1.b), contactos profesionales (6.1.f) | Vercel, Cloudflare, Neon, Resend | Código: diez minutos de validez, limpieza posterior. Cuenta: hasta cierre del acceso |
| Proteger acceso y servicio | IP, agente de usuario, hora, errores y eventos técnicos | Interés legítimo en evitar suplantación y abuso (6.1.f) | Infraestructura y proveedores de seguridad, titular y agentes con acceso autorizado | Registros: treinta días como máximo, salvo incidente documentado |
| Conservar prueba de la aceptación | Nombre, correo, firma SVG, UTC, IP, agente de usuario, versión, plan, PDF exacto y SHA-256 | Contrato para registrar la aceptación (6.1.b). Interés legítimo para la evidencia técnica y defensa (6.1.f) | Infraestructura, agentes autorizados, Resend para recibo, profesionales y juzgados ante disputa | Contrato y cinco años desde exigibilidad, con ampliación contable o por reclamación |
| Atender solicitudes de derechos | Solicitud, contacto, comprobación proporcionada de identidad y respuesta | Obligaciones de protección de datos (6.1.c) | Titular, proveedores que deban actuar y AEPD ante reclamación | Gestión y bloqueo por responsabilidades aplicables |
| Gestionar brechas de datos personales | Hechos, datos afectados, contactos, evaluación del riesgo y medidas del incidente | Obligaciones de protección de datos (6.1.c) | Titular, proveedores que deban actuar, AEPD y afectados cuando corresponda | Gestión y bloqueo por responsabilidades aplicables |

Los números de base jurídica corresponden al [RGPD art. 6](https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807). Los datos de contactos profesionales se limitan a su función y no se reutilizan para publicidad, conforme al [art. 19 LOPDGDD](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673#a19).

## Transferencias y medidas comunes

Aplicar la [tabla de proveedores](proveedores.md) a cada actividad que usa infraestructura. Las funciones y la base de datos se ubican en Frankfurt. Cloudflare procesa tráfico en su red mundial y Resend guarda mensajes en Estados Unidos. DPF cubre destinatarios estadounidenses certificados y tratamientos incluidos. SCC y medidas adicionales cubren transferencias sin esa cobertura. No inferir cobertura de un subencargado a partir de la certificación del proveedor.

Medidas previstas: HTTPS, sesiones seguras, códigos con hash y caducidad, acceso del titular por DID, autorización explícita de agentes, privilegios mínimos, PDF y huella de aceptación preservados, copias cifradas y restauración comprobada. Revisar cabeceras IP de los proxies y limitar el registro de tokens, códigos, tarjetas y firmas. Estas medidas deben comprobarse en producción.

El tratamiento es habitual. La excepción por menos de 250 personas no elimina el RAT cuando el tratamiento no es ocasional. Fuente: [AEPD sobre el RAT](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/7-registro-de-actividades-de-tratamiento/FAQ-0249-estoy-obligado-a-elaborar-un-rat).
