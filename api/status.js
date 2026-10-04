export default async function handler(req, res) {
  const { runId } = req.query;
  const { GH_USER, GH_REPO, GH_TOKEN } = process.env;

  if (!runId) return res.status(400).json({ error: 'runId required' });

  try {
    const run = await fetch(
      `https://api.github.com/repos/${GH_USER}/${GH_REPO}/actions/runs/${runId}`,
      {
        headers: {
          'Authorization': `Bearer ${GH_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'web-to-apk'
        }
      }
    ).then(r => r.json());

    let artifactUrl = run.html_url;
    if (run.status === 'completed' && run.conclusion === 'success') {
      const arts = await fetch(run.artifacts_url, {
        headers: {
          'Authorization': `Bearer ${GH_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'web-to-apk'
        }
      }).then(r => r.json());
      if (arts.artifacts?.[0]) {
        artifactUrl = arts.artifacts[0].archive_download_url;
      }
    }

    res.json({
      status: run.status,
      conclusion: run.conclusion,
      htmlUrl: run.html_url,
      artifactUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
