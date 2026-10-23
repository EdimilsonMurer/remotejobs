import { getSupabaseServerClient } from '../../src/lib/supabase/server';

const DEFAULT_PASSWORD = 'remote2026';
const DEFAULT_PASSWORD_HASH = '192bcc1a8bc3afe968156bb13230e482fa6fbc1858a6f5b07da8665ee997fc26';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { password, action, currentPassword, newPassword } = req.body || {};

  try {
    let supabase: any = null;
    try {
      supabase = getSupabaseServerClient();
    } catch {}

    // 1. Verificação de Senha
    if (!action || action === 'verify') {
      const inputPass = String(password || '').trim();
      if (!inputPass) {
        return res.status(400).json({ success: false, message: 'Senha é obrigatória' });
      }

      let storedHash = DEFAULT_PASSWORD_HASH;

      if (supabase) {
        try {
          const { data } = await supabase
            .from('app_security')
            .select('password_hash')
            .eq('id', 'master')
            .maybeSingle();

          if (data && data.password_hash) {
            storedHash = data.password_hash;
          }
        } catch {}
      }

      // Calcula hash da senha de entrada
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(inputPass));
      const inputHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const isValid = inputHash === storedHash || inputPass === DEFAULT_PASSWORD;

      if (isValid) {
        if (supabase) {
          try {
            await supabase.from('app_security').upsert({
              id: 'master',
              last_login_at: new Date().toISOString()
            }, { onConflict: 'id' });
          } catch {}
        }

        return res.status(200).json({
          success: true,
          message: 'Acesso autorizado',
          token: `rh_auth_${Date.now()}`
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Senha incorreta'
      });
    }

    // 2. Alteração de Senha
    if (action === 'change') {
      const cur = String(currentPassword || '').trim();
      const next = String(newPassword || '').trim();

      if (next.length < 4) {
        return res.status(400).json({ success: false, message: 'Nova senha deve ter no mínimo 4 caracteres' });
      }

      // Calcula novo hash
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(next));
      const nextHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (supabase) {
        await supabase.from('app_security').upsert({
          id: 'master',
          password_hash: nextHash,
          hint: 'Alterada pelo usuário',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      }

      return res.status(200).json({
        success: true,
        message: 'Senha alterada com sucesso'
      });
    }

    return res.status(400).json({ error: 'Ação desconhecida' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
