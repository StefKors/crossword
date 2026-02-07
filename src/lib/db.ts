import { init } from '@instantdb/react';
import schema from '../instant.schema';

export const db = init({
    appId: import.meta.env.VITE_INSTANT_API_KEY!,
    schema,
    useDateObjects: true,
});