import { db } from "@/api/base44Client";

export { fileToCoverReferencePng, urlToCoverReferencePng } from "@/lib/coverReferenceImage";
import { messageFromFunctionInvokeError } from "@/lib/functionInvokeError";

function unwrap(res) {
  return res?.data ?? res;
}

export async function fetchCoverArtAiStatus() {
  const res = await db.functions.invoke("generateCoverArt", { action: "status" });
  return unwrap(res);
}

export async function generateCoverArtWithAi(payload) {
  try {
    const res = await db.functions.invoke("generateCoverArt", payload);
    if (res?.error) throw new Error(await messageFromFunctionInvokeError(res.error));
    const data = unwrap(res);
    if (data?.error) throw new Error(data.error);
    return data;
  } catch (err) {
    if (err?.data?.code === "INSUFFICIENT_CREDITS" || err?.status === 402) {
      const e = new Error(err.message);
      e.status = 402;
      e.data = err.data;
      throw e;
    }
    throw err;
  }
}
