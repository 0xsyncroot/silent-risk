interface StatusBadgeProps {
  status: 'connected' | 'disconnected' | 'pending' | 'success' | 'error';
  children: React.ReactNode;
}

const statusStyles = {
  connected: 'bg-green-100 text-green-800 border-green-200',
  disconnected: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  error: 'bg-red-100 text-red-800 border-red-200'
};

export function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusStyles[status]}`}>
      {children}
    </span>
  );
}
