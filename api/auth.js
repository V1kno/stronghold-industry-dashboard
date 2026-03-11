export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body;
  const correctPassword = process.env.DASHBOARD_PASSWORD;

  if (!correctPassword) {
    return res.status(200).json({ success: true });
  }

  if (password === correctPassword) {
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ success: false, error: 'Invalid password' });
}