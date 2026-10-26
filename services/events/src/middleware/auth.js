import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

async function auth(req, res, next) {
    try {
        // 1. Obtener el token del encabezado Authorization.
        const authorization = req.headers.authorization || '';
        const match = authorization.match(/^Bearer\s+(.+)$/i);

        if (!match) {
            return res.status(401).json({
                detail: 'Token de autenticación requerido'
            });
        }

        // 2. Validar firma y vencimiento del JWT.
        const claims = jwt.verify(
            match[1],
            env.JWT_SECRET,
            {
                algorithms: ['HS256']
            }
        );

        if (!claims.sub || typeof claims.sub !== 'string') {
            return res.status(401).json({
                detail: 'Token inválido'
            });
        }

        // 3. Consultar el estado real del usuario en Autenticación.
        const authUrl = (
            env.AUTH_URL || 'http://localhost:8001'
        ).replace(/\/$/, '');

        let response;

        try {
            response = await fetch(
                `${authUrl}/internal/users/${encodeURIComponent(claims.sub)}`,
                {
                    method: 'GET',
                    headers: {
                        'x-internal-key': env.INTERNAL_SECRET
                    },
                    signal: AbortSignal.timeout(5000)
                }
            );
        } catch (error) {
            console.error('No se pudo consultar Autenticación:', error);

            return res.status(503).json({
                detail: 'Servicio de Autenticación no disponible'
            });
        }

        if (!response.ok) {
            console.error(
                'Error verificando usuario:',
                response.status
            );

            return res.status(503).json({
                detail: 'No se pudo verificar la cuenta'
            });
        }

        const account = await response.json();

        // 4. Rechazar usuarios inexistentes o desactivados.
        if (!account.exists || !account.active) {
            return res.status(401).json({
                detail: 'Cuenta inexistente o desactivada'
            });
        }

        // 5. Exigir cambio de contraseña cuando corresponda.
        if (account.must_change_password) {
            return res.status(403).json({
                detail: 'Debes cambiar tu contraseña antes de continuar'
            });
        }

        // 6. Utilizar el rol actual del usuario.
        if (
            !Number.isInteger(claims.token_version) ||
            claims.token_version !== account.token_version
        ) {
            return res.status(401).json({
                detail: 'Sesión invalidada. Inicia sesión nuevamente'
            });
        }
        req.user = {
            ...claims,
            role: account.role
        };

        next();

    } catch (error) {
        if (
            error.name === 'JsonWebTokenError' ||
            error.name === 'TokenExpiredError' ||
            error.name === 'NotBeforeError'
        ) {
            return res.status(401).json({
                detail: 'Token inválido o expirado'
            });
        }

        console.error('Error de autorización:', error);

        return res.status(503).json({
            detail: 'No se pudo verificar la autorización'
        });
    }
}


// MIDDLEWARE DE ADMINISTRADOR


function admin(req, res, next) {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({
            detail: 'Requiere ADMIN'
        });
    }

    next();
}

export { auth, admin };
