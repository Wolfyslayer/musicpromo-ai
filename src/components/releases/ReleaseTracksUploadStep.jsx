import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { db } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import AudioUpload from "@/components/AudioUpload";
import WizardStepIntro from "@/components/ux/WizardStepIntro";
import { countSongsMissingAudio } from "@/services/releaseDefaults";
import { audioDisplayName } from "@/services/audioDisplay";
function TrackUploadRow({ song, release, expanded, onToggle, onSaved, requireAuth }) {
  const { toast } = useToast();

  const saveAudio = async (payload) => {
    try {
      await db.entities.Song.update(song.id, {
        audio_url: payload.file_uri,
        audio_duration: payload.duration,
        audio_filename: payload.name || "",
      });
      toast({ title: "Audio saved", description: song.title });
      onSaved?.();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save audio", description: e.message });
    }
  };

  const hasAudio = Boolean(song.audio_url);
  const audioLabel = hasAudio
    ? audioDisplayName({ audioFilename: song.audio_filename, audioUrl: song.audio_url })
    : "";

  return (
    <li
      id={`track-${song.id}`}
      className={`rounded-xl border p-3 transition ${expanded ? "border-primary/40 bg-primary/5" : "border-border/60"}`}
    >
      <button type="button" className="flex w-full items-center gap-2 text-left" onClick={onToggle}>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs tabular-nums">
          {song.track_number || "·"}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{song.title}</span>
        {hasAudio ? (
          <span className="inline-flex max-w-[45%] items-center gap-1 truncate text-xs text-primary" title={audioLabel}>
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{audioLabel}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Needs audio</span>
        )}
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-border/40 pt-4">
          <p className="text-xs text-muted-foreground">
            {release.genre || "Genre not set"} · {release.language || "English"} (from release)
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Audio</Label>
            <AudioUpload
              guard={requireAuth}
              value={song.audio_url}
              signedUrl={song.audio_url}
              fileName={song.audio_filename}
              durationSec={song.audio_duration}
              onChange={(payload) => requireAuth(() => saveAudio(payload))}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}

export default function ReleaseTracksUploadStep({ release, songs, focusSongId, onSaved, requireAuth }) {
  const [openId, setOpenId] = useState(focusSongId || songs[0]?.id || "");

  useEffect(() => {
    if (focusSongId) {
      setOpenId(focusSongId);
      requestAnimationFrame(() => {
        document.getElementById(`track-${focusSongId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, [focusSongId]);

  const missing = useMemo(() => countSongsMissingAudio(songs), [songs]);

  if (!songs.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Add track titles on the previous step, then upload audio for each song here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <WizardStepIntro
        title="Upload audio"
        description="Add the master file for each track. We’ll ask for lyrics on the next step — you can skip that if you prefer."
      />
      {missing > 0 ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
          {missing} track{missing === 1 ? "" : "s"} still need audio before you can generate the campaign.
        </p>
      ) : (
        <p className="text-xs font-medium text-primary">All tracks have audio — you can continue to rollout & generate.</p>
      )}
      <ul className="space-y-2">
        {songs.map((s) => (
          <TrackUploadRow
            key={s.id}
            song={s}
            release={release}
            expanded={openId === s.id}
            onToggle={() => setOpenId((id) => (id === s.id ? "" : s.id))}
            onSaved={onSaved}
            requireAuth={requireAuth}
          />
        ))}
      </ul>
    </div>
  );
}
