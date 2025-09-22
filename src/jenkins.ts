// Small, focused Jenkins client used by server.ts

const JENKINS_URL = process.env.JENKINS_URL || "http://localhost:8080";
const JENKINS_USER = process.env.JENKINS_USER || "";
const JENKINS_API_TOKEN = process.env.JENKINS_API_TOKEN || "";

/** Basic auth header for Jenkins */
function jenkinsAuthHeader(): string {
    const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`).toString("base64");
    return `Basic ${auth}`;
}

/** Try to fetch crumb (CSRF). Returns header pair or null */
export async function getJenkinsCrumb(): Promise<{ field: string; crumb: string } | null> {
    try {
        const res = await fetch(`${JENKINS_URL}/crumbIssuer/api/json`, {
            headers: { Authorization: jenkinsAuthHeader() },
        });
        if (!res.ok) return null;
        const json = await res.json();
        return { field: json.crumbRequestField, crumb: json.crumb };
    } catch {
        return null;
    }
}

/**
 * Trigger a Jenkins job (buildWithParameters).
 * Returns queue URL (absolute) on success.
 */
export async function triggerJenkinsJob(jobName: string, params: Record<string, string> = {}): Promise<string> {
    const url = `${JENKINS_URL}/job/${encodeURIComponent(jobName)}/buildWithParameters`;
    const body = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => body.append(k, v));

    const crumb = await getJenkinsCrumb();
    const headers: Record<string, string> = {
        Authorization: jenkinsAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
    };
    if (crumb) headers[crumb.field] = crumb.crumb;

    // ask not to follow redirect so we can read Location
    const res = await fetch(url, {
        method: "POST",
        headers,
        body: body.toString(),
        redirect: "manual" as any,
    });

    if (res.status === 201 || res.status === 302) {
        const loc = res.headers.get("location") || res.headers.get("Location") || "";
        const queueUrl = loc.startsWith("http") ? loc : `${JENKINS_URL}${loc}`;
        return queueUrl;
    }
    const txt = await res.text();
    throw new Error(`Jenkins trigger failed ${res.status}: ${txt}`);
}

/**
 * Poll queue item until it produces an executable (build).
 * Returns { buildUrl, buildNumber }.
 */
export async function waitForBuildFromQueue(queueUrl: string, timeoutMs = 120000): Promise<{ buildUrl: string, buildNumber: number }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const r = await fetch(`${queueUrl}api/json`, { headers: { Authorization: jenkinsAuthHeader() } });
        if (r.ok) {
            const q = await r.json();
            if (q.executable && q.executable.number) {
                const buildNumber = q.executable.number;
                const buildUrl = q.executable.url || `${JENKINS_URL}/job/${encodeURIComponent(q.task?.name || "")}/${buildNumber}/`;
                return { buildUrl, buildNumber };
            }
        }
        await new Promise(r => setTimeout(r, 1500));
    }
    throw new Error("Timed out waiting for Jenkins queue to produce a build");
}

/**
 * Poll job build until result is present. Returns build JSON.
 */
export async function waitForBuildResult(jobName: string, buildNumber: number, timeoutMs = 180000): Promise<any> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const r = await fetch(`${JENKINS_URL}/job/${encodeURIComponent(jobName)}/${buildNumber}/api/json`, {
            headers: { Authorization: jenkinsAuthHeader() },
        });
        if (r.ok) {
            const b = await r.json();
            if (b.result) return b;
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error("Timed out waiting for Jenkins build result");
}
