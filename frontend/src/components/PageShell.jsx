export default function PageShell({ children, className = "" }) {
  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <div className="mx-auto max-w-7xl p-6">{children}</div>
    </div>
  );
}
