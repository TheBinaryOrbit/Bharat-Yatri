import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../../lib/auth.jsx';
import { exportList } from '../../lib/export.js';
import { Button } from './Button.jsx';
import { useToast } from './Toast.jsx';

// "Export to Excel" for a list. Exports every row matching the current filters and sort, not
// just the page on screen. Pass `path` + `params` for server-paginated lists, or `rows` for a
// list already loaded in full. Hidden without reports.export (the API enforces it too).
export function ExportButton({ path, params, paging, rows, columns, filename, sheet, label = 'Export Excel', size = 'md', variant = 'secondary', disabled }) {
  const { can } = useAuth();
  const toast = useToast();
  const [progress, setProgress] = useState(null);
  if (!can('reports.export')) return null;

  const run = async () => {
    setProgress({ done: 0, total: 0 });
    try {
      const count = await exportList({
        path, params, paging, rows, columns, filename, sheet: sheet || filename,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      toast(`Exported ${count.toLocaleString('en-IN')} row${count === 1 ? '' : 's'} to Excel`);
    } catch (e) {
      toast.error(e);
    } finally {
      setProgress(null);
    }
  };

  const busy = Boolean(progress);
  const text = busy && progress.total > 0 ? `Exporting ${Math.round((progress.done / progress.total) * 100)}%` : label;
  return (
    <Button variant={variant} size={size} onClick={run} loading={busy} disabled={disabled || busy} title="Download every row matching the current filters as an Excel file">
      {!busy && <FileSpreadsheet size={14} />} {text}
    </Button>
  );
}
