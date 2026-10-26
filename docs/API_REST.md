# CONCIERTA — Documentación de API REST

**Proyecto académico · Octubre de 2026**  
**Versión de referencia:** servicios de Autenticación, Eventos y Reservas revisados durante el desarrollo de CONCIERTA.

> Esta guía documenta las rutas observadas en el código de los tres microservicios. Los ejemplos usan identificadores ficticios; deben sustituirse por los obtenidos en la instalación local. Ningún ejemplo contiene secretos reales. El sistema simula los pagos.

## 1. Servicios y convenciones

| Servicio | Tecnología | URL local | Persistencia |
|---|---|---|---|
| Autenticación | FastAPI / SQLAlchemy | `http://localhost:8001` | `concierta_auth` |
| Eventos | Express / Sequelize | `http://localhost:8002` | `concierta_events` |
| Reservas | FastAPI / SQLAlchemy | `http://localhost:8003` | `concierta_reservations` |

Frontend: `http://localhost:5173` (React/Vite). PostgreSQL se ejecuta mediante Docker; las API se ejecutan como procesos locales. Para consultar documentación interactiva generada por FastAPI:

- Autenticación: `http://localhost:8001/docs`
- Reservas: `http://localhost:8003/docs`

Eventos utiliza Express y **no expone Swagger automáticamente** en la implementación revisada.

**Autorización:** las rutas protegidas usan la cabecera `Authorization: Bearer <JWT>`. Los tokens se firman con HS256, tienen expiración de ocho horas y llevan `token_version`; los servicios comprueban el estado y el rol actual del usuario mediante Autenticación. El usuario con `must_change_password=true` debe completar su primer cambio de contraseña antes de acceder a las funciones habituales.

**Comunicación interna:** las rutas `/internal/...` exigen `x-internal-key` con la clave compartida `INTERNAL_SECRET`. Esa clave **nunca debe utilizarse en el navegador**. Las referencias entre bases de datos son identificadores lógicos, no claves foráneas entre servicios.

**Errores comunes:** `400` datos o estado inválidos, `401` sin token o token inválido, `403` permisos insuficientes, `404` recurso no disponible, `409` conflicto, `422` error de validación, `429` límite de intentos y `503` dependencia no disponible. La disponibilidad exacta de cada código depende de la ruta.

## 2. API de Autenticación — puerto 8001

| Método y ruta | Acceso | Función |
|---|---|---|
| `GET /health` | Público | Estado del servicio |
| `POST /auth/register` | Público | Registrar cliente; credenciales temporales por SMTP |
| `POST /auth/login` | Público | Iniciar sesión con JSON |
| `POST /auth/token` | Público | Iniciar sesión con formulario OAuth2 |
| `GET /auth/me` | JWT | Perfil del usuario actual; permite acceso para cambiar contraseña |
| `PUT /auth/password` | JWT | Cambiar contraseña e invalidar tokens anteriores |
| `GET /auth/users` | ADMIN | Listar usuarios |
| `POST /auth/users` | ADMIN | Crear usuario y enviar credenciales por SMTP |
| `PATCH /auth/users/{uid}` | ADMIN | Modificar rol o estado activo |
| `DELETE /auth/users/{uid}` | ADMIN | Desactivar cuenta (baja lógica) |
| `GET /auth/roles` | ADMIN | Listar roles |
| `POST /auth/roles` | ADMIN | Crear rol |
| `PUT /auth/roles/{rid}` | ADMIN | Cambiar descripción del rol |
| `DELETE /auth/roles/{rid}` | ADMIN | Eliminar rol personalizado no asignado |
| `GET /internal/users/{uid}` | Clave interna | Información necesaria para verificar cuentas entre servicios |

### 2.1 Registro de cliente

`POST /auth/register` — `Content-Type: application/json`

```json
{
  "first_name": "Ana",
  "second_name": "María",
  "last_name": "Pérez",
  "dni": "0912345678",
  "nationality": "Ecuatoriana",
  "address": "Guayaquil",
  "phone": "0991234567",
  "email": "ana@example.com"
}
```

Respuesta esperada `201`:

```json
{
  "message": "Cuenta creada correctamente. Hemos enviado tus credenciales a tu correo electrónico."
}
```

El nombre de usuario se genera automáticamente; las credenciales temporales se envían por correo. El registro falla si no puede entregarse el correo SMTP. Los correos y documentos de identidad duplicados se rechazan.

### 2.2 Inicio de sesión

`POST /auth/login`:

```json
{
  "username": "usuario_ejemplo",
  "password": "CONTRASEÑA_DE_EJEMPLO"
}
```

Respuesta `200` (resumida):

```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "user": {
    "id": "<ID_USUARIO>",
    "first_name": "Ana",
    "last_name": "Pérez",
    "username": "usuario_ejemplo",
    "role": "CLIENTE",
    "active": true,
    "must_change_password": true
  }
}
```

`POST /auth/token` recibe `application/x-www-form-urlencoded` con `username` y `password`, y ofrece el mismo inicio de sesión para herramientas OAuth2.

### 2.3 Cambio obligatorio de contraseña

`PUT /auth/password` — Bearer JWT:

```json
{
  "current_password": "CONTRASEÑA_TEMPORAL",
  "new_password": "NuevaClaveSegura123"
}
```

La nueva contraseña debe tener al menos diez caracteres y combinar mayúsculas, minúsculas y números. Una actualización exitosa devuelve un **JWT nuevo** y el usuario; aumenta `token_version`, invalidando sesiones anteriores.

### 2.4 Administración de usuarios y roles

`PATCH /auth/users/{uid}` acepta los campos opcionales `active` (booleano) y `role_id` (cadena):

```json
{ "active": false }
```

Los roles base `ADMIN` y `CLIENTE` no pueden eliminarse. `POST /auth/roles` utiliza `id` y `description`; `PUT /auth/roles/{rid}` modifica `description`. El registro administrativo de usuarios, en la implementación revisada, admite roles `ADMIN` y `CLIENTE`.

## 3. API de Eventos — puerto 8002

| Método y ruta | Acceso | Función |
|---|---|---|
| `GET /health` | Público | Estado del servicio |
| `GET /scenario` | Público | Escenario y jerarquía de secciones, filas y asientos |
| `GET /sections` | Público | Catálogo de secciones |
| `GET /events` | Público | Listar y filtrar conciertos |
| `GET /events/{id}` | Público | Obtener concierto por ID |
| `POST /events` | ADMIN | Crear concierto |
| `PUT /events/{id}` | ADMIN | Actualizar concierto (también permite republicar) |
| `DELETE /events/{id}` | ADMIN | Despublicar, sin borrar el registro |
| `GET /reports/general` | ADMIN | Reporte consolidado con datos de Reservas |

### 3.1 Consulta de conciertos

`GET /events` acepta los siguientes parámetros de consulta:

| Parámetro | Ejemplo | Comportamiento |
|---|---|---|
| `q` | `?q=rock` | Busca por nombre o artista |
| `from` | `?from=2026-11-01` | Fecha mínima del concierto |
| `to` | `?to=2026-12-31` | Fecha máxima del concierto |
| `include_inactive` | `?include_inactive=true` | Incluye conciertos despublicados |

Sin `include_inactive=true`, se devuelven los conciertos activos. Las fechas del evento incluyen zona horaria.

### 3.2 Crear o modificar concierto

`POST /events` / `PUT /events/{id}` — Bearer ADMIN:

```json
{
  "name": "Concierto de ejemplo",
  "description": "Presentación musical de demostración.",
  "artist": "Artista de ejemplo",
  "genre": "Pop",
  "date": "2026-12-20T20:00:00-05:00",
  "imageUrl": "https://example.com/concierto.jpg",
  "active": true
}
```

`imageUrl` y `active` son opcionales; el backend asocia el concierto al escenario único (`scenarioId=1`). `DELETE` realiza una **baja lógica** estableciendo `active=false`.

### 3.3 Escenario

`GET /scenario` devuelve un arreglo de escenarios con `Sections`. Cada sección numerada conserva `Seats` por compatibilidad y contiene `Rows` con sus `Seats`; la propiedad `rows` (minúsculas) indica cuántas filas tiene la sección. CANCHA no posee asientos numerados.

El escenario de referencia tiene **330 localidades**: VIP 48, PREFERENCIA 72, BUTACAS 60, GENERAL 90 y CANCHA 60.

### 3.4 Reporte administrativo

`GET /reports/general?from=2026-10-01&to=2026-10-31&event_id=<UUID>&status=CONFIRMED`

Acepta `from`, `to`, `event_id` y `status`. Eventos transforma los filtros de fecha a `from_date` y `to_date` para consultar internamente al servicio de Reservas.

La respuesta consolida `reservation_count`, `confirmed_count`, `total_revenue`, `by_status` y `by_event`. Cada fila de `by_event` incorpora secciones con capacidad, ocupación, disponibilidad calculada y recaudación simulada.

**Interpretación:** la disponibilidad incluida en un reporte filtrado se calcula sobre las reservas que cumplen los filtros y **no sustituye** la disponibilidad de compra en tiempo real.

## 4. API de Reservas — puerto 8003

| Método y ruta | Acceso | Función |
|---|---|---|
| `GET /health` | Público | Estado del servicio |
| `GET /availability/{event_id}` | Público | Asientos ocupados y disponibilidad actual por sección |
| `POST /reservations` | JWT | Crear reserva pendiente |
| `POST /reservations/{rid}/confirm` | Propietario o ADMIN | Confirmar pago simulado |
| `POST /reservations/{rid}/cancel` | Propietario o ADMIN | Cancelar reserva |
| `GET /reservations/mine` | JWT | Historial de reservas del usuario |
| `GET /reservations/all` | ADMIN | Listado general con boletos |
| `POST /reservations/{rid}/resend-email` | Propietario | Reintentar correo de reserva confirmada no enviada |
| `GET /reservations/{rid}/summary.pdf` | Propietario o ADMIN | Descargar comprobante general |
| `GET /tickets/{tid}/ticket.pdf` | Propietario o ADMIN | Descargar PDF de boleto individual |
| `GET /tickets/{tid}/qr` | Propietario o ADMIN | Obtener imagen PNG del QR |
| `POST /tickets/{tid}/validate` | ADMIN | Validar un boleto para el ingreso |
| `GET /internal/report` | Clave interna | Datos agregados para el reporte de Eventos |

### 4.1 Disponibilidad

`GET /availability/{event_id}` devuelve una estructura similar a:

```json
{
  "taken": [
    { "section_id": 1, "seat_id": 12, "seat_label": "A12" }
  ],
  "sections": [
    { "section_id": 1, "capacity": 48, "available": 47 }
  ]
}
```

La disponibilidad considera las reservas `CONFIRMED` y las `PENDING` que todavía no han vencido. La respuesta ilustrativa no enumera todas las secciones.

### 4.2 Crear reserva

`POST /reservations` — Bearer JWT:

```json
{
  "event_id": "<UUID_EVENTO>",
  "items": [
    { "section_id": 1, "seat_id": 12, "quantity": 1 },
    { "section_id": 5, "quantity": 2 }
  ]
}
```

Cada asiento numerado se envía como elemento individual de cantidad 1. En CANCHA, sin numeración, se utiliza `quantity`. Los IDs de sección en el ejemplo son **ilustrativos**: consulta `/scenario` para conocer qué ID corresponde realmente a CANCHA.

El máximo es de **seis entradas por cliente y evento**. La creación reserva localidades durante aproximadamente cinco minutos (configurable con `HOLD_MINUTES`). Las solicitudes concurrentes se serializan mediante bloqueos transaccionales de PostgreSQL por evento. Cuando un asiento está ocupado o se supera el límite, el servicio devuelve un conflicto (`409`).

Una respuesta exitosa `201` contiene `id`, `code`, `client_id`, `event_id`, `status`, `total`, `email_status`, `created_at`, `expires_at` y el arreglo `tickets` con sus detalles. El campo `qr_secret` **no aparece** en esa respuesta.

### 4.3 Estados y confirmación

Estados de reserva: `PENDING`, `CONFIRMED`, `CANCELLED` y `EXPIRED`.

- `POST /reservations/{rid}/confirm`: confirma únicamente una reserva pendiente no vencida. El cobro es **simulado**; la confirmación programa el correo con resumen y PDFs individuales.
- `POST /reservations/{rid}/cancel`: cancela reservas pendientes o confirmadas, liberando su ocupación; el registro histórico se conserva.
- Un proceso de expiración revisa periódicamente las reservas pendientes vencidas; las consultas del servicio también actualizan los estados cuando corresponde.
- `GET /reservations/mine` acepta opcionalmente `from_date` y `to_date` para filtrar por fecha de creación.

### 4.4 Documentos, QR y validación

El comprobante se descarga en `/reservations/{rid}/summary.pdf`. Cada boleto confirmado tiene un PDF independiente en `/tickets/{tid}/ticket.pdf` y una imagen en `/tickets/{tid}/qr`.

El contenido leído del código QR sigue el formato:

```text
CONCIERTA:<ticket_id>:<qr_secret>
```

La interfaz administrativa separa el `ticket_id` y el secreto, y llama a:

`POST /tickets/{tid}/validate` — Bearer **ADMIN**

```json
{ "qr_secret": "<SECRETO_EXTRAÍDO_DEL_QR>" }
```

Respuesta satisfactoria:

```json
{ "valid": true, "ticket_id": "<ID_BOLETO>" }
```

La ruta exige que la reserva esté confirmada y que el secreto coincida; si el boleto ya fue usado responde `409`. La operación correcta registra `validated_at` y una entrada de auditoría `TICKET_VALIDATED`.

**Seguridad:** un QR funciona como credencial de acceso. No publiques sus contenidos ni incorpores secretos QR a capturas o documentos públicos.

### 4.5 Reenvío SMTP

`POST /reservations/{rid}/resend-email` admite reservas confirmadas **del propietario** cuando el correo no figura como `SENT`. Programa un nuevo intento y actualiza `email_status` (`PENDING`, `SENT` o `FAILED`). La funcionalidad utiliza el SMTP configurado en el backend.

## 5. Ejemplos rápidos en Windows PowerShell

Los comandos de lectura siguientes no necesitan credenciales:

```powershell
Invoke-RestMethod http://localhost:8001/health
Invoke-RestMethod http://localhost:8002/health
Invoke-RestMethod http://localhost:8003/health
Invoke-RestMethod http://localhost:8002/events
Invoke-RestMethod http://localhost:8002/sections
```

Para usar una ruta protegida, utiliza un token obtenido mediante el inicio de sesión de tu cuenta:

```powershell
$token = Read-Host "Pega un JWT de prueba"
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod http://localhost:8001/auth/me -Headers $headers
```

Evita copiar JWT, contraseñas o claves internas en capturas, informes o repositorios públicos.

## 6. Auditoría, límites y documentación complementaria

- Auditoría persistente de accesos y administración en Autenticación, operaciones de conciertos en Eventos y reservas/validación QR en Reservas.
- Contraseñas con bcrypt; secretos definidos por variables de entorno; validación con Pydantic y Zod; control de roles y verificación de `token_version`.
- Límite básico de intentos de inicio de sesión en memoria. En producción sería conveniente una solución compartida para varias instancias.
- Los correos se envían por SMTP y los PDFs se generan en el backend; un fallo de correo de confirmación no cancela una reserva ya confirmada.
- Pago estrictamente simulado. No se gestionan tarjetas ni cobros bancarios reales.
- El acceso comercial requeriría HTTPS, gestión centralizada de secretos, monitorización y controles adicionales.

**Documentación relacionada:** `README.md`, `docs/ARQUITECTURA.md`, `docs/DIAGRAMAS.md` y `docs/GUIA_WINDOWS.md`.
