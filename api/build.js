export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { GH_USER, GH_REPO, GH_TOKEN } = process.env;

  try {
    // Trigger workflow
    const trigger = await fetch(
      `https://api.github.com/repos/${GH_USER}/${GH_REPO}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GH_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'web-to-apk'
        },
        body: JSON.stringify({
          event_type: 'build-apk',
          client_payload: req.body
        })
      }
    );

    if (!trigger.ok) {
      const err = await trigger.text();
      return res.status(500).json({ success: false, message: 'GitHub: ' + err });
    }

    // Tunggu beberapa detik agar workflow muncul
    await new Promise(r => setTimeout(r, 4000));

    // Ambil run terbaru
    const runs = await fetch(
      `https://api.github.com/repos/${GH_USER}/${GH_REPO}/actions/runs?event=repository_dispatch&per_page=1`,
      {
        headers: {
          'Authorization': `Bearer ${GH_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'web-to-apk'
        }
      }
    ).then(r => r.json());

    const runId = runs.workflow_runs?.[0]?.id;

    return res.json({ success: true, runId, htmlUrl: runs.workflow_runs?.[0]?.html_url });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
