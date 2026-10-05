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

export { fileToCoverReferencePng, urlToCoverReferencePng } from "@/lib/coverReferenceImage";

export async function generateCoverArtWithAi(payload) {
  const res = await db.functions.invoke("generateCoverArt", payload);
  if (res?.error) throw new Error(await messageFromFunctionInvokeError(res.error));
  const data = unwrap(res);
  if (data?.error) throw new Error(data.error);
  return data;
}
