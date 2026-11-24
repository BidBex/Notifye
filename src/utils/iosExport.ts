export async function downloadCapacitorIpaBundle(hostedUrl?: string): Promise<void> {
  const params = new URLSearchParams();
  if (hostedUrl && hostedUrl.trim()) {
    params.set('hostedUrl', hostedUrl.trim());
  }
  const query = params.toString();
  const endpoint = query
    ? `/api/export/ios-ipa-bundle?${query}`
    : '/api/export/ios-ipa-bundle';

  const res = await fetch(endpoint);
  if (!res.ok) {
    let errMsg = 'Could not download iOS IPA project bundle.';
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) errMsg = data.error;
    } catch {
      // ignore non-JSON body
    }
    throw new Error(errMsg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'notifye-ios-ipa-project.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
