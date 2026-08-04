export async function parseJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const errData = await response.json();
      throw new Error(errData.error || `Request failed with status ${response.status}`);
    }
    const text = await response.text();
    throw new Error(
      `Request failed with status ${response.status}. Response preview: ${text.slice(0, 300)}`
    );
  }

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `Expected JSON but received ${contentType || "unknown"}. Check backend route/proxy. Response preview: ${text.slice(0, 100)}`
    );
  }

  return response.json();
}
