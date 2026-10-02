import { useFocusEffect, useRouter } from 'expo-router';
import { Archive, Copy, Plus, Search, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { db } from '@/api/base44Client';
import CampaignCard from '@/components/CampaignCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { useWorkspaceRefresh } from '@/lib/AuthContext';
import { CAMPAIGN_STATUSES } from '@/services/constants';
import { loadCampaigns } from '@/services/data';

export default function Campaigns() {
  const router = useRouter();
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [artist, setArtist] = useState('all');
  const [status, setStatus] = useState('all');
  const [menu, setMenu] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);

  const reload = useCallback(() => loadCampaigns().then(setRows).catch(() => setRows([])), []);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );
  useWorkspaceRefresh(reload);

  const artists = useMemo(() => {
    const map: Record<string, any> = {};
    (rows || []).forEach((r) => {
      if (r.artist) map[r.artist.id] = r.artist;
    });
    return Object.values(map);
  }, [rows]);

  const filtered = (rows || []).filter((c) => {
    const matchQ =
      !q ||
      (c.song?.title || '').toLowerCase().includes(q.toLowerCase()) ||
      (c.artist?.name || '').toLowerCase().includes(q.toLowerCase());
    const matchArtist = artist === 'all' || c.artist_id === artist;
    const matchStatus = status === 'all' || c.status === status;
    return matchQ && matchArtist && matchStatus;
  });

  const guarded = (fn: () => Promise<void>) => async () => {
    try {
      await fn();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Something went wrong', description: e?.message });
    }
  };

  const duplicate = (c: any) =>
    guarded(async () => {
      await db.entities.Campaign.create({
        song_id: c.song_id,
        artist_id: c.artist_id,
        name: (c.name || 'Campaign') + ' (copy)',
        status: 'draft',
        duration_days: c.duration_days,
        goals: c.goals || [],
        start_date: c.start_date,
        end_date: c.end_date,
        summary: c.summary,
        is_demo: false,
      });
      toast({ title: 'Campaign duplicated' });
      reload();
    })();
  const archive = (c: any) =>
    guarded(async () => {
      await db.entities.Campaign.update(c.id, { status: 'archived' });
      toast({ title: 'Campaign archived' });
      reload();
    })();
  const remove = (c: any) =>
    guarded(async () => {
      await db.entities.CampaignDay.deleteMany({ campaign_id: c.id });
      await db.entities.Campaign.delete(c.id);
      setConfirm(null);
      toast({ title: 'Campaign deleted' });
      reload();
    })();

  const menuItems = [
    { label: 'Duplicate', icon: Copy, run: duplicate, destructive: false },
    { label: 'Archive', icon: Archive, run: archive, destructive: false },
    { label: 'Delete', icon: Trash2, run: (c: any) => setConfirm({ camp: c }), destructive: true },
  ];

  return (
    <Screen onRefresh={reload} contentClassName="gap-5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-heading-bold text-2xl tracking-tight">Campaigns</Text>
        <Button onPress={() => router.push('/create')} className="rounded-full">
          <Icon as={Plus} size={16} className="text-primary-foreground" />
          <Text className="text-sm font-medium text-primary-foreground">New</Text>
        </Button>
      </View>

      <View className="gap-2">
        <View className="justify-center">
          <View pointerEvents="none" className="absolute left-3 z-10">
            <Icon as={Search} size={16} className="text-muted-foreground" />
          </View>
          <Input value={q} onChangeText={setQ} placeholder="Search song or artist…" className="rounded-xl pl-9" />
        </View>
        <Select
          value={artist}
          onValueChange={setArtist}
          title="Artist"
          className="rounded-xl"
          options={[{ value: 'all', label: 'All artists' }, ...artists.map((a: any) => ({ value: a.id, label: a.name }))]}
        />
        <Select
          value={status}
          onValueChange={setStatus}
          title="Status"
          className="rounded-xl"
          options={[{ value: 'all', label: 'All statuses' }, ...CAMPAIGN_STATUSES.map((s: any) => ({ value: s.id, label: s.label }))]}
        />
      </View>

      {filtered.length ? (
        <View className="gap-3">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} song={c.song} artist={c.artist} daysCount={c.daysCount} videosCount={c.videosCount} onAction={(camp) => setMenu(camp)} />
          ))}
        </View>
      ) : rows ? (
        <EmptyState icon={Search} title="No campaigns found" description="Try a different search or create a new campaign." />
      ) : (
        <Skeleton className="h-40 rounded-2xl" />
      )}

      <Dialog open={!!menu} onOpenChange={(o) => !o && setMenu(null)} variant="sheet" title={menu?.name || 'Campaign'}>
        <View className="pb-2">
          {menuItems.map(({ label, icon, run, destructive }) => (
            <Pressable
              key={label}
              onPress={() => {
                const camp = menu;
                setMenu(null);
                setTimeout(() => run(camp), 300);
              }}
              className="min-h-12 flex-row items-center gap-3 border-b border-border/50 px-1">
              <Icon as={icon} size={18} className={destructive ? 'text-destructive' : 'text-foreground'} />
              <Text className={destructive ? 'text-base text-destructive' : 'text-base'}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this campaign?"
        description="This removes the campaign and its day-by-day plan. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => confirm && remove(confirm.camp)}
      />
    </Screen>
  );
}
