# CONCIERTA — Calidad, seguridad y DevSecOps

**Proyecto:** Sistema académico de gestión de reservas de conciertos  
**Fecha de revisión:** 25 de octubre de 2026  
**Alcance:** Autenticación (FastAPI), Eventos (Express), Reservas (FastAPI), frontend (React/Vite) y PostgreSQL.

## 1. Propósito y alcance

Este documento reúne la evidencia de verificaciones efectuadas durante el desarrollo de CONCIERTA y diferencia los **controles implementados**, las **pruebas ejecutadas en su momento** y los **trabajos pendientes**. No constituye una certificación de seguridad, un informe de auditoría externa ni una garantía de que todas las pruebas siguen instaladas en el árbol actual del proyecto.

El sistema es académico: los pagos son simulados. La infraestructura local utiliza tres bases de datos independientes en PostgreSQL y servicios ejecutados en el equipo de desarrollo.

## 2. Evidencia de pruebas automatizadas ejecutadas

Durante la fase de Calidad se recibieron resultados de ejecución en Windows PowerShell con los siguientes resultados:

| Bloque | Tecnología | Casos aprobados | Fallos |
|---|---|---:|---:|
| Validación de entradas de Autenticación | pytest / Pydantic | 8 | 0 |
| JWT y permisos de Autenticación | pytest / python-jose | 8 | 0 |
| Validaciones y secretos QR de Reservas | pytest / Pydantic | 7 | 0 |
| Validaciones de Eventos | `node:test` / Zod | 7 | 0 |
| Integración HTTP básica | pytest / httpx | 8 | 0 |
| **Total histórico** | | **38** | **0** |

### Alcance de los resultados

- **Autenticación:** límites de entrada, validación de DNI/teléfono, normalización de usuario, contenido de tokens JWT, versión de sesión, rol administrativo y rechazo de firma errónea.
- **Reservas:** modelos de solicitud, cantidades permitidas por elemento y generación de secretos QR diferentes.
- **Eventos:** validación de campos requeridos, longitud, fechas con zona horaria, URL de imagen y estado del concierto.
- **Integración básica:** disponibilidad de los tres `/health`, consultas públicas de eventos y escenario, y rechazo de tres rutas administrativas sin token.

**Limitación esencial:** las pruebas automatizadas anteriores no demuestran cobertura exhaustiva ni sustituyen pruebas de penetración. No se completó una suite automatizada de concurrencia aislada en esta fase.

**Estado actual de los archivos de prueba:** después de ejecutar esas 38 pruebas, se revirtieron cambios introducidos para la fase de pruebas a petición del responsable del proyecto. Por consiguiente, los resultados anteriores son **evidencia histórica de ejecución**, no una afirmación de que la suite pueda ejecutarse ahora sin restaurar sus archivos y configuración. La reversión tampoco se comprobó mediante una nueva ejecución de toda la suite.

## 3. Verificaciones funcionales realizadas

Durante las revisiones manuales del sistema se comprobó y reportó funcionamiento correcto de los siguientes recorridos:

| Recorrido | Evidencia funcional reportada |
|---|---|
| Registro y SMTP | Recepción real de correo con usuario y contraseña temporal |
| Primer acceso | Cambio obligatorio de contraseña y posterior inicio de sesión con la nueva clave |
| Confirmación de reserva | Reserva confirmada con correo de notificación |
| Documentación de compra | Recepción de un PDF resumen y un PDF individual por boleto |
| QR | Códigos individuales diferentes y descarga de boletos |
| Validación de acceso | Uso de la pantalla administrativa de validación QR; prueba reportada como correcta |
| Reenvío | Reenvío de documentos desde una reserva marcada con estado de correo fallido; funcionamiento confirmado |
| Administración | Gestión de usuarios, roles y eventos; panel de reportes e historial revisados funcionalmente |

Estas comprobaciones son reportes de uso del entorno local. No se adjuntan aquí capturas, logs SMTP, archivos PDF con datos personales ni secretos de QR para evitar distribuir información sensible.

## 4. Controles de seguridad implementados

### Confidencialidad

- Contraseñas almacenadas mediante hash bcrypt.
- Secretos de JWT, comunicación interna y SMTP cargados desde variables de entorno, no desde el código del frontend.
- Credenciales temporales enviadas por SMTP; no se devuelven como texto plano en la respuesta de registro.
- Acceso al historial, boletos y PDF sujeto a autenticación y verificación de propietario o rol administrativo, según endpoint.

### Integridad

- Validación de datos con Pydantic (Python) y Zod (Node.js).
- PostgreSQL con restricciones locales de claves, unicidad y referencias pertinentes.
- Reservas concurrentes protegidas por bloqueo transaccional por evento y comprobación de asientos/capacidades antes de confirmar la operación.
- Límite de seis entradas por cliente y evento.
- Validación de boleto mediante ID y secreto QR, con marca de validación y rechazo del uso repetido en el flujo normal.

### Disponibilidad

- Endpoints `/health` para Autenticación, Eventos y Reservas.
- Reservas pendientes limitadas temporalmente; expiración de reservas mediante comprobaciones de servicio y proceso periódico.
- Verificación en tiempo real del estado de usuario por servicios consumidores; si Autenticación no está disponible, las operaciones protegidas fallan de forma controlada.

### AAA: autenticación, autorización y auditoría

- JWT firmado con expiración y control de `token_version` para invalidar sesiones al cambiar contraseña.
- Roles y comprobación del estado de la cuenta contra Autenticación.
- Acceso administrativo exigido para reportes, gestión protegida y validación QR.
- Persistencia de registros de auditoría implementada en los tres dominios para operaciones relevantes.

## 5. Análisis DevSecOps: ejecutado y pendiente

| Actividad | Estado documentado |
|---|---|
| Pruebas unitarias e integración básica | Ejecutadas y aprobadas históricamente (38 casos) |
| Pruebas funcionales SMTP, PDF y QR | Realizadas manualmente |
| Automatización de concurrencia en base aislada | No completada |
| `npm audit` en Eventos y frontend | No consta resultado ejecutado |
| `pip-audit` en microservicios Python | No consta resultado ejecutado |
| Bandit, Ruff o ESLint | No consta resultado ejecutado |
| Integración continua (por ejemplo, GitHub Actions) | No implementada/documentada como operativa |
| Análisis de penetración y carga | No realizado como auditoría formal |

La mención de una herramienta como opción recomendada **no equivale a un análisis ejecutado**. Para una entrega académica, es adecuado declarar con precisión estos límites.

## 6. Riesgos y recomendaciones para producción

1. **Infraestructura:** utilizar HTTPS, un reverse proxy, protección de secretos y bases de datos con acceso restringido.
2. **Sesiones:** considerar un proveedor de identidad y flujos OIDC/OAuth2 modernos para una aplicación pública.
3. **Limitación de intentos:** sustituir el control en memoria por un mecanismo compartido y resistente a múltiples instancias.
4. **Correos:** usar una cola persistente/outbox, políticas de reintento y monitoreo del servicio SMTP.
5. **Base de datos:** definir migraciones versionadas, copias de seguridad y una política de recuperación.
6. **QR y operaciones concurrentes:** añadir pruebas automatizadas con identidades distintas y una base de datos dedicada, incluyendo intentos simultáneos de validación del mismo boleto.
7. **Dependencias:** ejecutar análisis de vulnerabilidades antes de cada despliegue y registrar hallazgos/correcciones.
8. **Auditoría:** definir retención, acceso restringido, revisión periódica y políticas de integridad de logs.
9. **Pagos:** la simulación académica no debe presentarse como una pasarela de cobro real.

## 7. Documentos relacionados

- [`../README.md`](../README.md): introducción, requisitos y puesta en marcha.
- [`ARQUITECTURA.md`](ARQUITECTURA.md): decisiones técnicas y modelo por dominios.
- [`DIAGRAMAS.md`](DIAGRAMAS.md): representaciones Mermaid de arquitectura y procesos.
- [`GUIA_WINDOWS.md`](GUIA_WINDOWS.md): instalación y ejecución en Windows.
- [`API_REST.md`](API_REST.md): endpoints de los microservicios, permisos y ejemplos.

---

**Conclusión:** CONCIERTA dispone de controles esenciales de seguridad, evidencias de pruebas unitarias y de integración básica superadas, y verificaciones funcionales de correos, documentos y QR. La automatización de análisis DevSecOps y la validación exhaustiva para producción quedan identificadas como tareas futuras, sin afirmar que ya se completaron.
