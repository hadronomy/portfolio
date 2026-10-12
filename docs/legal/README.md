# Protección de datos de la aplicación de facturas

Borrador para el titular. Revisión: 12 de octubre de 2026. Ámbito: `https://hadronomy.com/invoices`, clientes particulares y contactos profesionales.

## Confirmar antes de recoger datos en producción

- [ ] Completar el nombre legal, NIF, domicilio y correo del emisor en los ajustes. La página pública lee esos campos, sin publicar datos bancarios.
- [ ] Confirmar con la asesoría los plazos fiscales aplicables, incluidas las regularizaciones del IGIC y las interrupciones de prescripción.
- [ ] Aprobar el [RAT](rat.md), el [calendario de conservación](conservacion.md) y la [ponderación de la evidencia](interes-legitimo.md).
- [ ] Implantar la limpieza y el bloqueo de datos del calendario. Esta entrega publica la política, pero no añade una tarea de borrado. La caducidad del código no prueba que su fila se borre.
- [ ] Aceptar y archivar los contratos de la [tabla de proveedores](proveedores.md), con sus subencargados y mecanismos de transferencia.
- [ ] Resolver el uso de Photon público: no se ha encontrado un DPA específico del servicio. No enviar direcciones personales sin aclarar el papel y las condiciones de komoot. Usar una instancia propia o escribir la dirección sin buscar si no se resuelve.
- [ ] Confirmar quién presta cada agente MCP. Un proveedor externo de agente puede recibir datos en sus propios sistemas. Firmar su DPA y evaluar sus transferencias antes de autorizarlo.
- [ ] Aplicar los límites de copias y registros. No dar por existentes copias propias por el hecho de que el aviso las describa.
- [ ] Confirmar que las funciones Vercel y Neon están en Frankfurt, y Resend envía desde Irlanda. Eso no impide transferencias internacionales.
- [ ] Ejecutar la [comprobación de cookies](cookies.md) en el dominio final, con tarjeta y 3D Secure. La decisión de no mostrar banner presupone que todo almacenamiento es necesario.
- [ ] Designar al titular como contacto para [derechos](derechos.md) y [brechas](brechas.md). Revisar el buzón cada día laborable.
- [ ] Revisar el uso comercial de Vercel Hobby. Sus condiciones restringen el plan a uso personal no comercial. Su DPA publicado cubre Pro y Enterprise, no Hobby. Resolver ese punto antes del despliegue de facturación.

El aviso completo está en `/invoices/privacy`. Sigue el idioma del visitante y admite `?lang=es` o `?lang=en`. Los formularios enlazan con el idioma del documento. Los PDF de presupuestos incluyen su propia primera capa. No existe otro aviso de privacidad de factura impresa en el código actual.

No se pide consentimiento para facturar, cobrar o conservar prueba del contrato. Las bases se describen por finalidad. La firma dibujada es una firma electrónica simple. No se presenta como firma avanzada o cualificada.

Los documentos son un borrador operativo. Registrar aprobación, fecha y cambios de proveedores en este directorio. Conservar copias privadas de los contratos y las verificaciones fuera del repositorio público.

Fuentes: [información por capas, AEPD](https://www.aepd.es/derechos-y-deberes/conoce-tus-derechos/derecho-de-informacion), [LOPDGDD art. 11](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673#a11), [eIDAS arts. 3, 25 y 26](https://eur-lex.europa.eu/legal-content/ES/ALL/?uri=CELEX:02014R0910-20241018), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Vercel DPA, sección 1](https://vercel.com/legal/dpa).
