// components/Button.tsx
import React from 'react';

interface ButtonProps {
  children: React.ReactNode; 
  onClick?: () => void; 
  className?: string; 
  disabled?: boolean; 
  type?: 'button' | 'submit' | 'reset'; 
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  className = '',
  disabled = false,
  type = 'button',
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
};

export default Button;