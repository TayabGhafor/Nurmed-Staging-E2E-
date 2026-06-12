// components/Select.tsx
import React from "react";

interface SelectProps {
    options: { value: string; label: string }[];
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({
    options,
    value,
    onChange,
    className = "",
    placeholder = "Select an option",
    disabled = false,
}) => {
    return (
        <select
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`w-full appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none ${className}`}
            style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 12px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px',
                paddingRight: '2.5rem'
            }}
        >
            {placeholder && (
                <option value="" disabled>
                    {placeholder}
                </option>
            )}
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
};

export default Select;