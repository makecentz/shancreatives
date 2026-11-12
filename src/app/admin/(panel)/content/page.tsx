import { savePolicy, saveSiteContent } from "@/app/admin/actions/store";
import { ActionForm } from "@/components/admin/action-form";
import { AssetInput } from "@/components/admin/asset-input";
import { AdminHeader } from "@/components/admin/header";
import { Card, Field, PageIntro, Pill, adminInput } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { getContentState, getPoliciesForEdit } from "@/lib/data/admin-extra";
import { isDemoMode } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Website Content" };

const area = `${adminInput} h-auto py-2`;

export default async function ContentPage() {
  await requirePermission("content.manage");
  const [state, policies] = await Promise.all([getContentState(), getPoliciesForEdit()]);
  const demo = isDemoMode();
  const d = state.draft;
  return (
    <div className="space-y-8">
      <AdminHeader title="Website Content" subtitle="Homepage, branding, about and contact details." />
      <PageIntro>Save a draft as often as you like; the live storefront only changes when you click &ldquo;Publish to live site&rdquo;. {state.publishedAt ? `Last published ${formatDate(state.publishedAt)}.` : ""} {state.hasUnpublished ? <Pill tone="amber">Unpublished changes</Pill> : null}</PageIntro>
      <ActionForm action={saveSiteContent} submitLabel="Publish to live site" submitName="publish" submitValue="1" secondary={{ label: "Save draft", name: "publish", value: "0" }} disabled={demo} className="space-y-6">
        <Card title="Branding">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Logo" hint="Defaults to the Shagannan Shenanigans crown logo."><AssetInput name="logoUrl" defaultValue={d.logoUrl} demo={demo} /></Field>
            <Field label="Favicon"><AssetInput name="faviconUrl" defaultValue={d.faviconUrl} demo={demo} accept="image/png,image/svg+xml,image/x-icon" /></Field>
            <Field label="Promo banner" hint="Shown above the header. Leave blank to hide." className="md:col-span-2"><input name="promoBanner" defaultValue={d.promoBanner ?? ""} className={adminInput} /></Field>
          </div>
        </Card>
        <Card title="Homepage hero">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Eyebrow"><input name="heroEyebrow" defaultValue={d.heroEyebrow} className={adminInput} /></Field>
            <Field label="Headline"><input name="heroHeadline" defaultValue={d.heroHeadline} className={adminInput} /></Field>
            <Field label="Description" className="md:col-span-2"><textarea name="heroDescription" rows={3} defaultValue={d.heroDescription} className={area} /></Field>
            <Field label="Hero background video" className="md:col-span-2" hint="MP4 (H.264), MOV or WebM, up to 50 MB. Best: 1920 × 1080 (16:9), 10 to 20 seconds, looping, no sound needed. The video fills the whole hero behind the text; the left side is softened so the words stay readable, so keep the main subject on the right half and away from the top and bottom edges, which get cropped on phones. Leave blank to show the color background.">
              <AssetInput name="heroVideoUrl" defaultValue={d.heroVideoUrl} demo={demo} bucket="site-videos" maxMb={50} accept="video/*,.mp4,.mov,.webm" preview="video" />
            </Field>
            <Field label="Video cover image" className="md:col-span-2" hint="Optional. Shown while the video loads, and instead of the video for visitors who turn off motion. Use a still frame from the video, 1920 × 1080 JPG or WebP.">
              <AssetInput name="heroVideoPosterUrl" defaultValue={d.heroVideoPosterUrl} demo={demo} accept="image/jpeg,image/webp,image/png" preview="image" />
            </Field>
            <Field label="Primary button label"><input name="primaryLabel" defaultValue={d.heroPrimaryCta.label} className={adminInput} /></Field>
            <Field label="Primary button link"><input name="primaryHref" defaultValue={d.heroPrimaryCta.href} className={adminInput} /></Field>
            <Field label="Secondary button label"><input name="secondaryLabel" defaultValue={d.heroSecondaryCta.label} className={adminInput} /></Field>
            <Field label="Secondary button link"><input name="secondaryHref" defaultValue={d.heroSecondaryCta.href} className={adminInput} /></Field>
          </div>
        </Card>
        <Card title="About, contact and footer">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="About headline"><input name="aboutHeadline" defaultValue={d.aboutHeadline} className={adminInput} /></Field>
            <Field label="Footer tagline"><input name="footerTagline" defaultValue={d.footerTagline} className={adminInput} /></Field>
            <Field label="About story" className="md:col-span-2"><textarea name="aboutBody" rows={5} defaultValue={d.aboutBody} className={area} /></Field>
            <Field label="Contact email"><input name="contactEmail" type="email" defaultValue={d.contactEmail ?? ""} className={adminInput} /></Field>
            <Field label="Contact phone"><input name="contactPhone" defaultValue={d.contactPhone ?? ""} className={adminInput} /></Field>
            <Field label="Instagram URL"><input name="instagram" type="url" defaultValue={d.socialLinks.instagram ?? ""} className={adminInput} /></Field>
            <Field label="Facebook URL"><input name="facebook" type="url" defaultValue={d.socialLinks.facebook ?? ""} className={adminInput} /></Field>
            <Field label="TikTok URL"><input name="tiktok" type="url" defaultValue={d.socialLinks.tiktok ?? ""} className={adminInput} /></Field>
            <Field label="Pinterest URL"><input name="pinterest" type="url" defaultValue={d.socialLinks.pinterest ?? ""} className={adminInput} /></Field>
          </div>
        </Card>
        <p className="text-sm text-admin-muted">&ldquo;Save draft&rdquo; keeps your changes private. &ldquo;Publish to live site&rdquo; saves them and updates the storefront right away.</p>
      </ActionForm>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Policies</h2>
        <PageIntro>The starter policy text is a placeholder. Review it (ideally with a professional) before launch. Saving a policy publishes it.</PageIntro>
        {policies.map((p) => (
          <details key={p.slug} className="rounded-2xl border border-admin-border bg-admin-lavender p-5">
            <summary className="cursor-pointer font-medium">{p.title} <span className="text-xs text-admin-muted">/policies/{p.slug}</span></summary>
            <ActionForm action={savePolicy.bind(null, p.slug)} submitLabel="Publish policy" disabled={demo} className="mt-4 space-y-3">
              <Field label="Title"><input name="title" defaultValue={p.title} className={adminInput} /></Field>
              <Field label="Body" hint="Plain text. Each line is a paragraph; lines starting with ## become headings."><textarea name="body" rows={12} defaultValue={p.body} className={area} /></Field>
            </ActionForm>
          </details>
        ))}
      </div>
    </div>
  );
}
