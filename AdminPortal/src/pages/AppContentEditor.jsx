import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { api, fieldMap } from '../lib/api.js';
import { fmtDateTime } from '../lib/format.js';
import {
  Button, Card, CardBody, CardHead, Confirm, ErrorNote, Field, InfoNote, Input, PageHead, Select, Spinner, Tabs, Toggle, useToast,
} from '../components/ui/index.js';
import { HtmlPreview, RichTextEditor } from '../components/ui/RichTextEditor.jsx';
import { PhoneFrame } from '../components/config/PhoneFrame.jsx';

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const EMPTY = { name: '', slug: '', type: 'user', iconName: 'file-document-outline', isActive: true, content: '' };

export default function AppContentEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('edit');
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api
      .get(`/app-content/${id}`)
      .then((p) => {
        const f = { name: p.name, slug: p.slug, type: p.type, iconName: p.iconName || '', isActive: p.isActive, content: p.content || '' };
        setForm(f);
        setOriginal({ ...f, updatedAt: p.updatedAt });
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const onName = (v) => setForm((f) => ({ ...f, name: v, slug: isNew && !slugTouched ? slugify(v) : f.slug }));
  const slugChanged = !isNew && original && form.slug !== original.slug;
  const fe = fieldMap(error);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        const p = await api.post('/app-content', form);
        toast('Page created');
        navigate(`/app-content/${p._id}`, { replace: true });
      } else {
        const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => original[k] !== v));
        if (!Object.keys(changed).length) {
          toast('Nothing to save');
          return;
        }
        const p = await api.patch(`/app-content/${id}`, changed);
        const f = { name: p.name, slug: p.slug, type: p.type, iconName: p.iconName || '', isActive: p.isActive, content: p.content || '' };
        setForm(f);
        setOriginal({ ...f, updatedAt: p.updatedAt });
        toast('Page saved');
      }
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const onSave = () => {
    if (form.isActive || slugChanged) setConfirm(true);
    else save().catch(() => {});
  };

  if (loading) return <Spinner />;
  if (loadError) return <ErrorNote error={loadError} />;

  return (
    <>
      <button onClick={() => navigate('/app-content')} className="mb-3 inline-flex items-center gap-1.5 text-xs text-ink/50 hover:text-brand">
        <ArrowLeft size={13} /> All pages
      </button>
      <PageHead
        eyebrow={isNew ? 'New page' : `App content · ${form.type === 'driver' ? 'Driver app' : 'Rider app'}`}
        title={form.name || 'Untitled page'}
        description={original?.updatedAt ? `Last saved ${fmtDateTime(original.updatedAt)}` : 'HTML is cleaned on the server — scripts and embeds are removed.'}
        action={
          <>
            <Button variant="secondary" onClick={() => navigate('/app-content')}>Cancel</Button>
            <Button onClick={onSave} loading={busy}>{isNew ? 'Create page' : 'Save'}</Button>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHead
            eyebrow="Body"
            title="Content"
            action={<Tabs value={mode} onChange={setMode} options={[{ value: 'edit', label: 'Edit' }, { value: 'preview', label: 'Preview' }]} />}
          />
          <CardBody>
            {mode === 'edit' ? (
              <RichTextEditor value={form.content} onChange={(v) => set('content', v)} error={fe.content} placeholder="Write the page as riders or drivers will read it…" />
            ) : (
              <PhoneFrame title={form.name}>
                <HtmlPreview html={form.content} />
              </PhoneFrame>
            )}
            {fe.content && <p className="mt-1 text-[11px] text-red-600">{fe.content}</p>}
          </CardBody>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHead eyebrow="Details" title="Page settings" />
            <CardBody className="space-y-4">
              <Field label="Name" error={fe.name}>
                <Input value={form.name} onChange={(e) => onName(e.target.value)} error={fe.name} placeholder="Terms & Conditions" />
              </Field>
              <Field label="Slug" hint="Used by the apps to open this page" error={fe.slug}>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set('slug', e.target.value.toLowerCase());
                  }}
                  error={fe.slug}
                  placeholder="terms-and-conditions"
                />
              </Field>
              {slugChanged && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  The apps may open this page by its slug <code>{original.slug}</code>. Changing it can break that link.
                </div>
              )}
              <Field label="App" error={fe.type}>
                <Select
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                  options={[{ value: 'user', label: 'Rider app' }, { value: 'driver', label: 'Driver app' }]}
                />
              </Field>
              <Field label="Icon name" hint="MaterialCommunityIcons" error={fe.iconName}>
                <Input value={form.iconName} onChange={(e) => set('iconName', e.target.value)} placeholder="file-document-outline" />
              </Field>
              <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label={form.isActive ? 'Live in the app' : 'Hidden from the app'} />
            </CardBody>
          </Card>
          <InfoNote>Only live pages are listed by the apps. Saving a live page publishes it immediately.</InfoNote>
          {error && <ErrorNote error={error} />}
        </div>
      </div>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={save}
        eyebrow="Publish"
        title={isNew ? `Publish “${form.name}”?` : `Save “${form.name}”?`}
        confirmLabel={form.isActive ? 'Publish' : 'Save'}
        tone="primary"
      >
        {form.isActive && <p>This page is live — {form.type === 'driver' ? 'drivers' : 'riders'} will see the new version the next time they open it.</p>}
        {slugChanged && (
          <p className="mt-2">
            The slug changes from <code>{original.slug}</code> to <code>{form.slug}</code>.
          </p>
        )}
      </Confirm>
    </>
  );
}
