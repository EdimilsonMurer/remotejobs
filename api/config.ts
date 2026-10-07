export default function handler(req: any, res: any) {
  // Lê as variáveis de ambiente configuradas no painel da Vercel
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();

  const supabaseAnonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const isConfigured = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('sua-instancia') &&
    !supabaseUrl.includes('seu-projeto')
  );

  return res.status(200).json({
    supabaseUrl: isConfigured ? supabaseUrl : '',
    supabaseAnonKey: isConfigured ? supabaseAnonKey : '',
    isConfigured,
    source: isConfigured ? 'vercel_environment' : 'none',
    hasGemini: Boolean(process.env.GEMINI_API_KEY)
  });
}
