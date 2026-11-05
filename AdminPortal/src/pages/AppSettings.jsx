import { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Smartphone } from 'lucide-react';
import { api, fieldMap } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { fmtDateTime } from '../lib/format.js';
import {
  Button, Card, CardBody, CardHead, ChangeSummary, Confirm, ErrorNote, Field, InfoNote, Input, PageHead, Spinner, Tabs, Toggle, useToast,
} from '../components/ui/index.js';
import { HtmlPreview, RichTextEditor } from '../components/ui/RichTextEditor.jsx';
import { PhoneFrame } from '../components/config/PhoneFrame.jsx';

const PLATFORM = { android: 'Android', ios: 'iOS' };
const URL_FIELDS = [
  ['onboardingBeforeKycUrl', 'Onboarding page — before KYC'],
  ['onboardingAfterKycUrl', 'Onboarding page — after KYC'],
  ['permissionGuideUrl', 'Permission guide'],
];
const FIELDS = ['appVersion', 'appBuildNumber', 'isUpdateMandatory', ...URL_FIELDS.map(([k]) => k), 'supportPhoneNumber', 'homePageContent'];
const LABELS = {
  appVersion: 'App version', appBuildNumber: 'Build number', isUpdateMandatory: 'Mandatory update', supportPhoneNumber: 'Support phone',
  homePageContent: 'Home page content', ...Object.fromEntries(URL_FIELDS),
};

const toForm = (s) => ({
  appVersion: s?.appVersion ?? '',
  appBuildNumber: s?.appBuildNumber != null ? String(s.appBuildNumber) : '',
  isUpdateMandatory: Boolean(s?.isUpdateMandatory),
  onboardingBeforeKycUrl: s?.onboardingBeforeKycUrl ?? '',
  onboardingAfterKycUrl: s?.onboardingAfterKycUrl ?? '',
  permissionGuideUrl: s?.permissionGuideUrl ?? '',
  supportPhoneNumber: s?.supportPhoneNumber ?? '',
  homePageContent: s?.homePageContent ?? '',
});

const isHttp = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const show = (k, v) => {
  if (k === 'isUpdateMandatory') return v ? 'On' : 'Off';
  if (k === 'homePageContent') return v ? `HTML, ${v.length} characters` : '—';
  return v === '' ? '—' : v;
};

export default function AppSettings() {
  const toast = useToast();
  const { data, error, loading, setData } = useApi('/settings');
  const [platform, setPlatform] = useState('android');
  const [form, setForm] = useState(toForm(null));
  const [htmlMode, setHtmlMode] = useState('edit');
  const [saveError, setSaveError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [mandatoryAsk, setMandatoryAsk] = useState(false);

  const records = data?.data || [];
  const current = records.find((r) => r.type === platform) || null;
  const other = records.find((r) => r.type !== platform) || null;
  const otherName = PLATFORM[platform === 'android' ? 'ios' : 'android'];

  useEffect(() => {
    setForm(toForm(current));
    setSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, current?._id, current?.updatedAt]);

  const base = toForm(current);
  const changes = useMemo(
    () => FIELDS.filter((k) => String(base[k]) !== String(form[k])).map((k) => ({ key: k, label: LABELS[k], before: show(k, base[k]), after: show(k, form[k]) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, current]
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Client-side checks mirror the server's, so problems show before the confirm step.
  const localErrors = () => {
    const errs = [];
    if (!/^\d+(\.\d+){0,2}$/.test(String(form.appVersion).trim())) errs.push({ field: 'appVersion', message: 'Use 1, 1.2 or 1.2.3' });
    if (!/^\d+$/.test(form.appBuildNumber) || Number(form.appBuildNumber) < 1) errs.push({ field: 'appBuildNumber', message: 'Whole number, 1 or more' });
    URL_FIELDS.forEach(([k]) => {
      if (form[k].trim() && !isHttp(form[k].trim())) errs.push({ field: k, message: 'Enter a full http(s) URL' });
    });
    if (form.supportPhoneNumber && !/^\d{10}$/.test(form.supportPhoneNumber.trim())) errs.push({ field: 'supportPhoneNumber', message: 'Exactly 10 digits' });
    return errs;
  };

  const review = () => {
    const errs = localErrors();
    if (errs.length) {
      setSaveError({ message: 'Please fix the highlighted fields', fieldErrors: errs });
      return;
    }
    setSaveError(null);
    if (!changes.length) {
      toast('Nothing has changed');
      return;
    }
    setConfirm(true);
  };

  const save = async () => {
    const body = {};
    changes.forEach(({ key }) => {
      if (key === 'appBuildNumber') body[key] = Number(form[key]);
      else if (typeof form[key] === 'string') body[key] = form[key].trim();
      else body[key] = form[key];
    });
    if (!current) {
      body.appVersion = form.appVersion.trim();
      body.appBuildNumber = Number(form.appBuildNumber);
    }
    try {
      const saved = await api.patch(`/settings/${platform}`, body);
      setData((d) => ({ ...d, data: [...(d?.data || []).filter((r) => r.type !== platform), saved] }));
      toast(`${PLATFORM[platform]} settings saved`);
    } catch (e) {
      setSaveError(e);
      throw e;
    }
  };

  const copyFromOther = () => {
    if (!other) return;
    const o = toForm(other);
    setForm((f) => ({ ...o, appVersion: f.appVersion, appBuildNumber: f.appBuildNumber, isUpdateMandatory: f.isUpdateMandatory }));
    toast(`Copied content and links from ${otherName}. Version fields were left alone. Review, then save.`);
  };

  const fe = fieldMap(saveError);

  return (
    <>
      <PageHead
        eyebrow="Configuration"
        title={`App settings · ${PLATFORM[platform]}`}
        description="What the apps read at start-up: the current store build, the update prompt, onboarding links, support number and the rider home page."
        action={<Tabs value={platform} onChange={setPlatform} options={[{ value: 'android', label: 'Android' }, { value: 'ios', label: 'iOS' }]} />}
      />
      <ErrorNote error={error} className="mb-4" />
      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-mist px-4 py-3 text-sm">
            <Smartphone size={16} className="text-brand" />
            <span>
              You are editing the <span className="font-medium">{PLATFORM[platform]}</span> record.
              {current ? ` Last saved ${fmtDateTime(current.updatedAt)}.` : ' It does not exist yet — saving creates it.'}
            </span>
            {other && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={copyFromOther}>
                <Copy size={13} /> Copy content from {otherName}
              </Button>
            )}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHead eyebrow="Store build" title="Version & updates" />
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="App version" hint="e.g. 1.4.2" error={fe.appVersion}>
                    <Input value={form.appVersion} onChange={(e) => set('appVersion', e.target.value)} error={fe.appVersion} />
                  </Field>
                  <Field label="Build number" error={fe.appBuildNumber}>
                    <Input type="number" min="1" value={form.appBuildNumber} onChange={(e) => set('appBuildNumber', e.target.value)} error={fe.appBuildNumber} />
                  </Field>
                </div>
                <Toggle
                  checked={form.isUpdateMandatory}
                  onChange={(v) => (v ? setMandatoryAsk(true) : set('isUpdateMandatory', false))}
                  label={form.isUpdateMandatory ? 'Update is mandatory' : 'Update is optional (dismissible prompt)'}
                />
                {form.isUpdateMandatory && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                    Everyone on an older {PLATFORM[platform]} build will be blocked until they update.
                  </p>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHead eyebrow="Links" title="Onboarding & support" />
              <CardBody className="space-y-4">
                {URL_FIELDS.map(([k, label]) => (
                  <Field key={k} label={label} error={fe[k]}>
                    <div className="flex gap-2">
                      <Input value={form[k]} onChange={(e) => set(k, e.target.value)} error={fe[k]} placeholder="https://" />
                      {isHttp(form[k]) && (
                        <a href={form[k]} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-md border border-line px-3 text-ink/55 hover:bg-mist hover:text-brand" aria-label="Open link">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </Field>
                ))}
                <Field label="Support phone number" hint="10 digits" error={fe.supportPhoneNumber}>
                  <Input value={form.supportPhoneNumber} onChange={(e) => set('supportPhoneNumber', e.target.value.replace(/\D/g, '').slice(0, 10))} error={fe.supportPhoneNumber} inputMode="numeric" />
                </Field>
              </CardBody>
            </Card>
            <Card className="lg:col-span-2">
              <CardHead
                eyebrow="Rider home screen"
                title="Home page content"
                action={<Tabs value={htmlMode} onChange={setHtmlMode} options={[{ value: 'edit', label: 'Edit' }, { value: 'preview', label: 'Preview' }]} />}
              />
              <CardBody>
                {htmlMode === 'edit' ? (
                  <RichTextEditor value={form.homePageContent} onChange={(v) => set('homePageContent', v)} minHeight="min-h-[12rem]" />
                ) : (
                  <PhoneFrame title="Home">
                    <HtmlPreview html={form.homePageContent} />
                  </PhoneFrame>
                )}
              </CardBody>
            </Card>
          </div>
          <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white/95 py-3 backdrop-blur">
            {saveError && <ErrorNote error={saveError} className="mr-auto" />}
            <span className="text-xs text-ink/50">{changes.length ? `${changes.length} unsaved change${changes.length > 1 ? 's' : ''}` : 'No changes'}</span>
            <Button variant="secondary" onClick={() => setForm(toForm(current))} disabled={!changes.length}>
              Discard
            </Button>
            <Button onClick={review}>Review & save</Button>
          </div>
          <InfoNote className="mt-2">Settings are read by the apps when they start, so a change reaches people the next time they open the app.</InfoNote>
        </>
      )}
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={save}
        eyebrow={PLATFORM[platform]}
        title={`Save ${PLATFORM[platform]} settings?`}
        confirmLabel="Save settings"
        tone="primary"
      >
        <ChangeSummary changes={changes} />
        <p>Only the {PLATFORM[platform]} record changes. This is recorded in the audit log.</p>
      </Confirm>
      <Confirm
        open={mandatoryAsk}
        onClose={() => setMandatoryAsk(false)}
        onConfirm={() => set('isUpdateMandatory', true)}
        eyebrow="High impact"
        title="Make this update mandatory?"
        confirmLabel="Make mandatory"
      >
        Once saved, everyone on a {PLATFORM[platform]} build older than {form.appVersion || 'this version'} (build {form.appBuildNumber || '—'}) is blocked from using the app
        until they update from the store. Make sure the build is live in the store first.
      </Confirm>
    </>
  );
}
