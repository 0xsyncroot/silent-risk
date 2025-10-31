import { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'zama-primary' | 'zama-secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  loading?: boolean;
  icon?: boolean;
}

const variants = {
  primary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl',
  secondary: 'bg-white hover:bg-blue-50 text-blue-600 border-2 border-blue-600 hover:border-blue-700',
  outline: 'border-2 border-slate-300 hover:border-blue-600 text-slate-700 hover:bg-blue-50 hover:text-blue-600',
  'zama-primary': 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl',
  'zama-secondary': 'bg-white hover:bg-blue-50 text-blue-600 border-2 border-blue-600 hover:border-blue-700'
};

const sizes = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base'
};

export function Button({ 
  children, 
  onClick, 
  disabled = false, 
  variant = 'primary', 
  size = 'md',
  className = '',
  loading = false,
  icon = false
}: ButtonProps) {
  // Reserved: Zama-specific styling for themed buttons
  // const isZamaStyle = variant.startsWith('zama-');
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${variants[variant]} 
        ${sizes[size]} 
        rounded-2xl
        font-semibold transition-all duration-300 
        transform hover:scale-105 hover:-translate-y-1
        disabled:transform-none disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {loading ? (
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
          <span>Loading...</span>
        </div>
      ) : (
        <div className="flex items-center justify-center space-x-2">
          <span>{children}</span>
          {icon && <ArrowRight className="h-4 w-4" />}
        </div>
      )}
    </button>
  );
}
