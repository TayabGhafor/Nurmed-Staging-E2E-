interface ModalProps {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

const Modal = ({ children, className, onClose }: ModalProps) => {
  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black bg-opacity-50"
          onClick={onClose}
        ></div>
        <div
          className={`relative z-[100] ${className} w-full rounded-t-xl bg-white p-4 shadow-2xl sm:mx-auto sm:max-w-3xl sm:rounded-xl`}
        >
          {children}
        </div>
      </div>
    </>
  );
};

export default Modal;
