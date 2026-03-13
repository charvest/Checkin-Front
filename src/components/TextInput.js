export default function TextInput({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-[14px] font-extrabold mt-2">
        {label}
      </label>

      <div className="relative group w-full">
        <input
          {...props}
          className="
            w-full h-12
            rounded-xl border border-border
            px-4 text-[14px]
            shadow-input outline-none
            transition-all
            focus:border-greenBorder focus:-translate-y-[1px]
            focus:shadow-[0_0_0_4px_rgba(185,255,102,.28),0_14px_25px_rgba(0,0,0,.06)]
          "
        />

        <span
          className="
            absolute left-3 right-3 bottom-2
            h-[2px] origin-left scale-x-0
            bg-green transition
            group-focus-within:scale-x-100
          "
        />
      </div>
    </div>
  );
}
