import { Card } from "@/components/ui/controls";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Text } from "@/components/ui/text";

export default function TextSection({ project, onField }) {
  return (
    <Card>
      <Text className="font-heading text-base">Text</Text>
      <Field label="Title">
        <Input value={project.title || ""} onChangeText={(v) => onField("title", v)} />
      </Field>
      <Field label="Artist Name">
        <Input value={project.artist_name || ""} onChangeText={(v) => onField("artist_name", v)} />
      </Field>
      <Field
        label="Hook / supporting line"
        hint={project.video_type === "promo" ? "Shown during the 3-second intro." : undefined}
      >
        <Textarea value={project.text || ""} onChangeText={(v) => onField("text", v)} className="min-h-16" />
      </Field>
      {project.video_type === "promo" ? (
        <Field label="Outro button" hint="Shown for the last 3 seconds of the promo.">
          <Input value={project.outro_cta || ""} placeholder="Listen now" onChangeText={(v) => onField("outro_cta", v)} />
        </Field>
      ) : null}
    </Card>
  );
}
