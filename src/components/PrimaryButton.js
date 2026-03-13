export default function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="
        h-[46px] rounded-xl border border-greenBorder
        bg-gradient-to-b from-[#C9FF86] to-green
        text-[14px] font-black
        shadow-greenBtn
        transition-all
        hover:-translate-y-0.5 hover:shadow-greenBtnHover
      "
    >
      {children}
    </button>
  );
}
