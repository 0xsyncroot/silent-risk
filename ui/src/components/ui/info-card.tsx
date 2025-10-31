import { ReactNode } from 'react';

interface InfoCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'info' | 'success' | 'warning' | 'error';
}

const variantStyles = {
  default: 'bg-white border-gray-200',
  info: 'bg-[#f5f5f5] border-gray-200',
  success: 'bg-green-50 border-green-200',
  warning: 'bg-yellow-50 border-yellow-200',
  error: 'bg-red-50 border-red-200'
};

export function InfoCard({ 
  children, 
  className = '', 
  variant = 'default' 
}: InfoCardProps) {
  return (
    <div className={`rounded-xl border p-8 ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
}
