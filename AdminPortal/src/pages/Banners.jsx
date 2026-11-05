import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ImageOff, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import {
  Badge, Button, Card, CardBody, CardHead, Confirm, EmptyState, ErrorNote, Field, Input, Modal, PageHead, Spinner, Tabs, Toggle, useToast,
} from '../components/ui/index.js';
import { PhoneFrame } from '../components/config/PhoneFrame.jsx';

const PLATFORM = { android: 'Android', ios: 'iOS' };
const strip = (list) =>
  list.map((b, i) => ({ ...(b._id && { _id: b._id }), title: b.title || '', imageUrl: b.imageUrl, linkUrl: b.linkUrl || '', order: i, isActive: b.isActive !== false }));

function BannerImage({ src, className = '' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return src && !broken ? (
    <img src={src} alt="" onError={() => setBroken(true)} className={`aspect-[2.4/1] w-full rounded-md border border-line object-cover ${className}`} />
  ) : (
    <span className={`flex aspect-[2.4/1] w-full items-center justify-center rounded-md border border-line bg-mist text-ink/35 ${className}`}>
      <ImageOff size={18} />
    </span>
  );
}

function BannerModal({ open, initial, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', imageUrl: '', linkUrl: '', isActive: true });
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...initial } : { title: '', imageUrl: '', linkUrl: '', isActive: true });
      setErrors({});
    }
  }, [open, initial]);

  const upload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    setUploading(true);
    try {
      const { url } = await api.upload('/uploads/image', fd);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (e) {
      toast.error(e);
    } finally {
      setUploading(false);
    }
  };

  const done = () => {
    const e = {};
    if (!/^https?:\/\//i.test(form.imageUrl.trim())) e.imageUrl = 'Upload an image or paste an http(s) URL';
    if (form.linkUrl && /^\s*(javascript|data|vbscript):/i.test(form.linkUrl)) e.linkUrl = 'This link type is not allowed';
    setErrors(e);
    if (Object.keys(e).length) return;
    onDone({ ...form, imageUrl: form.imageUrl.trim(), linkUrl: form.linkUrl.trim(), title: form.title.trim() });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Promotional banner"
      title={initial ? 'Edit banner' : 'Add banner'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={done}>{initial ? 'Update' : 'Add'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <BannerImage src={form.imageUrl} />
        <Field label="Image" hint="Wide, about 2.4 : 1 · JPG, PNG or WebP" error={errors.imageUrl}>
          <div className="flex gap-2">
            <Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://…" error={errors.imageUrl} />
            <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 text-sm text-ink/70 hover:bg-mist">
              <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploading} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
        </Field>
        <Field label="Title" hint="Optional, for your reference and accessibility">
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </Field>
        <Field label="Link when tapped" hint="https:// link or in-app deep link" error={errors.linkUrl}>
          <Input value={form.linkUrl} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))} placeholder="https://bharatyaatri.com/offer" error={errors.linkUrl} />
        </Field>
        <Toggle checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label={form.isActive ? 'Shown in the app' : 'Parked (hidden)'} />
      </div>
    </Modal>
  );
}

export default function Banners() {
  const toast = useToast();
  const { data, error, loading, setData } = useApi('/settings');
  const [platform, setPlatform] = useState('android');
  const [list, setList] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [both, setBoth] = useState(false);
  const [editing, setEditing] = useState(null); // { index } or { index: -1 } for new
  const [removing, setRemoving] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const records = data?.data || [];
  const record = records.find((r) => r.type === platform);
  const other = platform === 'android' ? 'ios' : 'android';
  const otherRecord = records.find((r) => r.type === other);

  useEffect(() => {
    const banners = [...(record?.userPromotionalBanners || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    setList(banners);
    setDirty(false);
    setSaveError(null);
  }, [platform, record?._id, record?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next) => {
    setList(next);
    setDirty(true);
  };
  const move = (i, d) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    update(next);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = strip(list);
      const saved = await api.patch(`/settings/${platform}`, { userPromotionalBanners: payload });
      let savedOther = null;
      if (both) {
        if (!otherRecord) throw new Error(`${PLATFORM[other]} has no settings yet — create them on App settings first.`);
        savedOther = await api.patch(`/settings/${other}`, { userPromotionalBanners: payload.map(({ _id, ...b }) => b) });
      }
      setData((d) => ({
        ...d,
        data: (d?.data || []).map((r) => (r.type === platform ? saved : savedOther && r.type === other ? savedOther : r)),
      }));
      toast(both ? 'Banners saved on Android and iOS' : `${PLATFORM[platform]} banners saved`);
    } catch (e) {
      setSaveError(e);
    } finally {
      setSaving(false);
    }
  };

  const active = list.filter((b) => b.isActive !== false);

  return (
    <>
      <PageHead
        eyebrow="Configuration"
        title={`Promotional banners · ${PLATFORM[platform]}`}
        description="The cards on the rider home screen, shown top to bottom in this order. Saving replaces the whole list for the platform."
        action={<Tabs value={platform} onChange={setPlatform} options={[{ value: 'android', label: 'Android' }, { value: 'ios', label: 'iOS' }]} />}
      />
      <ErrorNote error={error} className="mb-4" />
      {loading ? (
        <Spinner />
      ) : !record ? (
        <Card className="py-14">
          <EmptyState title={`No ${PLATFORM[platform]} settings yet`} hint="Create the platform record on the App settings page first." />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHead
              eyebrow={`${list.length} banner${list.length === 1 ? '' : 's'} · ${active.length} shown`}
              title="Banners"
              action={
                <Button size="sm" onClick={() => setEditing({ index: -1 })}>
                  <Plus size={14} /> Add banner
                </Button>
              }
            />
            {!list.length ? (
              <div className="py-14">
                <EmptyState title="No banners" hint="Add one to promote an offer on the rider home screen." />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {list.map((b, i) => (
                  <li key={b._id || `${b.imageUrl}-${i}`} className="flex flex-wrap items-center gap-4 px-5 py-4 sm:flex-nowrap">
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                        <ArrowUp size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                        <ArrowDown size={14} />
                      </Button>
                    </div>
                    <div className="w-40 shrink-0">
                      <BannerImage src={b.imageUrl} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.title || <span className="text-ink/40">Untitled</span>}</p>
                      <p className="truncate text-xs text-ink/50">{b.linkUrl || 'No link'}</p>
                      <Badge value={b.isActive !== false ? 'active' : 'inactive'} className="mt-1.5">
                        {b.isActive !== false ? `Shown · #${active.indexOf(b) + 1}` : 'Parked'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Toggle checked={b.isActive !== false} onChange={(v) => update(list.map((x, j) => (j === i ? { ...x, isActive: v } : x)))} />
                      <Button variant="ghost" size="icon" onClick={() => setEditing({ index: i })} aria-label="Edit">
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setRemoving(i)} aria-label="Remove">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-lg border-t border-line bg-mist/60 px-5 py-3">
              {saveError && <ErrorNote error={saveError} className="mr-auto" />}
              <label className="flex items-center gap-2 text-sm text-ink/70">
                <input type="checkbox" checked={both} onChange={(e) => setBoth(e.target.checked)} className="accent-[#F26B21]" />
                Also apply to {PLATFORM[other]}
              </label>
              <Button variant="secondary" disabled={!dirty} onClick={() => { setList([...(record.userPromotionalBanners || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))); setDirty(false); }}>
                Discard
              </Button>
              <Button onClick={save} loading={saving} disabled={!dirty && !both}>
                Save banners
              </Button>
            </div>
          </Card>
          <div>
            <p className="eyebrow mb-2 text-center">Preview · rider home</p>
            <PhoneFrame title="Home">
              {active.length ? (
                <div className="space-y-3">
                  {active.map((b, i) => (
                    <BannerImage key={`${b.imageUrl}-${i}`} src={b.imageUrl} />
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-ink/40">No banners shown</p>
              )}
            </PhoneFrame>
          </div>
        </div>
      )}
      <BannerModal
        open={Boolean(editing)}
        initial={editing && editing.index >= 0 ? list[editing.index] : null}
        onClose={() => setEditing(null)}
        onDone={(b) => update(editing.index >= 0 ? list.map((x, j) => (j === editing.index ? { ...x, ...b } : x)) : [...list, b])}
      />
      <Confirm
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => update(list.filter((_, j) => j !== removing))}
        title="Remove this banner?"
        confirmLabel="Remove"
      >
        It disappears from the list now and from the app once you save. To hide it for a while instead, switch it off.
      </Confirm>
    </>
  );
}
