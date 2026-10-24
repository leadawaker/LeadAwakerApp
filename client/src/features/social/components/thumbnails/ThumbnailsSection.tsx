// The Thumbnails section of the Socials page: the form on the left (agency and Managers), the gallery
// on the right; stacked on a phone. While anything generates, the gallery polls every 4 seconds.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SocialApiError } from "../../api/socialApi";
import {
  fetchThumbnailConfig,
  fetchThumbnailRefs,
  fetchThumbnails,
  fetchThumbnailStyles,
  thumbnailConfigKey,
  thumbnailRefsKey,
  thumbnailsKey,
  thumbnailStylesKey,
  type ThumbnailView,
} from "../../api/thumbnailsApi";
import { anyGenerating, emptyForm, formFromThumbnail, thumbErrorKey, type ComposerForm } from "../../lib/thumbnails";
import { ThumbnailComposer } from "./ThumbnailComposer";
import { ThumbnailGallery } from "./ThumbnailGallery";

export function ThumbnailsSection({ accountId }: { accountId: number }) {
  const { t } = useTranslation("social");
  const stacked = useIsMobile(1024);
  const { isAgencyUser } = useWorkspace();
  const [form, setForm] = useState<ComposerForm>(emptyForm);
  const config = useQuery({ queryKey: thumbnailConfigKey(accountId), queryFn: () => fetchThumbnailConfig(accountId), staleTime: 60_000 });
  const refs = useQuery({ queryKey: thumbnailRefsKey(accountId), queryFn: () => fetchThumbnailRefs(accountId), staleTime: 30_000 });
  const styles = useQuery({ queryKey: thumbnailStylesKey(accountId), queryFn: () => fetchThumbnailStyles(accountId), staleTime: 30_000 });
  const thumbs = useQuery({
    queryKey: thumbnailsKey(accountId),
    queryFn: () => fetchThumbnails(accountId),
    staleTime: 10_000,
    refetchInterval: (q) => (anyGenerating(q.state.data as ThumbnailView[] | undefined) ? 4_000 : false),
  });
  const canCreate = config.data?.canCreate === true;
  const loadError = config.error ?? thumbs.error;

  const reuse = (x: ThumbnailView) => {
    setForm(formFromThumbnail(x, refs.data ?? []));
    document.querySelector('[data-testid="thumb-composer"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const gallery = <ThumbnailGallery accountId={accountId} thumbs={thumbs.data ?? []} loading={thumbs.isLoading} canEdit={canCreate} canLink={isAgencyUser} onReuse={reuse} />;
  const composer = canCreate ? (
    <ThumbnailComposer accountId={accountId} form={form} setForm={setForm} refs={refs.data ?? []} styles={styles.data ?? []} configured={config.data?.configured === true} />
  ) : null;

  return (
    <div data-testid="thumbnails-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loadError && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "hsl(var(--destructive))" }}>{t(thumbErrorKey(loadError instanceof SocialApiError ? loadError.reason : "failed"))}</p>}
      {!composer ? (
        gallery
      ) : stacked ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{composer}{gallery}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 460px) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
          {composer}
          {gallery}
        </div>
      )}
    </div>
  );
}
