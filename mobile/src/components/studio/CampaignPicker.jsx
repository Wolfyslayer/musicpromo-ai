import { useQuery } from "@tanstack/react-query";
import { loadCampaigns } from "@/services/data";
import { useAuth } from "@/lib/AuthContext";
import { Card } from "@/components/ui/controls";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";

/** Standalone studio: jump into the campaign studio so the song, artwork, and lyrics prefill. */
export default function CampaignPicker({ onPick }) {
  const { user, isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: ["campaigns", user?.id],
    queryFn: loadCampaigns,
    enabled: isAuthenticated,
  });
  const campaigns = query.data || [];

  if (!isAuthenticated || (!query.isLoading && !campaigns.length)) return null;

  return (
    <Card>
      <Text className="text-sm font-600">Start from a campaign</Text>
      <Field hint="Loads that campaign's song, artwork, and lyrics. Unsaved changes here are discarded.">
        <Select
          value=""
          onValueChange={onPick}
          disabled={query.isLoading}
          placeholder={query.isLoading ? "Loading campaigns…" : "Choose a campaign"}
          title="Campaign"
          options={campaigns.map((c) => ({
            value: c.id,
            label: [c.song?.title || "Untitled", c.artist?.name].filter(Boolean).join(" · "),
          }))}
        />
      </Field>
    </Card>
  );
}
