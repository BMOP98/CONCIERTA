# CONCIERTA — Guía de instalación y ejecución en Windows

## 1. Alcance

Esta guía describe el entorno **local de desarrollo** de CONCIERTA en Windows con PowerShell. Los microservicios y el frontend se ejecutan como procesos del equipo; **Docker se utiliza para PostgreSQL**, no para ejecutar las aplicaciones. Los pagos son simulados.

| Componente | Tecnología | Puerto local | Base de datos |
|---|---|---:|---|
| Frontend | React + Vite | 5173 | No aplica |
| Autenticación | Python + FastAPI | 8001 | `concierta_auth` |
| Eventos | Node.js + Express + Sequelize | 8002 | `concierta_events` |
| Reservas | Python + FastAPI | 8003 | `concierta_reservations` |
| PostgreSQL | Docker | 5434 (equipo) → 5432 (contenedor) | Tres bases independientes |

## 2. Requisitos

- Windows con PowerShell y Docker Desktop (motor Docker operativo).
- Docker Compose (comando `docker compose`).
- Node.js y npm (se ha utilizado Node.js 24; se recomienda una versión LTS compatible).
- Python y pip (se ejecutaron pruebas con Python 3.10.2; se recomienda Python 3.11 o superior para una instalación nueva, verificando las dependencias).
- Conexión a Internet para descargar dependencias y usar SMTP.
- Puertos locales `5434`, `8001`, `8002`, `8003` y `5173` disponibles.

Para comprobar herramientas:

```powershell
python --version
node --version
npm --version
docker --version
docker compose version
```

## 3. Abrir la raíz del proyecto

Ejecutar los comandos desde la carpeta raíz, que contiene `frontend`, `services`, `scripts`, `infra` y el archivo de Docker Compose:

```powershell
Set-Location "C:\Users\BMOP\Desktop\CASO PRACTICO\CONCIERTA"
Get-Location
```

La ruta anterior es la utilizada durante el desarrollo; adaptarla si el proyecto se mueve a otro equipo. **No copiar el texto del indicador de PowerShell** (`PS ...>`) como parte del comando.

## 4. Configurar las variables de entorno

Si la distribución contiene `.env.example`, generar el archivo local:

```powershell
Copy-Item .\.env.example .\.env
```

Si `.env` ya existe y funciona, **no sobrescribirlo**. Editar las variables en el archivo `.env` de la raíz.

| Variable | Uso |
|---|---|
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD` | Conexión de los microservicios a PostgreSQL; en este entorno el puerto del equipo es `5434` |
| `JWT_SECRET` | Firma de tokens HS256; mínimo 32 caracteres |
| `INTERNAL_SECRET` | Autorización de consultas internas entre servicios; mínimo 32 caracteres |
| `AUTH_URL`, `EVENTS_URL`, `RESERVATIONS_URL` | Direcciones REST internas de los servicios |
| `CORS_ORIGIN` | Origen permitido del frontend, normalmente `http://localhost:5173` |
| `HOLD_MINUTES` | Duración del bloqueo de una reserva, normalmente `5` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Creación inicial de la cuenta administrativa |
| `MAIL_MODE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Modalidad y conexión SMTP |
| `SMTP_USER`, `SMTP_APP_PASSWORD`, `SMTP_FROM` | Credenciales y remitente SMTP |

Para Gmail se utiliza `MAIL_MODE=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465` y `SMTP_SECURE=true`; configurar las demás variables con **valores propios**. No publicar contraseñas de aplicación ni secretos. El valor de `ADMIN_PASSWORD` se utiliza al crear la cuenta administradora por primera vez; cambiar la variable después no sustituye automáticamente su contraseña guardada.

## 5. Iniciar PostgreSQL

Desde la raíz:

```powershell
docker compose up -d postgres
```

Verificar:

```powershell
docker ps
docker exec concierta-postgres psql -U concierta -d postgres -c "SELECT current_database();"
```

El proyecto utiliza PostgreSQL alojado en el contenedor `concierta-postgres`. La inicialización depende de la definición Compose y de `infra/init.sql`; en instalaciones existentes deben preservarse los datos y migraciones aplicadas. Si hay problemas de conexión, comprobar Docker Desktop, la configuración de `.env` y la exposición del puerto `5434`.

**Nunca ejecutar `docker compose down -v` como solución rutinaria:** la opción `-v` elimina volúmenes asociados y puede destruir datos.

## 6. Instalar dependencias (primera vez)

Ejecutar desde la raíz. Cada servicio Python mantiene su propio entorno virtual.

```powershell
python -m venv .\services\auth\.venv
.\services\auth\.venv\Scripts\python.exe -m pip install -r .\services\auth\requirements.txt

python -m venv .\services\reservations\.venv
.\services\reservations\.venv\Scripts\python.exe -m pip install -r .\services\reservations\requirements.txt

npm --prefix .\services\events install
npm --prefix .\frontend install
```

Los comandos anteriores no necesitan activar manualmente los entornos Python. Si ya están instaladas las dependencias, omitir este paso.

## 7. Iniciar los cuatro procesos

Abrir **cuatro terminales separadas** desde la raíz y ejecutar un comando por terminal:

| Terminal | Comando | Comprobación |
|---|---|---|
| Auth | `.\scripts\start-auth.bat` | `http://localhost:8001/health` y `http://localhost:8001/docs` |
| Eventos | `.\scripts\start-events.bat` | `http://localhost:8002/health` |
| Reservas | `.\scripts\start-reservations.bat` | `http://localhost:8003/health` y `http://localhost:8003/docs` |
| Web | `.\scripts\start-web.bat` | `http://localhost:5173` |

Los `.bat` disponibles ejecutan respectivamente:

- Auth: `uvicorn app.main:app --reload --port 8001` dentro de `services/auth`.
- Eventos: `npm run dev` dentro de `services/events`.
- Reservas: `uvicorn app.main:app --reload --port 8003` dentro de `services/reservations`.
- Web: `npm run dev` dentro de `frontend`.

El orden recomendado es: **PostgreSQL → Autenticación → Eventos → Reservas → Frontend**. Los servicios usan llamadas HTTP entre sí; iniciar una dependencia antes de otra evita errores temporales de conexión.

Para abrir cuatro ventanas automáticamente desde PowerShell en la raíz:

```powershell
Start-Process cmd -ArgumentList '/k', 'scripts\start-auth.bat'
Start-Process cmd -ArgumentList '/k', 'scripts\start-events.bat'
Start-Process cmd -ArgumentList '/k', 'scripts\start-reservations.bat'
Start-Process cmd -ArgumentList '/k', 'scripts\start-web.bat'
```

## 8. Comprobaciones básicas

```powershell
Invoke-RestMethod http://localhost:8001/health
Invoke-RestMethod http://localhost:8002/health
Invoke-RestMethod http://localhost:8003/health
```

Resultados esperados: objeto JSON con `status: ok` y servicio `auth`, `events` o `reservations` respectivamente. El estado `/health` confirma que un proceso responde, pero no reemplaza una verificación funcional completa.

Desde el frontend:

1. Registrar un cliente. El registro requiere SMTP funcional y envía credenciales temporales al correo.
2. Iniciar sesión y cambiar la contraseña temporal.
3. Seleccionar hasta seis localidades por cliente y evento; confirmar el pago simulado dentro del plazo.
4. Consultar `Mis reservas`, descargar el resumen PDF y los boletos PDF individuales con QR.
5. Como `ADMIN`, consultar usuarios, roles, eventos, reportes, historial y `Validar entradas`.

Las reservas `PENDING` bloquean cupos temporalmente; el servicio de Reservas revisa de forma autónoma su vencimiento cada 30 segundos, además de considerar la expiración al consultar y operar.

## 9. Correos y documentos

- **Auth** envía credenciales temporales por SMTP; no devuelve las contraseñas en la API.
- **Reservas** envía al confirmar un mensaje con un PDF general y un PDF por boleto, con QR único.
- En `Mis reservas` se puede descargar nuevamente la documentación. Cuando `email_status=FAILED`, el propietario puede solicitar reenvío.
- La validación administrativa procesa el contenido `CONCIERTA:<ticket_id>:<qr_secret>` y rechaza el segundo uso de un mismo boleto.
- Los QR contienen secretos de acceso: no compartir públicamente capturas o payloads.

## 10. Solución de problemas frecuentes

| Síntoma | Revisión |
|---|---|
| `No se encuentra la ruta .\scripts` | Volver a la raíz con `Set-Location`; no ejecutar desde `services/reservations` |
| Error de PostgreSQL | Docker Desktop, `docker ps`, puerto `5434`, credenciales de `.env` |
| `ModuleNotFoundError` en Auth o Reservas | Instalar `requirements.txt` con el Python del `.venv` correcto |
| `npm` no encuentra paquetes | Ejecutar `npm install` en Eventos y Frontend |
| Registro devuelve error SMTP | Verificar remitente, contraseña de aplicación, red y variables SMTP sin imprimir secretos |
| JWT inválido tras cambio de contraseña | Volver a iniciar sesión: `token_version` invalida tokens anteriores |
| Error `401` / `403` | Comprobar sesión vigente, rol y cambio obligatorio de contraseña |
| Puerto ocupado | Cerrar el proceso anterior o revisar la aplicación que ocupa el puerto |
| El PDF no se descarga | Confirmar que la reserva esté en estado `CONFIRMED` y que el usuario esté autorizado |

## 11. Apagar el entorno

- En cada ventana de Auth, Eventos, Reservas o Web: `Ctrl + C`.
- Para detener PostgreSQL **conservando su volumen de datos**:

```powershell
docker compose stop postgres
```

No eliminar el directorio de datos ni reinicializar las bases de usuarios, eventos o reservas para resolver problemas de ejecución.

## 12. Documentación relacionada

- `README.md`: visión general y funcionalidades.
- `docs/ARQUITECTURA.md`: decisiones técnicas, datos, seguridad y límites.
- `docs/DIAGRAMAS.md`: diagramas Mermaid de arquitectura, relaciones y procesos.
- `docs/CONCIERTA_GUIA_WINDOWS.md`: este procedimiento.
- Documentación interactiva FastAPI: `http://localhost:8001/docs` y `http://localhost:8003/docs`.
- Eventos Express: endpoints descritos en `README.md` y en `docs/API_REST.md`.

**Aviso:** este proyecto es académico; no procesa pagos bancarios reales. Una instalación de producción requiere TLS, gestión de secretos, respaldo, métricas, seguridad perimetral y verificaciones adicionales.
