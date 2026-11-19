// Transient message on the toast surface. Errors use the bad tint and the text says "Failed", so it is not colour-only.
export default function Toast({ toast }) {
  if (!toast) return null;
  const tone = toast.type === 'error' ? 'bg-bad-bg text-bad-ink' : 'bg-toast text-canvas';
  return (
    <div role="status" className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-[6px] px-5 py-3 text-sm font-semibold ${tone}`}>
      {toast.message}
    </div>
  );
}
