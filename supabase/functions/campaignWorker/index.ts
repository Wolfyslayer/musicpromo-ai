import { handleCampaignWorkerRequest } from "../_shared/campaignWorkerHandler.ts";

Deno.serve(handleCampaignWorkerRequest);
