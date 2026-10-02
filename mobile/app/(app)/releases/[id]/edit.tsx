import { useLocalSearchParams } from "expo-router";
import { ReleaseForm } from "@/components/ReleaseForm";

export default function EditRelease() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReleaseForm releaseId={String(id)} />;
}
