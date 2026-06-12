// components/TextArea.tsx
import React from "react";


interface TextAreaProps {
    rows?: number;
    placeholder?: string;
    className?: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    disabled?: boolean;
    readOnly?: boolean;

}

const TextArea: React.FC<TextAreaProps> = ({
    rows = 4,
    placeholder = "Enter text...",
    className = "",
    value,
    onChange,
    ...props
}) => {
    return (
        <textarea
            rows={rows}
            placeholder={placeholder}
            className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
            value={value}
            onChange={onChange}
            {...props}
        />
    );
};

export default TextArea;