/** Základní údaje o aplikaci – stejné jako na webu (src/config.ts) */
export const APP_NAME = 'SealedVault';
export const SUPPORT_EMAIL = 'sealedvault.support@gmail.com';

/** Webová verze – odtud appka bere denní ceny (data/…) a míří sem odkazy na sdílené portfolio */
export const PUBLIC_URL = 'https://adaminooo.github.io/sealedvault/';

/**
 * Účty a synchronizace (Supabase). Jen veřejný „publishable“ klíč – data chrání pravidla RLS
 * v databázi (supabase/schema.sql). Tajný klíč do appky NIKDY nepatří.
 */
export const SUPABASE_URL = 'https://xvoosxlqoyrbefvwkdgm.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_HR4b2YUdDFiYGYKqm-gzjw_6kUpkF0w';
