# Cookies: decisión y comprobación

## Pendiente del titular

- [ ] Comprobar cookies, localStorage, sessionStorage y solicitudes en el dominio final con un perfil limpio.
- [ ] Repetir desde España, antes de entrar, después del código, al pagar y durante 3D Secure.
- [ ] Anotar nombre, dominio, finalidad, duración, momento de creación y versión de Stripe.js.
- [ ] Mantener desactivados anuncios, medición de audiencia y funciones de terceros sin finalidad necesaria.
- [ ] Revisar cualquier script nuevo antes de publicarlo.

## Decisión

No añadir un banner de consentimiento para la sesión, el idioma solicitado y la seguridad del pago. La [Guía de cookies de la AEPD, mayo de 2024, sección 2.1.2.a, pp. 11–12](https://www.aepd.es/guias/guia-cookies.pdf) incluye gestión del pago y fraude ligado a la seguridad del servicio entre las funciones técnicas. La exención exige que el almacenamiento sea necesario para el servicio solicitado. La mera etiqueta «fraude» no convierte cualquier seguimiento en necesario. La excepción de idioma se limita a la preferencia elegida o vinculada al documento solicitado.

El [art. 22.2 LSSI](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758#a22) exime ese almacenamiento necesario. Esto es una conclusión aplicada a esta integración, no una autorización general para toda cookie de Stripe o Cloudflare. El aviso completo informa del uso. No se añade un control de consentimiento que pretenda rechazar almacenamiento necesario y después lo use.

## Inventario esperado

| Almacenamiento | Finalidad | Duración y alcance |
| --- | --- | --- |
| Sesión better-auth, normalmente `better-auth.session_token` o prefijo seguro en HTTPS | Autenticar al cliente | Caducidad de la sesión. Comprobar nombre y vencimiento reales en producción |
| `invoices-language` | Idioma del documento solicitado | Paraglide configura 34.560.000 segundos (400 días). Es distinta de la cookie de sesión |
| `__stripe_mid` | Evaluar fraude del intento de pago | Un año, según inventario Stripe |
| `__stripe_sid` | Evaluar fraude del intento de pago | Treinta minutos, según inventario Stripe |
| `m` en `.m.stripe.com` | Detección de fraude | Dos años, según inventario Stripe. Depende de navegador y acceso a terceros |
| `id`, `_ab` y otros valores de sesión de Stripe | Señales de seguridad del pago | Sesión, según inventario Stripe. Comprobar qué se crea en el flujo real |
| Cookies de desafío o seguridad de Cloudflare, si se activan | Protección de acceso solicitado | No se presume que existan por usar el proxy. Inventariar las que se observen |

Stripe.js se importa desde `@stripe/stripe-js/pure` en `pay-form.tsx`. Se carga al montar el pago, no en la página de privacidad o el acceso por correo. La señal avanzada antifraude está habilitada por defecto. Los campos usan una fuente del sistema, sin solicitar Google Fonts. Los campos de tarjeta viven en marcos de Stripe. Sus [explicaciones de fraude](https://docs.stripe.com/disputes/prevention/advanced-fraud-detection), [centro de privacidad](https://stripe.com/legal/privacy-center) e [inventario de cookies](https://stripe.com/cookie-settings) vinculan estas señales a seguridad y fraude.

El inventario público de Stripe también incluye analítica y publicidad de otros productos y de su sitio. Esas finalidades no entran en la exención de seguridad. Si aparece almacenamiento no necesario en el flujo servido, impedirlo antes de crear datos o implantar consentimiento previo válido. No justificarlo con la necesidad de cobrar. La inspección local no sustituye la comprobación del dominio, país y configuración de producción.

El shell lee una preferencia `theme` en localStorage que puede existir por el sitio principal. Esta entrega no crea una preferencia de tema. Comprobar el sitio completo por separado antes de afirmar que todas sus páginas tienen la misma política.

## Comprobación local

El 12/10/2026, Playwright con Chrome, perfil limpio y locale `es-ES`, observó `m`, `__stripe_mid`, `__stripe_sid` e `invoices-language` al montar el Payment Element. No observó cookies de analítica o publicidad. Las capturas usan registros sintéticos y una clave de prueba ficticia. No verifican un cobro real ni 3D Secure. Repetir en producción con la configuración definitiva.
