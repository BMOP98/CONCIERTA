# CONCIERTA — Sistema de Reservas de Conciertos

Aplicación web académica de arquitectura **microservicios heterogéneos**, con servicios ejecutados **localmente** y Docker **solo para PostgreSQL**. Idioma español, dólares estadounidenses (USD), horario del Ecuador.

## Requisitos

- Node.js 20+ y npm
- Python 3.11+ y pip
- Docker y Docker Compose (solo PostgreSQL)
- Puertos disponibles: 5173 (web), 8001 (auth), 8002 (eventos), 8003 (reservas), 5434 (PostgreSQL)

## Inicio desde cero

```bash
# Desde la carpeta raíz del proyecto
cp .env.example .env       # En Windows: copy .env.example .env
# IMPORTANTE: para un despliegue real personalizar JWT_SECRET, INTERNAL_SECRET y ADMIN_PASSWORD.
docker compose up -d postgres

cd services/auth
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ../..

cd services/reservations
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ../..

cd services/events; npm install; cd ../..
cd frontend; npm install; cd ..
```

Abra **cuatro terminales independientes** desde la carpeta raíz y ejecute:

| Terminal | Comando | URL |
|---|---|---|
| 1 Auth | `cd services/auth && .venv/bin/uvicorn app.main:app --reload --port 8001` | http://localhost:8001/docs |
| 2 Eventos | `cd services/events && npm run dev` | http://localhost:8002/health |
| 3 Reservas | `cd services/reservations && .venv/bin/uvicorn app.main:app --reload --port 8003` | http://localhost:8003/docs |
| 4 Web | `cd frontend && npm run dev` | http://localhost:5173 |

**Windows:** use `scripts/start-auth.bat`, `scripts/start-events.bat`, `scripts/start-reservations.bat`, `scripts/start-web.bat` (una terminal por archivo, después de instalar dependencias). **Linux/macOS:** existen los equivalentes `scripts/start-*.sh`.

Es importante iniciar primero la base, luego eventos, luego autenticación/reservas, y finalmente web. La primera puesta en marcha crea las tablas automáticamente con ORM y carga datos de referencia con `infra/scenario.seed.json`.

## Usuario administrador de desarrollo

Usuario: `admin` / contraseña: `Admin1234!` (valor predeterminado configurable con `.env`). No reutilizar en producción.

Para crear cliente: **Regístrate**, completa tus datos (nacionalidad predefinida: Ecuatoriana). Una vez creado, se muestra una confirmación y la página cambia automáticamente al inicio de sesión. El nombre de usuario se genera a partir de nombres y apellidos, comprobando unicidad; las credenciales se entregan únicamente por correo SMTP. Si el correo o documento ya existe, se informa sin duplicar la cuenta. Inicia sesión con las credenciales del correo. Cambio de contraseña a través de `PUT /auth/password` (documentado en Swagger). Para Gmail SMTP, configura `MAIL_MODE=smtp` en el `.env` de la raíz, junto con las variables indicadas abajo. En ese modo, las credenciales se envían por correo y NO se devuelven en la respuesta API.

## Flujo de prueba funcional

1. Abre `http://localhost:5173` y busca un evento; elige localidades en el mapa y mezcla asientos de VIP, PREFERENCIA, BUTACAS, GENERAL y cantidades de CANCHA, hasta 6 en conjunto.
2. Crea una cuenta y vuelve a seleccionar las localidades; pulsa **Continuar**.
3. Confirma el pago **simulado** dentro de 5 minutos; aparece una reserva CONFIRMED y tickets QR.
4. Ve a **Mis reservas**; abre tus códigos QR, cancela la reserva (se liberan cupos).
5. Inicia sesión como administrador; administra eventos, roles/usuarios, consulta el escenario y observa métricas.
6. Para verificar exclusividad, abre dos navegadores con diferentes clientes e intenta reservar el mismo asiento: la segunda petición debe responder **409**. Los bloqueos se serializan transaccionalmente por evento en PostgreSQL.
7. Para verificar vencimiento, deja un apartado 5 minutos sin confirmar; la próxima consulta o intento de confirmación lo marca EXPIRED y libera cupos. El vencimiento es evaluado mediante PostgreSQL usando `now()` y las consultas de disponibilidad/operaciones; no requiere que el usuario tenga abierta la página.

## Endpoints principales

- Auth (FastAPI, PostgreSQL `concierta_auth`): `POST /auth/register`, `POST /auth/login`, `POST /auth/token` OAuth2 password grant, `GET /auth/me`, `PUT /auth/password`, `GET /auth/users`, `PATCH /auth/users/{id}`, `GET /auth/roles`.
- Eventos (Express + Sequelize, PostgreSQL `concierta_events`): `GET /events`, `GET /events/{id}`, `POST /events`, `PUT /events/{id}`, `DELETE /events/{id}` (baja lógica), `GET /scenario`, `GET /sections`, `GET /reports/general`.
- Reservas (FastAPI, PostgreSQL `concierta_reservations`): `GET /availability/{event_id}`, `POST /reservations`, `POST /reservations/{id}/confirm`, `POST /reservations/{id}/cancel`, `GET /reservations/mine`, `GET /reservations/all`, `GET /tickets/{id}/qr`, `POST /tickets/{id}/validate`.

Los tres microservicios usan BD distintas, JWT firmado con clave compartida y roles, DTO validados, controles de acceso, sin claves foráneas *entre* bases independientes. Referencias entre dominios son IDs y se validan vía API REST.

## Límites operativos y mejoras para producción

- Pago estrictamente simulado; sin proveedor bancario ni facturación.
- Email: `MAIL_MODE=smtp` habilita Gmail SMTP real (puerto 465 + TLS implícito). Las contraseñas temporales se envían por correo, no por la API. Pendiente para producción: verificación independiente de correo, restablecimiento seguro de contraseña y gestión de secretos.
- El flujo OAuth2 usa **Resource Owner Password Credentials** en el entorno académico. Para aplicaciones públicas se recomienda OIDC con Authorization Code + PKCE y un proveedor de identidad.
- La expiración es **lógica** y se materializa al consultar disponibilidad, crear/confirmar reservas o consultar reportes. No hay proceso en segundo plano ni cron; la exclusión se calcula correctamente incluso antes de materializar la transición.
- El código QR se genera en PNG por la API autenticada; en el acceso, el validador debe obtener su payload `CONCIERTA:<ticket_id>:<secret>` y enviar el secreto al endpoint administrativo `POST /tickets/{ticket_id}/validate`.
- No utilizar secretos de ejemplo en producción; configurar TLS, cookies seguras, rate limiting, auditoría duradera, migraciones versionadas, observabilidad, correo real, refresh token y pruebas de integración/penetración antes de operar comercialmente.

## Documentación

- `docs/ARQUITECTURA.md`: diagramas Mermaid, decisiones, modelo ER y seguridad.
- `infra/scenario.seed.json`: escenario, secciones, asientos generados y 4 conciertos precargados.
- `infra/schema_fallback.sql`: referencia SQL para creación de tablas en fallo de bootstrap ORM.

## Novedades: plano y selección multizona

La imagen de referencia se traduce a localidades existentes del sistema: **Humbe Box = VIP**, **Output Box = CANCHA**, **Fan = PREFERENCIA**, **Butaca (ambos lados) = BUTACAS**, **VIP exterior = GENERAL**. El plano SVG es interactivo. Las butacas laterales corresponden a una sola sección lógica BUTACAS en la BD (no se modifican los datos semilla ni los IDs).

Puedes agregar entradas en una zona, navegar a otra y seguir seleccionando. El carrito mantiene el detalle por sección y el precio acumulado. La API ya aceptaba varios tipos de `items` en una misma reserva; ahora el frontend también aprovecha esa funcionalidad. El máximo de 6 se aplica al total del evento.

## Gmail SMTP (Windows y Linux)

En la **raíz del proyecto**, crea `.env` desde `.env.example` si aún no existe. Configura allí (nunca en el frontend):

```dotenv
MAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=TU_CORREO@gmail.com
SMTP_APP_PASSWORD=TU_CONTRASENA_DE_APLICACION
SMTP_FROM=TU_CORREO@gmail.com
```

La clave es una **contraseña de aplicación de Gmail**, no la contraseña de inicio de sesión. Reinicia el microservicio de autenticación. En `MAIL_MODE=smtp` el registro envía el nombre de usuario y la contraseña temporal al correo del cliente; si falla el envío, la operación de registro se revierte y la API devuelve un error. El modo consola ya no está permitido para registrar usuarios: sin SMTP funcional el registro falla sin crear la cuenta.

**Importante:** no envíes credenciales reales ni `.env` al repositorio o al ZIP. Si compartiste una contraseña de aplicación por mensajería, revócala y genera otra antes de utilizar SMTP. `.gitignore` excluye el archivo `.env`.

### Windows PowerShell: iniciar desde la raíz del proyecto

```powershell
docker compose up -d postgres
Start-Process cmd -ArgumentList '/k', 'scripts\start-auth.bat'
Start-Process cmd -ArgumentList '/k', 'scripts\start-events.bat'
Start-Process cmd -ArgumentList '/k', 'scripts\start-reservations.bat'
Start-Process cmd -ArgumentList '/k', 'scripts\start-web.bat'
```

Instala las dependencias según la sección de inicio la primera vez. Si ya tienes el proyecto ejecutándose, reinicia el frontend y autenticación para aplicar cambios.


## Actualización: correos de compra, PDFs y primer acceso (octubre 2026)

- Tras confirmar el pago **simulado**, el microservicio de reservas confirma la operación en PostgreSQL y programa el envío de un correo HTML profesional por SMTP SSL Gmail (`MAIL_MODE=smtp`), con un **PDF resumen** y **un PDF individual con QR por entrada** adjuntos.
- Si el correo falla, **la reserva sigue confirmada**. En *Mis reservas* se pueden descargar nuevamente el resumen y los boletos PDF; cuando `email_status=FAILED`, se ofrece un botón de reintento. El estado de envío se almacena en PostgreSQL.
- El resumen indica nombre del concierto, artista, fecha, localidades, importes y referencia; los PDFs individuales incluyen sección, asiento y QR único. **No son facturas fiscales**, ya que los pagos siguen siendo simulados.
- El primer acceso con contraseña temporal fuerza a establecer una nueva contraseña (mínimo 10 caracteres, mayúsculas, minúsculas y números). La contraseña temporal deja de servir al cambiarla. Este requisito también aplica a cuentas creadas antes de esta versión mediante la migración aditiva.
- El servicio de autenticación migra automáticamente la columna `users.must_change_password` y el servicio de reservas `reservations.email_status`. **No ejecutes `docker compose down -v`** para actualizar.
- El error `No module named PIL` está corregido con `qrcode[pil]` en `services/reservations/requirements.txt` y el generador de PDFs utiliza `reportlab`.

### Instalar las nuevas dependencias (Windows PowerShell)

Desde la carpeta raíz de CONCIERTA, con los servicios detenidos:

```powershell
.\services\auth\.venv\Scripts\python.exe -m pip install -r services/auth/requirements.txt
.\services\reservations\.venv\Scripts\python.exe -m pip install -r services/reservations/requirements.txt
```

Configura las variables de Gmail en el `.env` **local** (no subas este archivo al repositorio): `MAIL_MODE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_APP_PASSWORD`, `SMTP_FROM`. El `.env.example` contiene los nombres y placeholders, no credenciales. Reinicia autenticación, eventos, reservas y frontend después de actualizar. El primer inicio aplica las migraciones aditivas.

El sistema usa tareas en segundo plano de FastAPI para el SMTP de confirmación. Para un despliegue empresarial, cambia estas tareas por una cola persistente/outbox y añade reintentos con backoff, observabilidad y control de acceso en el borde. No se incluye un procesador de pagos real.
