import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.env') });

const env = process.env;

if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error(
        "JWT_SECRET debe tener al menos 32 caracteres"
    );
}

if (!env.INTERNAL_SECRET || env.INTERNAL_SECRET.length < 32) {
    throw new Error(
        "INTERNAL_SECRET debe tener al menos 32 caracteres"
    );
}

export { env };
