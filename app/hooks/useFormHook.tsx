import { useForm } from 'react-hook-form';

const useFormHook = () => {
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm();

    const onSubmit = (data: any) => {
        reset();
    };

    return {
        register,
        handleSubmit,
        errors,
        onSubmit,
    };
};

export default useFormHook;