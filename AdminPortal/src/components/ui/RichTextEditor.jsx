import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Code, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered,
  Minus, Quote, Redo2, Underline as UnderlineIcon, Undo2, Unlink,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from './Toast.jsx';

function Tool({ on, active, disabled, title, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
      className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-35 ${active ? 'bg-brand text-white' : 'text-ink/65 hover:bg-white hover:text-brand'}`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-4 w-px bg-line" />;

// TipTap editor that reads and writes HTML. The backend sanitises again on save.
export function RichTextEditor({ value, onChange, placeholder = 'Start writing…', error, minHeight = 'min-h-[18rem]' }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    editorProps: { attributes: { class: `prose-editor ${minHeight} px-3.5 py-3` } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  // Replace content when a different document is loaded (not on every keystroke).
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(value || '', false);
  }, [value, editor]);

  if (!editor) return null;
  const c = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes('link').href || 'https://';
    const url = window.prompt('Link address', prev);
    if (url === null) return;
    if (!url || url === 'https://') c().unsetLink().run();
    else c().extendMarkRange('link').setLink({ href: url }).run();
  };

  const uploadImage = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try {
      const { url } = await api.upload('/uploads/image', form);
      c().setImage({ src: url }).run();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div className={`overflow-hidden rounded-md border bg-white ${error ? 'border-red-300' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-mist/70 px-1.5 py-1.5">
        <Tool title="Bold" on={() => c().toggleBold().run()} active={editor.isActive('bold')}><Bold size={14} /></Tool>
        <Tool title="Italic" on={() => c().toggleItalic().run()} active={editor.isActive('italic')}><Italic size={14} /></Tool>
        <Tool title="Underline" on={() => c().toggleUnderline().run()} active={editor.isActive('underline')}><UnderlineIcon size={14} /></Tool>
        <Divider />
        <Tool title="Heading" on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}><Heading2 size={14} /></Tool>
        <Tool title="Subheading" on={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}><Heading3 size={14} /></Tool>
        <Divider />
        <Tool title="Bulleted list" on={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')}><List size={14} /></Tool>
        <Tool title="Numbered list" on={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')}><ListOrdered size={14} /></Tool>
        <Tool title="Quote" on={() => c().toggleBlockquote().run()} active={editor.isActive('blockquote')}><Quote size={14} /></Tool>
        <Tool title="Code block" on={() => c().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}><Code size={14} /></Tool>
        <Tool title="Divider" on={() => c().setHorizontalRule().run()}><Minus size={14} /></Tool>
        <Divider />
        <Tool title="Align left" on={() => c().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}><AlignLeft size={14} /></Tool>
        <Tool title="Align centre" on={() => c().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}><AlignCenter size={14} /></Tool>
        <Tool title="Align right" on={() => c().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}><AlignRight size={14} /></Tool>
        <Divider />
        <Tool title="Link" on={setLink} active={editor.isActive('link')}><Link2 size={14} /></Tool>
        <Tool title="Remove link" on={() => c().unsetLink().run()} disabled={!editor.isActive('link')}><Unlink size={14} /></Tool>
        <Tool title="Image" on={() => fileRef.current?.click()}><ImagePlus size={14} /></Tool>
        <Divider />
        <Tool title="Undo" on={() => c().undo().run()} disabled={!editor.can().undo()}><Undo2 size={14} /></Tool>
        <Tool title="Redo" on={() => c().redo().run()} disabled={!editor.can().redo()}><Redo2 size={14} /></Tool>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { uploadImage(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

// Read-only render of stored HTML (already sanitised server-side).
export function HtmlPreview({ html, className = '' }) {
  // eslint-disable-next-line react/no-danger
  return <div className={`prose-editor ${className}`} dangerouslySetInnerHTML={{ __html: html || '<p style="color:rgba(14,42,71,.4)">Nothing to preview.</p>' }} />;
}
