import { useAuth } from "@/lib/AuthContext";
import ArtworkUpload from "@/components/ArtworkUpload";
import AudioUpload from "@/components/AudioUpload";
import { Card } from "@/components/ui/controls";
import { Field } from "@/components/ui/label";
import { Text } from "@/components/ui/text";

export default function AssetsSection({ project, previewAudioUrl, onArtwork, onAudio }) {
  const { requireAuth } = useAuth();
  return (
    <Card>
      <Text className="font-heading text-base">Media</Text>
      <Text className="text-sm text-muted-foreground">Replace the artwork or audio used in this preview.</Text>
      <Field label="Artwork">
        <ArtworkUpload
          value={project.artwork_url}
          guard={requireAuth}
          onChange={(payload) => onArtwork(typeof payload === "string" ? payload : payload?.url || "")}
        />
      </Field>
      <Field label="Audio">
        <AudioUpload value={project.audio_url} signedUrl={previewAudioUrl} guard={requireAuth} onChange={onAudio} />
      </Field>
      {project.asset_label ? (
        <Text className="text-xs text-muted-foreground">
          Artwork read as {project.asset_label}. Keywords: {(project.asset_keywords || []).join(" · ")}
        </Text>
      ) : null}
    </Card>
  );
}
