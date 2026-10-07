export default function handler(req: any, res: any) {
  return res.status(200).json({
    status: 'healthy',
    app: 'RemoteHunter Pro',
    runtime: 'vercel-serverless',
    timestamp: new Date().toISOString()
  });
}
