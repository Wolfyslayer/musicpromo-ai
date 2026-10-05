import { useState } from "react";
import { Link } from "react-router-dom";
import { Palette, Sparkles, PenTool } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/AuthContext";
import ArtworkAiPanel from "@/components/artwork/ArtworkAiPanel";
import ArtworkDesignEditor from "@/components/artwork/ArtworkDesignEditor";
import ArtworkImage from "@/components/ArtworkImage";

export default function ArtworkStudio() {
  const { requireAuth } = useAuth();
  const [sharedUrl, setSharedUrl] = useState("");
  const [tab, setTab] = useState("ai");

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-6 overflow-y-auto p-4 pb-24 md:p-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Palette className="h-6 w-6" />
          <span className="text-xs font-600 uppercase tracking-widest">Cover lab</span>
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Album art studio</h1>
        <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
          Start with a long prompt and refine in chat, or design in the layered editor — then use the URL on a{" "}
          <Link to="/releases" className="text-primary underline underline-offset-2">
            release
          </Link>
          ,{" "}
          <Link to="/studio" className="text-primary underline underline-offset-2">
            video studio
          </Link>
          , or social posts.
        </p>
      </header>

      {sharedUrl ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          <ArtworkImage src={sharedUrl} alt="" className="h-14 w-14 rounded-lg" rounded="rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Latest cover URL ready</p>
            <p className="truncate text-xs text-muted-foreground">{sharedUrl}</p>
          </div>
          <button
            type="button"
            className="text-xs font-600 text-primary underline"
            onClick={() => navigator.clipboard?.writeText(sharedUrl)}
          >
            Copy link
          </button>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1">
        <TabsList className="mb-4 h-auto flex-wrap gap-1">
          <TabsTrigger value="ai" className="min-h-10 gap-1.5 px-4">
            <Sparkles className="h-4 w-4" />
            AI generate
          </TabsTrigger>
          <TabsTrigger value="design" className="min-h-10 gap-1.5 px-4">
            <PenTool className="h-4 w-4" />
            Design editor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-0 focus-visible:outline-none">
          <ArtworkAiPanel
            requireAuth={requireAuth}
            onImageReady={(url) => {
              setSharedUrl(url);
            }}
          />
        </TabsContent>

        <TabsContent value="design" className="mt-0 focus-visible:outline-none">
          <ArtworkDesignEditor
            seedImageUrl={sharedUrl}
            requireAuth={requireAuth}
            onExportUrl={setSharedUrl}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
