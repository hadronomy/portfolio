# Verificación de esta entrega

Fecha: 12/10/2026. Datos de las capturas: registros sintéticos de `packages/invoices/src/fixtures.ts`. El titular real completa sus ajustes antes del despliegue.

Se abrió la página pública de privacidad y el acceso de clientes en el servidor de desarrollo Astro. Una ruta temporal mostró los componentes reales de pago y creó un presupuesto local con PDF real. Esa ruta se elimina antes del commit. No se enviaron correos ni se ejecutaron cobros. El Payment Element usa una clave ficticia, por lo que la captura no verifica los campos de tarjeta ni un pago.

Playwright usó Chrome, perfiles limpios y tamaños de 1440 × 1000 y 390 × 1000. Se capturaron ambos idiomas. No se detectó desbordamiento horizontal. La lectura usa un máximo de 72ch, cifras tabulares y contraste del texto superior a 4,5:1. La firma en móvil se inspeccionó con el panel abierto.

Las comprobaciones cubrieron la información completa, el acceso por correo, el pago y la aceptación en español e inglés, en escritorio y móvil. Las capturas son archivos temporales de verificación y no forman parte del repositorio.

La [inspección del navegador](evidence/inspection.json) registra anchos, desbordamiento y cookies observadas. No contiene valores de cookies. La [decisión de cookies](cookies.md) separa la comprobación local de las comprobaciones pendientes en producción.

Pruebas realizadas: claves y parámetros de ambos idiomas, lectura del responsable desde ajustes sin datos bancarios, actualización de su identidad, secciones públicas y enlaces de las primeras capas, y renderizado de presupuestos en ambos idiomas. La nueva consulta pública queda marcada como `notForAgents` en la cobertura MCP. React Doctor no detectó incidencias nuevas frente a HEAD (79/100). La comparación con origin/main incluye cambios previos de otras capas.


## Comandos y resultados

Ejecutados desde la raíz del worktree `portfolio.deploy-privacy`. El servidor se ejecutó desde `apps/astro`. Todos los comandos de comprobación terminaron con código 0.

```sh
bun run --cwd packages/i18n test
bun run --cwd packages/i18n build
bun run --cwd packages/invoices test
bun run --cwd apps/start test
bunx tsc --noEmit -p packages/i18n
bunx tsc --noEmit -p packages/invoices
bunx tsc --noEmit -p apps/start
bun biome check apps/start/src/features/privacy apps/start/src/routes/invoices_.privacy.tsx apps/start/src/features/account/account.server.ts apps/start/src/features/account/account.tsx apps/start/src/features/account/code-sign-in.tsx apps/start/src/features/agent/coverage.ts apps/start/src/features/invoices/pay-form.tsx apps/start/src/features/invoices/pay.tsx apps/start/src/features/invoices/quote-page.tsx packages/i18n/messages/en.json packages/i18n/messages/es.json packages/invoices/src/quote-notices.ts packages/invoices/src/quote.test.ts packages/invoices/src/privacy.ts packages/invoices/src/privacy.test.ts
git diff --check
```

Resultados finales: i18n, 2 pruebas. Invoices, 117 pruebas en 16 archivos. Start, 45 pruebas en 9 archivos. TypeScript, sin errores en los tres paquetes. Biome, 19 archivos comprobados.

Desde `apps/start`:

```sh
bunx react-doctor@latest --verbose --scope changed --base HEAD --include-untracked
```

Sin incidencias nuevas frente a HEAD. Puntuación 79/100, igual a la comprobación de la entrega interrumpida.

Desde `apps/astro`:

```sh
INVOICE_DATA_DIRECTORY=/Users/hadronomy/repos/portfolio.deploy-privacy/.privacy-dev-data bun run dev -- --host 127.0.0.1 --port 4387
bun run astro dev stop
```

Desde la raíz, `node .privacy-qa.mjs` tomó 16 capturas con Playwright. `node .privacy-metrics.mjs` comprobó medida, contraste y navegación. Ambos scripts y la ruta de datos sintéticos eran temporales y se eliminaron después. La medida de escritorio fue 71,85ch. El contraste del texto fue 6,55:1. La ruta temporal no forma parte de la aplicación publicada.

No se comprobó un pago real, 3D Secure, las cookies del dominio final ni la limpieza automática de todos los plazos. Los contratos de cuentas externas y los datos reales del titular quedan pendientes de su confirmación.
